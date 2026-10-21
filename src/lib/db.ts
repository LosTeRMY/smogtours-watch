// IndexedDB : un enregistrement par match, clé = roomid.
// Partagée entre le service worker et la page bibliothèque.

import { toID } from "./protocol";
import type { Match } from "./types";

const STORE = "matches";
let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("smogtours-watch", 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: "roomid" });
      s.createIndex("ids", "ids", { multiEntry: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

const reqP = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const t = (await open()).transaction(STORE, mode);
  const done = new Promise((resolve, reject) => {
    t.oncomplete = resolve;
    t.onerror = t.onabort = () => reject(t.error);
  });
  const result = await fn(t.objectStore(STORE));
  await done;
  return result;
}

// Pseudos normalisés du match, pour l'index "ids".
const idsOf = (m: Partial<Match>) => [m.p1, m.p2].filter(Boolean).map(toID);

export const getMatch = (roomid: string) =>
  tx("readonly", (s) => reqP(s.get(roomid) as IDBRequest<Match | undefined>));
export const allMatches = () =>
  tx("readonly", (s) => reqP(s.getAll() as IDBRequest<Match[]>));
export const clearMatches = () => tx("readwrite", (s) => reqP(s.clear()));
export const deleteMatch = (roomid: string) =>
  tx("readwrite", (s) => reqP(s.delete(roomid)));

// Fusionne un patch dans le match (ou le crée). Les valeurs undefined sont ignorées.
export function saveMatch(
  roomid: string,
  patch: Partial<Match>,
): Promise<Match> {
  return tx("readwrite", async (s) => {
    const cur: Match = (await reqP(
      s.get(roomid) as IDBRequest<Match | undefined>,
    )) || { roomid, ids: [] };
    for (const [k, v] of Object.entries(patch))
      if (v !== undefined) (cur as any)[k] = v;
    cur.ids = idsOf(cur);
    await reqP(s.put(cur));
    return cur;
  });
}

export const importMatches = (records: Match[]) =>
  tx("readwrite", async (s) => {
    for (const r of records) await reqP(s.put({ ...r, ids: idsOf(r) }));
  });
