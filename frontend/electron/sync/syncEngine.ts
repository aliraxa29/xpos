import { BrowserWindow, ipcMain, net } from "electron";
import { SYNC_TABLES, SYNC_DEFAULTS, getPrimaryKeyForTable, type SyncTableConfig } from "./syncConfig";
import { query, queryOne, execute, upsertBatch, getMeta, setMeta } from "../database/dbService";
import { createLogger } from "../logger";

const log = createLogger("SyncEngine");

interface SyncState {
	isSyncing: boolean;
	lastSyncTime: string | null;
	pendingPushCount: number;
}

interface SyncContext {
	serverUrl: string;
	csrfToken: string;
	sessionCookies: string;
	apiKey?: string;
	apiSecret?: string;
}

let syncState: SyncState = {
	isSyncing: false,
	lastSyncTime: null,
	pendingPushCount: 0,
};

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let pushIntervalId: ReturnType<typeof setInterval> | null = null;
let syncContext: SyncContext | null = null;
let syncCycleCount = 0;

const DELETION_CHECK_EVERY = 5;
const DELETION_MIN_LOCAL_FLOOR = 20;
const DELETION_MAX_RATIO = 0.5;

function getMainWindow(): BrowserWindow | null {
	const windows = BrowserWindow.getAllWindows();
	return windows[0] || null;
}

function emitToRenderer(channel: string, data: unknown): void {
	const win = getMainWindow();
	if (win && !win.isDestroyed()) {
		win.webContents.send(channel, data);
	}
}

function isOnline(): boolean {
	return net.isOnline();
}

async function apiCall<T = unknown>(
	method: string,
	args: Record<string, unknown> = {},
	options: { httpMethod?: "GET" | "POST" } = {},
): Promise<T> {
	if (!syncContext) throw new Error("Sync context not initialized");

	const httpMethod = options.httpMethod ?? "GET";
	const baseUrl = `${syncContext.serverUrl}/api/method/${method}`;
	let url = baseUrl;
	let body: string | null = null;
	if (httpMethod === "POST") {
		body = JSON.stringify(args);
	} else {
		const queryString = Object.entries(args)
			.map(
				([k, v]) =>
					`${encodeURIComponent(k)}=${encodeURIComponent(typeof v === "object" ? JSON.stringify(v) : String(v))}`,
			)
			.join("&");
		if (queryString) url = `${baseUrl}?${queryString}`;
	}

	return new Promise<T>((resolve, reject) => {
		const request = net.request({
			method: httpMethod,
			url,
		});

		request.setHeader("Accept", "application/json");
		if (body !== null) {
			request.setHeader("Content-Type", "application/json");
		}
		if (syncContext!.apiKey && syncContext!.apiSecret) {
			request.setHeader("Authorization", `token ${syncContext!.apiKey}:${syncContext!.apiSecret}`);
		} else {
			if (syncContext!.csrfToken) {
				request.setHeader("X-Frappe-CSRF-Token", syncContext!.csrfToken);
			}
			if (syncContext!.sessionCookies) {
				request.setHeader("Cookie", syncContext!.sessionCookies);
			}
		}

		let responseBody = "";

		request.on("response", (response: Electron.IncomingMessage) => {
			response.on("data", (chunk: Uint8Array) => {
				responseBody += chunk.toString();
			});

			response.on("end", () => {
				try {
					const data = JSON.parse(responseBody);
					if (response.statusCode && response.statusCode >= 400) {
						reject(new Error(data.message || `HTTP ${response.statusCode}`));
					} else {
						resolve(data.message as T);
					}
				} catch {
					reject(new Error(`Invalid JSON response from ${method}`));
				}
			});
		});

		request.on("error", (err: Error) => {
			reject(err);
		});

		if (body !== null) {
			request.write(body);
		}
		request.end();
	});
}

