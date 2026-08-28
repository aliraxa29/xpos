import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Files in ascending priority: a later file's value wins over an earlier one. */
const FILES = [".env", ".env.local"];

export function parseEnv(contents) {
	const values = {};

	for (const rawLine of String(contents).split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
		if (!match) continue;

		const [, key] = match;
		let value = match[2].trim();

		// Strip one layer of matching quotes. Unquoted values lose a trailing `# comment`;
		// quoted ones keep everything, which is how a value containing `#` is written.
		const quoted =
			value.length > 1 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0];
		if (quoted) value = value.slice(1, -1);
		else value = value.replace(/\s+#.*$/, "").trim();

		values[key] = value;
	}

	return values;
}

export function loadEnv({ root = ROOT, quiet = false } = {}) {
	const merged = {};

	for (const file of FILES) {
		const filePath = path.join(root, file);
		if (!fs.existsSync(filePath)) continue;
		try {
			Object.assign(merged, parseEnv(fs.readFileSync(filePath, "utf-8")));
		} catch (error) {
			console.warn(`[env] could not read ${file}:`, error?.message || error);
		}
	}

	const applied = [];
	for (const [key, value] of Object.entries(merged)) {
		if (process.env[key] !== undefined) continue;
		process.env[key] = value;
		applied.push(key);
	}

	if (applied.length && !quiet) {
		console.log(`[env] loaded from .env: ${applied.join(", ")}`);
	}

	return applied;
}

export default loadEnv;
