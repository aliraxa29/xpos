/**
 * Auto-update module using electron-updater.
 *
 * Checks for updates on app start and periodically.
 * Communicates update status to the renderer via IPC events:
 *   update-available, update-downloaded, update-error, update-progress
 */

import { autoUpdater, type UpdateInfo, type ProgressInfo } from "electron-updater";
import { BrowserWindow, ipcMain } from "electron";
import { createLogger } from "./logger";

const log = createLogger("AutoUpdater");

let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;

function emitToAllWindows(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

/**
 * Initialize auto-updater. Call once after app.whenReady().
 *
 * @param feedUrl Optional custom update feed URL. If not provided,
 *   electron-updater uses the publish config from electron-builder.yml.
 */
export function initAutoUpdater(feedUrl?: string): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  if (feedUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
  }

  autoUpdater.on("checking-for-update", () => {
    emitToAllWindows("update-status", { status: "checking" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    emitToAllWindows("update-status", {
      status: "available",
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("update-not-available", () => {
    emitToAllWindows("update-status", { status: "up-to-date" });
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    emitToAllWindows("update-status", {
      status: "downloading",
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    emitToAllWindows("update-status", {
      status: "downloaded",
      version: info.version,
    });
  });

  autoUpdater.on("error", (err: Error) => {
    log.error(err.message);
    emitToAllWindows("update-status", {
      status: "error",
      error: err.message,
    });
  });

  ipcMain.handle("update:check", async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, version: result?.updateInfo?.version };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("update:download", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("update:install", () => {
    autoUpdater.quitAndInstall(false, true);
  });
  
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 10_000);

  updateCheckInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, CHECK_INTERVAL_MS);

  log.info("Initialized");
}

export function stopAutoUpdater(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}
