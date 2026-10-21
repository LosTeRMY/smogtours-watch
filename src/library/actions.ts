// Actions de la bibliothèque qui écrivent dans la base : corbeille, export, import.

import { allMatches, importMatches, saveMatch } from "../lib/db";
import type { Match } from "../lib/types";

// Prévient les autres pages (et le popup) qu'un match a changé.
const notifyChange = () => chrome.storage.local.set({ dbRev: Date.now() });

// Met un match à la corbeille (date) ou le restaure (null).
export async function setDeleted(
  roomid: string,
  deletedAt: number | null,
): Promise<void> {
  await saveMatch(roomid, { deletedAt });
  await notifyChange();
}

// Télécharge un JSON de toute la bibliothèque (la corbeille n'est pas exportée).
export async function exportLibrary(): Promise<void> {
  const kept = ((await allMatches()) as Match[]).filter((m) => !m.deletedAt);
  const data = {
    app: "smogtours-watch",
    version: 1,
    exportedAt: new Date().toISOString(),
    matches: kept,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `smogtours-replays-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Importe un JSON exporté : ajoute et met à jour, ne supprime rien.
// Renvoie le nombre de matchs importés.
export async function importLibrary(
  file: File,
  current: Match[],
): Promise<number> {
  const data = JSON.parse(await file.text());
  const list: Match[] = Array.isArray(data) ? data : data.matches;
  if (!Array.isArray(list)) throw new Error("unknown format");
  // On garde les replays déjà enregistrés plutôt qu'une version moins complète.
  const saved = new Set(
    current.filter((m) => m.status === "saved").map((m) => m.roomid),
  );
  const toPut = list.filter(
    (m) => m?.roomid && !(saved.has(m.roomid) && m.status !== "saved"),
  );
  await importMatches(toPut);
  await notifyChange();
  return toPut.length;
}
