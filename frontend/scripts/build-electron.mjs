/**
 * Post-build script for Electron.
 * Ensures dist-electron/ has the built main + preload files
 * and dist/ has the renderer (Vue app) build.
 */
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const checks = [
  "dist/index.electron.html",
  "dist-electron/main.js",
  "dist-electron/preload.js",
];

let ok = true;
for (const file of checks) {
  const full = resolve(root, file);
  if (!existsSync(full)) {
    console.error(`[build-electron] Missing: ${file}`);
    ok = false;
  } else {
    console.log(`[build-electron] ✓ ${file}`);
  }
}

if (!ok) {
  console.error("[build-electron] Build incomplete. Check errors above.");
  process.exit(1);
}

console.log("[build-electron] Build verified successfully.");
