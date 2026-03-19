/**
 * Renderer-side handler for sync engine IPC messages.
 *
 * The Electron main process sync engine sends pull batches and status updates
 * via IPC. This module listens for those messages and writes data to IndexedDB.
 *
 * Only active in Electron mode – no-op in browser/PWA.
 */
import { isElectron } from "@/services/electronBridge";
import {
  upsertPullBatch,
  setMeta,
  updatePendingInvoice,
  updatePendingPurchase,
  deletePendingInvoice,
  deletePendingPurchase,
  getAllPendingInvoices,
  getAllPendingPurchases,
  type PendingInvoice,
  type PendingPurchase,
} from "@/services/idbService";

type CleanupFn = () => void;
const cleanups: CleanupFn[] = [];

/**
 * Initialize sync IPC listeners. Call once from App.vue onMounted.
 * Returns a cleanup function for onUnmounted.
 */
export function initSyncListeners(): () => void {
  if (!isElectron() || !window.electronAPI) {
    return () => {};
  }

  // Listen for pull batches from sync engine
  const onPullBatch = (_event: unknown, data: {
    store: string;
    doctype: string;
    records: Record<string, unknown>[];
    isIncremental: boolean;
  }) => {
    upsertPullBatch(data.store, data.records, data.isIncremental).catch((err) =>
      console.error("[SyncIPC] Failed to upsert pull batch:", err)
    );
  };

  // Listen for metadata updates
  const onUpdateMeta = (_event: unknown, data: { key: string; value: unknown }) => {
    setMeta(data.key, data.value).catch((err) =>
      console.error("[SyncIPC] Failed to update meta:", err)
    );
  };

  // Listen for record status updates (syncing/failed)
  const onUpdateStatus = (_event: unknown, data: {
    store: string;
    id: number;
    status: string;
    error?: string;
    retry_count?: number;
  }) => {
    if (data.store === "pendingInvoices") {
      getAllPendingInvoices().then((records) => {
        const record = records.find((r) => r.id === data.id);
        if (record) {
          record.status = data.status as PendingInvoice["status"];
          if (data.error) record.error = data.error;
          if (data.retry_count !== undefined) record.retry_count = data.retry_count;
          updatePendingInvoice(record);
        }
      });
    } else if (data.store === "pendingPurchases") {
      getAllPendingPurchases().then((records) => {
        const record = records.find((r) => r.id === data.id);
        if (record) {
          record.status = data.status as PendingPurchase["status"];
          if (data.error) record.error = data.error;
          if (data.retry_count !== undefined) record.retry_count = data.retry_count;
          updatePendingPurchase(record);
        }
      });
    }
  };

  // Listen for record deletion (successfully synced)
  const onDeleteRecord = (_event: unknown, data: { store: string; id: number }) => {
    if (data.store === "pendingInvoices") {
      deletePendingInvoice(data.id);
    } else if (data.store === "pendingPurchases") {
      deletePendingPurchase(data.id);
    }
  };

  // Register IPC listeners via the preload bridge
  // The electronAPI doesn't directly expose these specific channels,
  // so we listen on the window for custom events dispatched by the preload.
  // However, since we're using contextBridge, we need to add these to preload.
  // For now, we use window message events as a bridge pattern.
  if (typeof window !== "undefined") {
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const { channel, payload } = event.data as { channel?: string; payload?: unknown };
      if (!channel) return;

      switch (channel) {
        case "sync-pull-batch":
          onPullBatch(null, payload as Parameters<typeof onPullBatch>[1]);
          break;
        case "sync-update-meta":
          onUpdateMeta(null, payload as Parameters<typeof onUpdateMeta>[1]);
          break;
        case "sync-update-record-status":
          onUpdateStatus(null, payload as Parameters<typeof onUpdateStatus>[1]);
          break;
        case "sync-delete-record":
          onDeleteRecord(null, payload as Parameters<typeof onDeleteRecord>[1]);
          break;
      }
    };

    window.addEventListener("message", handler);
    cleanups.push(() => window.removeEventListener("message", handler));
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  };
}
