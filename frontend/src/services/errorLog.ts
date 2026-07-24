/**
 * Central error log, a single shared, reactive buffer that every layer of the
 * app feeds (API/backend failures, sync errors, dead-letters, uncaught renderer
 * errors, and Electron main-process crashes).
 *
 * This is a module-level singleton on purpose: `captureError` must be callable
 * from non-component code (e.g. services/api.ts, main.ts) and the buffer must be
 * shared across the whole app. (Composables like useSyncStatus create fresh refs
 * per call, so they are NOT shared. Hence a plain module singleton here.)
 *
 * Entries are persisted to localStorage so they survive a window reload. This is
 * client-side capture only; nothing is sent to the server.
 */

import { ref } from "vue";

export type ErrorSource = "api" | "sync" | "dead-letter" | "renderer" | "promise" | "main";

export interface ErrorEntry {
	id: string;
	at: string;
	source: ErrorSource;
	title: string;
	message: string;
	method?: string;
	status?: number;
	args?: unknown;
	traceback?: string;
	exceptionType?: string;
	meta?: Record<string, unknown>;
}

const MAX_ENTRIES = 200;
const STORAGE_KEY = "xpos:error-log";
const REDACT_KEYS = ["password", "api_secret", "apisecret", "pwd", "secret", "token"];

export const entries = ref<ErrorEntry[]>([]);
export const unseenCount = ref(0);

function genId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function redact(value: unknown): unknown {
	if (!value || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(redact);
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		if (REDACT_KEYS.includes(k.toLowerCase())) {
			out[k] = "[redacted]";
		} else if (v && typeof v === "object") {
			out[k] = redact(v);
		} else {
			out[k] = v;
		}
	}
	return out;
}

function persist(): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value));
	} catch {}
}

function rehydrate(): void {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			entries.value = parsed.slice(0, MAX_ENTRIES);
		}
	} catch {}
}

/**
 * Record an error. Missing `id`/`at` are filled in; `args` is redacted; the
 * buffer is capped and persisted. Never throws (a failing logger must not break
 * the caller that is already handling an error).
 */
export function captureError(
	partial: Omit<Partial<ErrorEntry>, "id" | "at"> & { source: ErrorSource },
): void {
	try {
		const entry: ErrorEntry = {
			id: genId(),
			at: new Date().toISOString(),
			title: partial.title || partial.message || partial.source,
			message: partial.message || "",
			...partial,
			args: "args" in partial ? redact(partial.args) : undefined,
		};

		entries.value.unshift(entry);
		if (entries.value.length > MAX_ENTRIES) {
			entries.value.length = MAX_ENTRIES;
		}
		unseenCount.value++;
		persist();
	} catch {}
}

export function markAllSeen(): void {
	unseenCount.value = 0;
}

export function clearErrors(): void {
	entries.value = [];
	unseenCount.value = 0;
	persist();
}

/** Pretty JSON of all entries, for the Export button. */
export function exportErrors(): string {
	return JSON.stringify(entries.value, null, 2);
}

rehydrate();
