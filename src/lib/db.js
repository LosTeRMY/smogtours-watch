// IndexedDB : un enregistrement par match, clé = roomid.
// Partagée entre le service worker et la page bibliothèque.

import { toID } from './protocol.js';

const STORE = 'matches';
let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('smogtours-watch', 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'roomid' });
      s.createIndex('ids', 'ids', { multiEntry: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

const reqP = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function tx(mode, fn) {
  const t = (await open()).transaction(STORE, mode);
  const done = new Promise((resolve, reject) => {
    t.oncomplete = resolve;
    t.onerror = t.onabort = () => reject(t.error);
  });
  const result = await fn(t.objectStore(STORE));
  await done;
  return result;
}

export const getMatch = (roomid) => tx('readonly', (s) => reqP(s.get(roomid)));
export const allMatches = () => tx('readonly', (s) => reqP(s.getAll()));
export const clearMatches = () => tx('readwrite', (s) => reqP(s.clear()));
export const deleteMatch = (roomid) => tx('readwrite', (s) => reqP(s.delete(roomid)));

// Fusionne un patch dans le match (ou le crée). Les valeurs undefined sont ignorées.
export function saveMatch(roomid, patch) {
  return tx('readwrite', async (s) => {
    const cur = (await reqP(s.get(roomid))) || { roomid };
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) cur[k] = v;
    cur.ids = [cur.p1, cur.p2].filter(Boolean).map(toID);
    await reqP(s.put(cur));
    return cur;
  });
}

export const importMatches = (records) => tx('readwrite', async (s) => {
  for (const r of records) await reqP(s.put({ ...r, ids: [r.p1, r.p2].filter(Boolean).map(toID) }));
});