async function pullTable(config: SyncTableConfig): Promise<number> {
	emitToRenderer("sync-status", {
		phase: "pull",
		table: config.label,
		progress: 0,
	});

	let lastModified: string | null = null;
	if (config.incremental) {
		lastModified = await getMeta(`last_sync_${config.idbStore}`);
	}

	let totalPulled = 0;
	let start = 0;
	let hasMore = true;
	let maxServerModified: string | null = null;

	while (hasMore) {
		const filters: Record<string, unknown> = { ...(config.filters || {}) };
		if (lastModified) {
			filters["modified"] = [">", lastModified];
		}

		const batch = await apiCall<Record<string, unknown>[]>(
			config.pullMethod || "frappe.client.get_list",
			{
				doctype: config.doctype,
				fields: config.fields,
				filters,
				order_by: `${config.orderBy} asc`,
				limit_start: start,
				limit_page_length: config.batchSize,
			},
		);

		if (!batch || batch.length === 0) {
			hasMore = false;
			break;
		}

		for (const row of batch) {
			const m = row["modified"] as string | undefined;
			if (m && (!maxServerModified || m > maxServerModified)) {
				maxServerModified = m;
			}
		}

		const primaryKey = getPrimaryKeyForTable(config.idbStore);
		const processedBatch =
			primaryKey === "name"
				? batch
				: batch.map((row) => {
						const r: Record<string, unknown> = { ...row };
						if ("name" in r) {
							if (r[primaryKey] === undefined || r[primaryKey] === null) {
								r[primaryKey] = r["name"];
							}
							delete r["name"];
						}
						return r;
					});
		await upsertBatch(config.idbStore, processedBatch, primaryKey);

		totalPulled += batch.length;
		start += config.batchSize;

		emitToRenderer("sync-status", {
			phase: "pull",
			table: config.label,
			progress: totalPulled,
		});

		if (batch.length < config.batchSize) {
			hasMore = false;
		}
	}

	if (totalPulled > 0 || !config.incremental) {
		const newTimestamp = maxServerModified ?? new Date().toISOString();
		await setMeta(`last_sync_${config.idbStore}`, newTimestamp);
	}

	return totalPulled;
}

async function detectDeletions(config: SyncTableConfig): Promise<number> {
	if (config.direction === "push") return 0;

	const primaryKey = getPrimaryKeyForTable(config.idbStore);

	const serverNames = await apiCall<{ name: string }[]>("frappe.client.get_list", {
		doctype: config.doctype,
		fields: ["name"],
		filters: config.filters || {},
		limit_page_length: 0,
	});

	if (!serverNames || !Array.isArray(serverNames)) return 0;

	const serverNameSet = new Set(serverNames.map((r) => r.name));

	const localRows = await query<Record<string, string>>(
		`SELECT \`${primaryKey}\` FROM \`${config.idbStore}\``,
	);

	const toDelete = localRows.filter((row) => !serverNameSet.has(row[primaryKey]));

	if (toDelete.length > 0 && localRows.length >= DELETION_MIN_LOCAL_FLOOR) {
		if (serverNameSet.size === 0) {
			log.warn(
				`Skipping deletion pass for ${config.label}: server returned 0 rows but local has ${localRows.length}`,
			);
			return 0;
		}
		if (toDelete.length > localRows.length * DELETION_MAX_RATIO) {
			log.warn(
				`Skipping deletion pass for ${config.label}: would delete ${toDelete.length}/${localRows.length} ` +
					`(server returned ${serverNameSet.size}), exceeds ${DELETION_MAX_RATIO * 100}% safety threshold`,
			);
			emitToRenderer("sync-error", {
				message: `Deletion check skipped for ${config.label}: server returned an implausibly small list (${serverNameSet.size} rows). Catalog left intact.`,
				table: config.label,
			});
			return 0;
		}
	}

	let deleted = 0;

	for (const row of localRows) {
		const localKey = row[primaryKey];
		if (!serverNameSet.has(localKey)) {
			await execute(`DELETE FROM \`${config.idbStore}\` WHERE \`${primaryKey}\` = ?`, [localKey]);

			await execute(
				`INSERT INTO \`deletion_log\` (\`table_name\`, \`record_key\`, \`doctype\`, \`deleted_at\`)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE \`deleted_at\` = NOW()`,
				[config.idbStore, localKey, config.doctype],
			);

			deleted++;
		}
	}

	if (deleted > 0) {
		emitToRenderer("sync-status", {
			phase: "deletion",
			table: config.label,
			progress: deleted,
		});
		log.info(`Detected ${deleted} deletions in ${config.label}`);
	}

	return deleted;
}

