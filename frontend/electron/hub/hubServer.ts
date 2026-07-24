import http from "http";
import { query, execute, upsertBatch, getMeta, setMeta } from "../database/dbService";
import { DEFAULT_HUB_PORT } from "./nodeConfig";
import crypto from "crypto";
import { createLogger } from "../logger";

const log = createLogger("HubAPI");

let server: http.Server | null = null;
let hubSecret: string | null = null;

async function getOrCreateHubSecret(): Promise<string> {
	if (hubSecret) return hubSecret;
	const existing = await getMeta("hub_api_secret");
	if (existing) {
		hubSecret = existing;
		return existing;
	}
	const secret = crypto.randomBytes(32).toString("hex");
	await setMeta("hub_api_secret", secret);
	hubSecret = secret;
	return secret;
}

function isAuthorized(req: http.IncomingMessage): boolean {
	if (!hubSecret) return false;
	const auth = req.headers["authorization"] || "";
	if (!auth.startsWith("Bearer ")) return false;
	const provided = Buffer.from(auth.slice(7));
	const expected = Buffer.from(hubSecret);
	if (provided.length !== expected.length) return false;
	return crypto.timingSafeEqual(provided, expected);
}

function json(res: http.ServerResponse, data: unknown, status = 200): void {
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
	});
	res.end(JSON.stringify(data));
}

function error(res: http.ServerResponse, msg: string, status = 400): void {
	json(res, { error: msg }, status);
}

