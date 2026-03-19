/**
 * Vite config for Electron builds.
 * Separate from the main vite.config.ts which targets the Frappe web PWA.
 *
 * Usage:
 *   yarn dev:electron    → Vite dev server + Electron window
 *   yarn build:electron  → Production build for packaging
 */
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import electron from "vite-plugin-electron";
import electronRenderer from "vite-plugin-electron-renderer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Stub out the virtual:pwa-register module so the renderer build
 * doesn't fail (PWA is only used in browser mode, not Electron).
 */
function stubPwaPlugin() {
  const virtualId = "virtual:pwa-register";
  return {
    name: "stub-pwa",
    resolveId(id: string) {
      if (id === virtualId) return "\0" + virtualId;
    },
    load(id: string) {
      if (id === "\0" + virtualId) {
        return "export function registerSW() { return () => {}; }";
      }
    },
  };
}

export default defineConfig({
  plugins: [
    vue(),
    stubPwaPlugin(),
    electron([
      {
        // Main process
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
      {
        // Preload script
        entry: "electron/preload.ts",
        onstart(args) {
          // Notify the renderer that preload is rebuilt
          args.reload();
        },
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  css: {
    postcss: "./postcss.config.js",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // In Electron mode, we use hash-based routing (no server to handle SPA fallback)
  base: "./",
  server: {
    port: 5175,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.electron.html"),
    },
  },
});