async function pushTable(config: SyncTableConfig): Promise<{ synced: number; failed: number }> {
	if (!config.pushMethod) return { synced: 0, failed: 0 };

	emitToRenderer("sync-status", {
		phase: "push",
		table: config.label,
		progress: 0,
	});

	let pendingTable: string;
	let typeFilter = "";
	let selectFields = "*";
	let statusField = "status";
	let statusPending = "'pending'";
	let statusFailed = "'failed'";
	let statusSyncing = "syncing";
	let statusSynced = "synced";
	let retryField = "retry_count";
	let idField = "id";
	let localIdField = "id";
	const params: unknown[] = [];

	if (config.idbStore === "pending_invoices") {
		pendingTable = "pending_invoices";
		localIdField = "local_id";
	} else if (config.idbStore === "pending_purchases") {
		pendingTable = "pending_purchases";
		localIdField = "local_id";
		const docKey = config.doctype.toLowerCase().replace(/ /g, "_");
		typeFilter = " AND `type` = ?";
		params.push(docKey);
	} else if (config.idbStore === "pos_opening_shifts") {
		pendingTable = "pos_opening_shifts";
		statusField = "sync_status";
		retryField = "COALESCE(retry_count, 0)";
		localIdField = "id";
		statusPending = "'pending'";
		statusFailed = "'failed'";
		statusSyncing = "syncing";
		statusSynced = "synced";
	} else if (config.idbStore === "pos_closing_entries") {
		pendingTable = "pos_closing_entries";
		statusField = "sync_status";
		retryField = "COALESCE(retry_count, 0)";
		localIdField = "id";
		statusPending = "'pending'";
		statusFailed = "'failed'";
		statusSyncing = "syncing";
		statusSynced = "synced";
	} else {
		return { synced: 0, failed: 0 };
	}

	let querySQL: string;
	if (pendingTable === "pending_invoices" || pendingTable === "pending_purchases") {
		querySQL = `SELECT * FROM \`${pendingTable}\`
     WHERE (\`${statusField}\` = ${statusPending} OR \`${statusField}\` = ${statusFailed})
       AND COALESCE(\`retry_count\`, 0) < ?${typeFilter}
     ORDER BY \`created_at\` ASC`;
	} else {
		querySQL = `SELECT * FROM \`${pendingTable}\`
     WHERE (\`${statusField}\` = ${statusPending} OR \`${statusField}\` = ${statusFailed})
     ORDER BY \`created_at\` ASC`;
		params.length = 0;
	}

	const pendingRecords = await query<Record<string, unknown>>(
		querySQL,
		pendingTable.includes("pending") ? [SYNC_DEFAULTS.maxRetries, ...params] : params,
	);

	if (pendingRecords.length === 0) return { synced: 0, failed: 0 };

	let synced = 0;
	let failed = 0;

	for (const record of pendingRecords) {
		if (!isOnline()) break;

		const recordId = record[idField] as number;
		const recordLocalId = String(record[localIdField] || recordId);

		try {
			await execute(
				`UPDATE \`${pendingTable}\` SET \`${statusField}\` = '${statusSyncing}' WHERE \`${idField}\` = ?`,
				[recordId],
			);

			let data: Record<string, unknown>;

			if (pendingTable === "pending_invoices" || pendingTable === "pending_purchases") {
				const rawData = record.data;
				data =
					typeof rawData === "string"
						? JSON.parse(rawData)
						: (rawData as Record<string, unknown>) || {};

				if (pendingTable === "pending_invoices") {
					delete data.receipt;
					const localShiftId = data.pos_opening_shift || data.pos_opening_shift_local_id;
					if (localShiftId) {
						const serverShiftName = await getServerShiftName(String(localShiftId));
						if (serverShiftName) {
							data.pos_opening_shift = serverShiftName;
							delete data.pos_opening_shift_local_id;
						} else {
							await execute(
								`UPDATE \`${pendingTable}\` SET \`${statusField}\` = 'pending' WHERE \`${idField}\` = ?`,
								[recordId],
							);
							continue;
						}
					}
				}
			} else if (pendingTable === "pos_opening_shifts") {
				data = {
					period_start_date: record.period_start_date,
					posting_date: record.posting_date,
					user: record.user,
					pos_profile: record.pos_profile,
					company: record.company,
					balance_details: await getOpeningShiftDetails(recordId),
				};
			} else if (pendingTable === "pos_closing_entries") {
				const openingShiftLocalId = record.pos_opening_entry_id as number;
				const serverOpeningShiftName = await getServerShiftName(String(openingShiftLocalId));

				if (!serverOpeningShiftName) {
					await execute(
						`UPDATE \`${pendingTable}\` SET \`${statusField}\` = 'pending' WHERE \`${idField}\` = ?`,
						[recordId],
					);
					continue;
				}

				data = {
					pos_opening_shift: serverOpeningShiftName,
					period_end_date: record.period_end_date,
					posting_date: record.posting_date,
					posting_time: record.posting_time,
					pos_profile: record.pos_profile,
					user: record.user,
					company: record.company,
					payment_reconciliation: await getClosingEntryDetails(recordId),
				};
			} else {
				data = record as Record<string, unknown>;
			}

			const serverResult = await apiCall<{ name?: string }>(
				config.pushMethod,
				{
					data: JSON.stringify(data),
					local_id: recordLocalId,
				},
				{ httpMethod: "POST" },
			);

			if (serverResult?.name) {
				await execute(
					`INSERT INTO \`sync_id_map\` (\`local_id\`, \`server_name\`, \`doctype\`)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE \`server_name\` = VALUES(\`server_name\`)`,
					[recordLocalId, serverResult.name, config.doctype],
				);

				if (pendingTable === "pending_invoices" || pendingTable === "pending_purchases") {
					await execute(
						`UPDATE \`${pendingTable}\` SET \`server_name\` = ?, \`${statusField}\` = '${statusSynced}' WHERE \`${idField}\` = ?`,
						[serverResult.name, recordId],
					);
				} else {
					await execute(
						`UPDATE \`${pendingTable}\` SET \`erp_id\` = ?, \`${statusField}\` = '${statusSynced}', \`synced_at\` = NOW() WHERE \`${idField}\` = ?`,
						[serverResult.name, recordId],
					);
				}
			} else {
				await execute(
					`UPDATE \`${pendingTable}\` SET \`${statusField}\` = '${statusSynced}' WHERE \`${idField}\` = ?`,
					[recordId],
				);
			}

			synced++;
		} catch (error) {
			failed++;
			const errMsg = error instanceof Error ? error.message : String(error);

			if (pendingTable === "pending_invoices" || pendingTable === "pending_purchases") {
				const newRetryCount = (Number(record.retry_count) || 0) + 1;
				const exhausted = newRetryCount >= SYNC_DEFAULTS.maxRetries;
				const nextStatus = exhausted ? "dead_letter" : "failed";

				await execute(
					`UPDATE \`${pendingTable}\` SET \`status\` = '${nextStatus}', \`error\` = ?, \`retry_count\` = COALESCE(\`retry_count\`, 0) + 1 WHERE \`id\` = ?`,
					[errMsg, recordId],
				);

				if (exhausted) {
					log.error(
						`Dead-letter: ${pendingTable} id=${recordId} (local_id=${recordLocalId}) gave up after ${newRetryCount} attempts: ${errMsg}`,
					);
					emitToRenderer("sync-dead-letter", {
						table: config.label,
						pendingTable,
						id: recordId,
						localId: recordLocalId,
						retryCount: newRetryCount,
						error: errMsg,
					});
				}
			} else {
				await execute(
					`UPDATE \`${pendingTable}\` SET \`${statusField}\` = 'failed' WHERE \`${idField}\` = ?`,
					[recordId],
				);
			}

			emitToRenderer("sync-error", {
				message: errMsg,
				table: config.label,
			});
		}

		emitToRenderer("sync-status", {
			phase: "push",
			table: config.label,
			progress: synced + failed,
		});
	}

	return { synced, failed };
}

