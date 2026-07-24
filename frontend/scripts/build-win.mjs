/**
 * Local Windows build produces release/win-unpacked/ on Linux without Wine.
 *
 * Uses `electron-builder --win --dir` (the unpacked target needs no Wine). The
 * NSIS installer target does need Wine, so it is left to CI (windows-latest);
 * see .github/workflows/build-windows.yml.
 *
 * The icon, .exe version-info (Company/Description/Version) and the ASAR
 * integrity fuse are all applied by the electron-builder `afterPack` hook
 * (scripts/afterPack.mjs), so nothing extra is needed here.
 *
 * The version is read from xpos/__init__.py (the single source of truth) so the
 * unpacked build matches what CI/semantic-release publishes.
 *
 * Usage:  node scripts/build-win.mjs
 */

import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const initPy = path.join(root, "..", "xpos", "__init__.py");
const match = readFileSync(initPy, "utf8").match(/__version__\s*=\s*["']([^"']+)["']/);
const version = match ? match[1] : "0.0.0";
console.log(`[build-win] Building X POS v${version} ...`);

spawnSync(
	"npx",
	["electron-builder", "--win", "--dir", `--config.extraMetadata.version=${version}`],
	{ cwd: root, stdio: "inherit", shell: true }
);

const exePath = path.join(root, "release", "win-unpacked", "X POS.exe");
if (!existsSync(exePath)) {
	console.error(`[build-win] ERROR: exe not found at ${exePath}`);
	console.error("[build-win] electron-builder failed before win-unpacked was created.");
	process.exit(1);
}

console.log(
	`\n[build-win] Done! Branded X POS v${version} at:\n  ${exePath}\n` +
		"[build-win] Copy release/win-unpacked/ to a Windows machine and run 'X POS.exe'."
);
