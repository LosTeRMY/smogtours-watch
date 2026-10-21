// Protocole Pokémon Showdown : ce dont l'extension a besoin, rien de plus.

export const SERVER_URL = "wss://sim3.psim.us:8001/showdown/websocket"; // smogtours (port 8001)
export const CLIENT_URL = "https://smogtours.psim.us";
export const REPLAY_BASE = "https://replay.pokemonshowdown.com";

// Identifiant normalisé Showdown : minuscules, uniquement a-z0-9.
export function toID(text: unknown): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// "battle-gen4ou-981643" -> "gen4ou"
export function formatOf(roomid: string): string | null {
  return /^battle-([a-z0-9]+)-\d+$/.exec(roomid)?.[1] ?? null;
}

// "battle-gen4ou-981643" -> "smogtours-gen4ou-981643"
export function replayIdOf(roomid: string): string {
  return roomid.replace(/^battle-/, "smogtours-");
}

// JSON d'un replay (replay.pokemonshowdown.com/<id>.json), champs utiles seulement.
interface ReplayJSON {
  log?: string;
  players?: string[];
  formatid?: string;
  uploadtime?: number;
}

// Lit le JSON d'un replay.
export function parseReplay(data: ReplayJSON) {
  const log = String(data.log || "");
  const [p1 = null, p2 = null] = data.players || [];
  const startedAt = Number(/\|t:\|(\d+)/.exec(log)?.[1]) * 1000 || null;
  return {
    format: data.formatid || null,
    p1,
    p2,
    winner: /\|win\|([^\n|]+)/.exec(log)?.[1].trim() ?? null,
    tie: /\n\|tie(\||\n|$)/.test(log),
    forfeit: /\|-message\|[^\n]*forfeited\./.test(log),
    startedAt,
    endedAt: data.uploadtime ? data.uploadtime * 1000 : null,
  };
}