async function getServerShiftName(localShiftId: string): Promise<string | null> {
	const mapRow = await queryOne<{ server_name: string }>(
		"SELECT `server_name` FROM `sync_id_map` WHERE `local_id` = ? AND `doctype` = 'POS Opening Shift'",
		[localShiftId],
	);
	if (mapRow?.server_name) return mapRow.server_name;

	const shiftRow = await queryOne<{ erp_id: string }>(
		"SELECT `erp_id` FROM `pos_opening_shifts` WHERE `id` = ?",
		[localShiftId],
	);
	if (shiftRow?.erp_id) return shiftRow.erp_id;

	return null;
}

async function getOpeningShiftDetails(
	shiftId: number,
): Promise<{ mode_of_payment: string; opening_amount: number }[]> {
	const rows = await query<{ mode_of_payment: string; opening_amount: number }>(
		"SELECT `mode_of_payment`, `opening_amount` FROM `pos_opening_entry_details` WHERE `parent_id` = ?",
		[shiftId],
	);
	return rows.map((r) => ({
		mode_of_payment: r.mode_of_payment,
		opening_amount: r.opening_amount,
	}));
}

async function getClosingEntryDetails(closingId: number): Promise<
	{
		mode_of_payment: string;
		opening_amount: number;
		expected_amount: number;
		closing_amount: number;
		difference: number;
	}[]
> {
	const rows = await query<{
		mode_of_payment: string;
		opening_amount: number;
		expected_amount: number;
		closing_amount: number;
		difference: number;
	}>(
		`SELECT \`mode_of_payment\`, \`opening_amount\`, \`expected_amount\`, \`closing_amount\`, \`difference\`
     FROM \`pos_closing_entry_details\` WHERE \`parent_id\` = ?`,
		[closingId],
	);
	return rows;
}

