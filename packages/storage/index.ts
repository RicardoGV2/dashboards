import { validateDocument } from "../document/index.ts";
import type { CanvasDocument } from "../document/index.ts";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("infinite-dashboard-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("documents");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Storage is blocked by another tab."));
  });
}
export async function load(): Promise<CanvasDocument | null> {
  const db = await open();
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = db
        .transaction("documents")
        .objectStore("documents")
        .get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return value == null ? null : validateDocument(value);
  } finally {
    db.close();
  }
}
export async function save(document: CanvasDocument): Promise<void> {
  const valid = validateDocument(document);
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite");
      const store = tx.objectStore("documents");
      const prior = store.get("current");
      prior.onsuccess = () => {
        if (prior.result) store.put(prior.result, "previous");
        store.put(valid, "current");
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
