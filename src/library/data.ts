// Logique de la bibliothèque, sans rien toucher au DOM : filtres, tris, stats, pagination.
// Ces fonctions seront réutilisées telles quelles par les composants React.

import { toID } from '../lib/protocol.js';
import type { Match, Player } from '../lib/types';

export const PAGE_SIZE = 10;

export type PlayerSort = 'az' | 'count' | 'recent';
export type MatchSort = 'date' | 'opp' | 'tier';

// Sépare les matchs visibles de ceux en corbeille.
export function splitTrash(all: Match[]): { matches: Match[]; trash: Match[] } {
  return {
    matches: all.filter((m) => !m.deletedAt),
    trash: all.filter((m) => m.deletedAt),
  };
}

// ---------- joueurs ----------
export function buildPlayers(matches: Match[]): Player[] {
  const map = new Map<string, Player>();
  const sorted = [...matches].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
  for (const m of sorted) {
    for (const name of [m.p1, m.p2]) {
      if (!name) continue;
      const id = toID(name);
      const p = map.get(id) || { id, name, count: 0, w: 0, l: 0, last: 0 };
      p.name = name; // dernier pseudo vu
      p.count++;
      p.last = Math.max(p.last, m.startedAt || 0);
      if (m.status === 'saved' && m.winner) {
        if (toID(m.winner) === id) p.w++;
        else p.l++;
      }
      map.set(id, p);
    }
  }
  return [...map.values()];
}

export function filterPlayers(players: Player[], query: string, sort: PlayerSort): Player[] {
  const q = toID(query);
  const list = players.filter((p) => !q || p.id.includes(q));
  return list.sort((a, b) => {
    if (sort === 'count') return b.count - a.count || a.id.localeCompare(b.id);
    if (sort === 'recent') return b.last - a.last;
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  });
}

// Bilan d'un joueur : victoires, défaites, pourcentage.
export function recordOf(p: Player): { w: number; l: number; total: number; pct: number } {
  const total = p.w + p.l;
  return { w: p.w, l: p.l, total, pct: total ? Math.round((p.w / total) * 100) : 0 };
}

// ---------- matchs ----------
export function tiersOf(matches: Match[]): string[] {
  return [...new Set(matches.map((m) => m.format).filter((f): f is string => !!f))].sort();
}

// Adversaire du joueur pid dans ce match.
export function opponentOf(m: Match, pid: string): string {
  return toID(m.p1) === pid ? m.p2 || '' : m.p1 || '';
}

export function filterMatches(source: Match[], pid: string | null, tier: string): Match[] {
  return source.filter((m) => (!pid || m.ids?.includes(pid)) && (!tier || m.format === tier));
}

export function sortMatches(list: Match[], sort: MatchSort, pid: string | null): Match[] {
  return [...list].sort((a, b) => {
    if (sort === 'opp' && pid) {
      return opponentOf(a, pid).localeCompare(opponentOf(b, pid), 'en', { sensitivity: 'base' });
    }
    if (sort === 'tier') {
      return (a.format || '').localeCompare(b.format || '') || (b.startedAt || 0) - (a.startedAt || 0);
    }
    return (b.startedAt || 0) - (a.startedAt || 0);
  });
}

export function isWinner(m: Match, name: string | null | undefined): boolean {
  return !!name && !!m.winner && toID(m.winner) === toID(name);
}

export function isLoser(m: Match, name: string | null | undefined): boolean {
  return !!name && !!m.winner && !isWinner(m, name);
}

// Résultat du match du point de vue du joueur pid.
export function resultFor(m: Match, pid: string): { text: string; cls: '' | 'tie' | 'win' | 'loss' } {
  if (m.status !== 'saved') return { text: '—', cls: '' };
  if (m.tie) return { text: 'Draw', cls: 'tie' };
  if (!m.winner) return { text: '?', cls: '' };
  const won = toID(m.winner) === pid;
  return { text: won ? 'W' : 'L', cls: won ? 'win' : 'loss' };
}

// ---------- pagination ----------
export function paginate<T>(list: T[], page: number, size = PAGE_SIZE): { rows: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(page, 1), pages);
  return { rows: list.slice((p - 1) * size, p * size), page: p, pages };
}

// Numéros affichés dans ‹ 1 2 3 … 200 › ; null = « … ».
export function pagerItems(page: number, pages: number): (number | null)[] {
  const shown = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 2) [1, 2, 3].forEach((n) => shown.add(n));
  if (page >= pages - 1) [pages - 2, pages - 1, pages].forEach((n) => shown.add(n));
  const nums = [...shown].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  const items: (number | null)[] = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) items.push(null);
    items.push(n);
    prev = n;
  }
  return items;
}