async function runSyncCycle(): Promise<void> {
	if (syncState.isSyncing || !isOnline()) return;

	syncState.isSyncing = true;
	syncCycleCount++;
	emitToRenderer("sync-status", { phase: "starting" });

	let totalPulled = 0;
	let totalPushed = 0;
	let totalDeleted = 0;

	try {
		const pullTables = SYNC_TABLES.filter((t) => t.direction === "pull" || t.direction === "both").sort(
			(a, b) => a.pullOrder - b.pullOrder,
		);

		for (const table of pullTables) {
			if (!isOnline()) break;
			try {
				const count = await pullTable(table);
				totalPulled += count;
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);
				emitToRenderer("sync-error", {
					message: `Pull failed for ${table.label}: ${errMsg}`,
					table: table.label,
				});
			}
		}

		if (syncCycleCount % DELETION_CHECK_EVERY === 0) {
			for (const table of pullTables) {
				if (!isOnline()) break;
				try {
					const count = await detectDeletions(table);
					totalDeleted += count;
				} catch (error) {
					const errMsg = error instanceof Error ? error.message : String(error);
					emitToRenderer("sync-error", {
						message: `Deletion check failed for ${table.label}: ${errMsg}`,
						table: table.label,
					});
				}
			}
		}

		const pushTables = SYNC_TABLES.filter((t) => t.direction === "push" || t.direction === "both").sort(
			(a, b) => a.pullOrder - b.pullOrder,
		); // push in dependency order too

		for (const table of pushTables) {
			if (!isOnline()) break;
			try {
				const { synced } = await pushTable(table);
				totalPushed += synced;
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);
				emitToRenderer("sync-error", {
					message: `Push failed for ${table.label}: ${errMsg}`,
					table: table.label,
				});
			}
		}

		syncState.lastSyncTime = new Date().toISOString();
		emitToRenderer("sync-complete", {
			pulled: totalPulled,
			pushed: totalPushed,
			deleted: totalDeleted,
		});
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error);
		emitToRenderer("sync-error", { message: `Sync cycle failed: ${errMsg}` });
	} finally {
		syncState.isSyncing = false;
		emitToRenderer("sync-status", { phase: "idle" });
	}
}

async function runPushCycle(): Promise<void> {
	if (syncState.isSyncing || !isOnline()) return;

	const pushTables = SYNC_TABLES.filter((t) => t.direction === "push" || t.direction === "both").sort(
		(a, b) => a.pullOrder - b.pullOrder,
	);

	let totalPushed = 0;

	for (const table of pushTables) {
		if (!isOnline()) break;
		try {
			const { synced } = await pushTable(table);
			totalPushed += synced;
		} catch (error) {
			log.warn(
				`Push-only cycle failed for ${table.label}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	if (totalPushed > 0) {
		log.info(`Push-only cycle completed: ${totalPushed} records pushed`);
	}
}

export async function runSyncCyclePublic(): Promise<void> {
	await runSyncCycle();
}

export function initSyncEngine(context: SyncContext): void {
	syncContext = context;

	ipcMain.handle("trigger-sync", async () => {
		if (syncState.isSyncing) return false;
		await runSyncCycle();
		return true;
	});

	ipcMain.handle("get-sync-state", () => ({ ...syncState }));

	startPeriodicSync();

	const checkOnline = () => {
		if (isOnline() && !syncState.isSyncing) {
			setTimeout(() => {
				if (isOnline()) runSyncCycle();
			}, SYNC_DEFAULTS.onlineGracePeriodMs);
		}
	};

	setInterval(checkOnline, 30_000);

	log.info(`Initialized with interval: ${SYNC_DEFAULTS.intervalMs} ms`);
}

export function updateSyncContext(context: Partial<SyncContext>): void {
	if (syncContext) {
		syncContext = { ...syncContext, ...context };
	}
}

function startPeriodicSync(): void {
	if (syncIntervalId) clearInterval(syncIntervalId);
	syncIntervalId = setInterval(() => {
		if (isOnline() && !syncState.isSyncing) {
			runSyncCycle();
		}
	}, SYNC_DEFAULTS.intervalMs);

	if (pushIntervalId) clearInterval(pushIntervalId);
	pushIntervalId = setInterval(() => {
		if (isOnline() && !syncState.isSyncing) {
			runPushCycle();
		}
	}, SYNC_DEFAULTS.pushIntervalMs);
}

export function stopSyncEngine(): void {
	if (syncIntervalId) {
		clearInterval(syncIntervalId);
		syncIntervalId = null;
	}
	if (pushIntervalId) {
		clearInterval(pushIntervalId);
		pushIntervalId = null;
	}
	syncContext = null;
	log.info("Stopped");
}