function readBody(req: http.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let size = 0;
		const MAX_BODY = 10 * 1024 * 1024; // 10 MB limit
		req.on("data", (chunk: Buffer) => {
			size += chunk.length;
			if (size > MAX_BODY) {
				reject(new Error("Request body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString()));
		req.on("error", reject);
	});
}

const PULL_TABLES: Record<string, { modifiedCol?: string }> = {
	companies: { modifiedCol: "modified" },
	countries: { modifiedCol: "modified" },
	currencies: { modifiedCol: "modified" },
	uom: { modifiedCol: "modified" },
	brands: { modifiedCol: "modified" },
	industries: { modifiedCol: "modified" },
	modes_of_payment: { modifiedCol: "modified" },
	cost_centers: { modifiedCol: "modified" },
	warehouses: { modifiedCol: "modified" },
	accounts: { modifiedCol: "modified" },
	price_lists: { modifiedCol: "modified" },
	mode_of_payment_accounts: { modifiedCol: "modified" },
	pos_profiles: { modifiedCol: "modified" },
	pos_payment_methods: { modifiedCol: "modified" },
	items: { modifiedCol: "modified" },
	item_groups: { modifiedCol: "modified" },
	item_barcodes: { modifiedCol: "modified" },
	uom_conversion_details: { modifiedCol: "modified" },
	item_prices: { modifiedCol: "modified" },
	item_taxes: { modifiedCol: "modified" },
	item_vendors: { modifiedCol: "modified" },
	item_reorder_levels: { modifiedCol: "modified" },
	item_tax_templates: { modifiedCol: "modified" },
	item_tax_template_details: { modifiedCol: "modified" },
	sales_taxes_templates: { modifiedCol: "modified" },
	sales_taxes_charges: { modifiedCol: "modified" },
	pricing_rules: { modifiedCol: "modified" },
	pricing_rule_item_codes: { modifiedCol: "modified" },
	pricing_rule_item_groups: { modifiedCol: "modified" },
	pricing_rule_brands: { modifiedCol: "modified" },
	customers: { modifiedCol: "modified" },
	suppliers: { modifiedCol: "modified" },
	bins: { modifiedCol: "modified" },
	pos_users: { modifiedCol: "modified" },
	pos_profile_cache: {},
	item_tax_cache: {},
	stock_cache: {},
};

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
	const url = new URL(req.url || "/", `http://${req.headers.host}`);
	const path = url.pathname;
	const method = req.method?.toUpperCase();

	if (method === "OPTIONS") {
		res.writeHead(204, {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, X-Till-Id",
		});
		res.end();
		return;
	}

	try {
		if (method === "GET" && path === "/api/health") {
			json(res, { status: "ok", role: "hub", timestamp: new Date().toISOString() });
			return;
		}

		if (!isAuthorized(req)) {
			error(res, "Unauthorized", 401);
			return;
		}

		if (method === "GET" && path === "/api/sync-state") {
			const rows = await query<{ key: string; value: string }>(
				"SELECT `key`, `value` FROM `sync_meta`",
			);
			const meta: Record<string, string> = {};
			for (const r of rows) meta[r.key] = r.value;
			json(res, meta);
			return;
		}

		const pullMatch = path.match(/^\/api\/pull\/([a-z_]+)$/);
		if (method === "GET" && pullMatch) {
			const table = pullMatch[1];
			const config = PULL_TABLES[table];
			if (!config) {
				error(res, `Unknown table: ${table}`, 404);
				return;
			}

			const since = url.searchParams.get("since");
			const limit = Math.min(Number(url.searchParams.get("limit")) || 500, 2000);
			const offset = Number(url.searchParams.get("offset")) || 0;

			let sql = `SELECT * FROM \`${table}\``;
			const params: unknown[] = [];

			if (since && config.modifiedCol) {
				sql += ` WHERE \`${config.modifiedCol}\` > ?`;
				params.push(since);
			}

			if (config.modifiedCol) {
				sql += ` ORDER BY \`${config.modifiedCol}\` ASC`;
			}

			sql += ` LIMIT ? OFFSET ?`;
			params.push(limit, offset);

			const rows = await query(sql, params);
			json(res, { data: rows, count: rows.length });
			return;
		}

		const stockMatch = path.match(/^\/api\/stock\/(.+)$/);
		if (method === "GET" && stockMatch) {
			const warehouse = decodeURIComponent(stockMatch[1]);
			const rows = await query(
				"SELECT `item_code`, `actual_qty`, `updated_at` FROM `stock_cache` WHERE `warehouse` = ?",
				[warehouse],
			);
			json(res, { data: rows });
			return;
		}

		if (method === "GET" && path === "/api/deletions") {
			const since = url.searchParams.get("since");
			let sql = "SELECT * FROM `deletion_log`";
			const params: unknown[] = [];
			if (since) {
				sql += " WHERE `deleted_at` > ?";
				params.push(since);
			}
			sql += " ORDER BY `deleted_at` ASC LIMIT 2000";
			const rows = await query(sql, params);
			json(res, { data: rows });
			return;
		}

		if (method === "POST" && path === "/api/push/invoice") {
			const body = JSON.parse(await readBody(req));
			const localId = body.local_id || crypto.randomUUID();
			const tillId = body.till_id || req.headers["x-till-id"] || "unknown";

			await execute(
				`INSERT INTO \`pending_invoices\` (\`local_id\`, \`data\`, \`status\`, \`customer_name\`, \`grand_total\`)
         VALUES (?, ?, 'pending', ?, ?)
         ON DUPLICATE KEY UPDATE \`data\` = VALUES(\`data\`), \`status\` = 'pending'`,
				[
					localId,
					typeof body.data === "string" ? body.data : JSON.stringify(body.data),
					body.customer_name || null,
					body.grand_total || 0,
				],
			);

			json(res, { success: true, local_id: localId, till_id: tillId }, 201);
			return;
		}

		if (method === "POST" && path === "/api/push/purchase") {
			const body = JSON.parse(await readBody(req));
			const localId = body.local_id || crypto.randomUUID();
			const type = body.type || "purchase_order";

			await execute(
				`INSERT INTO \`pending_purchases\` (\`local_id\`, \`type\`, \`data\`, \`status\`, \`supplier_name\`, \`grand_total\`)
         VALUES (?, ?, ?, 'pending', ?, ?)
         ON DUPLICATE KEY UPDATE \`data\` = VALUES(\`data\`), \`status\` = 'pending'`,
				[
					localId,
					type,
					typeof body.data === "string" ? body.data : JSON.stringify(body.data),
					body.supplier_name || null,
					body.grand_total || 0,
				],
			);

			json(res, { success: true, local_id: localId }, 201);
			return;
		}

		if (method === "POST" && path === "/api/push/expense") {
			const body = JSON.parse(await readBody(req));
			const localId = body.local_id || crypto.randomUUID();

			await execute(
				`INSERT INTO \`expenses\`
         (\`local_id\`, \`expense_type\`, \`amount\`, \`description\`, \`posting_date\`,
          \`company\`, \`cost_center\`, \`mode_of_payment\`, \`user\`,
          \`pos_opening_shift_local_id\`, \`sync_status\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
         ON DUPLICATE KEY UPDATE \`amount\` = VALUES(\`amount\`), \`sync_status\` = 'pending'`,
				[
					localId,
					body.expense_type,
					body.amount || 0,
					body.description || null,
					body.posting_date || null,
					body.company || null,
					body.cost_center || null,
					body.mode_of_payment || null,
					body.user || null,
					body.pos_opening_shift_local_id || null,
				],
			);

			json(res, { success: true, local_id: localId }, 201);
			return;
		}

		if (method === "POST" && path === "/api/push/bank-drop") {
			const body = JSON.parse(await readBody(req));
			const localId = body.local_id || crypto.randomUUID();

			await execute(
				`INSERT INTO \`bank_drops\`
         (\`local_id\`, \`amount\`, \`description\`, \`posting_date\`,
          \`company\`, \`mode_of_payment\`, \`user\`,
          \`pos_opening_shift_local_id\`, \`sync_status\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
         ON DUPLICATE KEY UPDATE \`amount\` = VALUES(\`amount\`), \`sync_status\` = 'pending'`,
				[
					localId,
					body.amount || 0,
					body.description || null,
					body.posting_date || null,
					body.company || null,
					body.mode_of_payment || null,
					body.user || null,
					body.pos_opening_shift_local_id || null,
				],
			);

			json(res, { success: true, local_id: localId }, 201);
			return;
		}

		if (method === "POST" && path === "/api/push/stock-adjustment") {
			const body = JSON.parse(await readBody(req));
			const localId = body.local_id || crypto.randomUUID();

			await execute(
				`INSERT INTO \`stock_adjustments\`
         (\`local_id\`, \`item_code\`, \`warehouse\`, \`qty\`, \`adjustment_type\`,
          \`reason\`, \`posting_date\`, \`user\`, \`sync_status\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
         ON DUPLICATE KEY UPDATE \`qty\` = VALUES(\`qty\`), \`sync_status\` = 'pending'`,
				[
					localId,
					body.item_code,
					body.warehouse,
					body.qty || 0,
					body.adjustment_type || "increase",
					body.reason || null,
					body.posting_date || null,
					body.user || null,
				],
			);

			json(res, { success: true, local_id: localId }, 201);
			return;
		}

		error(res, "Not found", 404);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal error";
		log.error("Request error", msg);
		error(res, msg, 500);
	}
}

export function startHubServer(port = DEFAULT_HUB_PORT): Promise<void> {
	return new Promise(async (resolve, reject) => {
		if (server) {
			resolve();
			return;
		}

		await getOrCreateHubSecret();

		server = http.createServer(handleRequest);

		server.on("error", (err) => {
			log.error("Server error", err.message);
			reject(err);
		});

		server.listen(port, "0.0.0.0", () => {
			log.info(`Listening on 0.0.0.0:${port}`);
			resolve();
		});
	});
}

export function stopHubServer(): Promise<void> {
	return new Promise((resolve) => {
		if (!server) {
			resolve();
			return;
		}
		server.close(() => {
			server = null;
			log.info("Server stopped");
			resolve();
		});
	});
}

export function isHubRunning(): boolean {
	return server !== null && server.listening;
}

export async function getHubApiSecret(): Promise<string> {
	return getOrCreateHubSecret();
}
