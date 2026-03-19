/**
 * Windows build script — works on Linux without Wine.
 *
 * electron-builder embeds an asar integrity hash into the exe using Wine.
 * On Linux (no Wine), the hash is never embedded, but the Electron fuse
 * EnableEmbeddedAsarIntegrityValidation is still ON → "Invalid package app.asar"
 * at runtime on Windows.
 *
 * This script:
 *   1. Runs electron-builder --win (creates win-unpacked, then fails at Wine step)
 *   2. Uses @electron/fuses to flip the integrity fuse OFF in the exe
 *
 * Usage:  node scripts/build-win.mjs
 */

import { spawnSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { flipFuses, FuseVersion, FuseV1Options } from "@electron/fuses";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// ── Step 1: Run electron-builder --win ────────────────────────────
// It will fail at the Wine-required step, but win-unpacked will exist.
console.log("[build-win] Running electron-builder --win ...");
const result = spawnSync(
  "npx",
  ["electron-builder", "--win"],
  { cwd: root, stdio: "inherit", shell: true }
);

// ── Step 2: Check that win-unpacked was produced ──────────────────
const exePath = path.join(root, "release", "win-unpacked", "X POS.exe");
if (!existsSync(exePath)) {
  console.error(`[build-win] ERROR: exe not found at ${exePath}`);
  console.error("[build-win] The packaging step failed before win-unpacked was created.");
  process.exit(1);
}

// ── Step 3: Flip the asar integrity fuse OFF in the Windows exe ───
// This is a pure binary patch; no Wine needed.
console.log(`[build-win] Patching fuse: disabling ASAR integrity check in ${exePath} ...`);
try {
  await flipFuses(exePath, {
    version: FuseVersion.V1,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
  });
  console.log("[build-win] Fuse patched successfully.");
} catch (err) {
  console.error("[build-win] Failed to patch fuse:", err.message);
  process.exit(1);
}

console.log("\n[build-win] Done! Copy release/win-unpacked/ to your Windows machine and run 'X POS.exe'.");
