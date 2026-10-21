// Types partagés : une fiche de match telle qu'enregistrée dans IndexedDB (lib/db.js).

export type MatchStatus = "live" | "ended" | "saved" | "missing";

export interface Match {
  roomid: string; // "battle-gen4ou-123456" (clé)
  ids: string[]; // pseudos normalisés (index multiEntry)
  format?: string | null; // "gen4ou"
  p1?: string | null;
  p2?: string | null;
  status?: MatchStatus;
  startedAt?: number | null;
  endedAt?: number | null;
  winner?: string | null;
  tie?: boolean;
  forfeit?: boolean;
  replayUrl?: string;
  deletedAt?: number | null; // en corbeille si renseigné
}

// Un joueur, agrégé à partir des matchs.
export interface Player {
  id: string; // pseudo normalisé
  name: string; // dernier pseudo vu
  count: number;
  w: number;
  l: number;
  last: number; // date du dernier match
}
