// Partie droite : titre (joueur / All matches / Trash), filtres, tableau, pagination.

import { useRef } from "react";
import type { Match, Player } from "../lib/types";
import { paginate, recordOf, type MatchSort } from "./data";
import MatchRow, { type View } from "./MatchRow";
import Pager from "./Pager";

const HEADS: Record<View, string[]> = {
  all: ["Date", "Tier", "Player 1", "Player 2", "Replay"],
  player: ["Date", "Tier", "Opponent", "Result", "Replay"],
  trash: ["Date", "Tier", "Player 1", "Player 2", ""],
};

interface Props {
  view: View;
  player: Player | null; // joueur sélectionné (vue player)
  list: Match[]; // matchs filtrés et triés, toutes pages confondues
  tiers: string[];
  tier: string;
  sort: MatchSort;
  page: number;
  onTier: (t: string) => void;
  onSort: (s: MatchSort) => void;
  onPage: (n: number) => void;
  onSelectPlayer: (id: string) => void;
  onDelete: (roomid: string) => void;
  onRestore: (roomid: string) => void;
}

export default function MatchPanel(props: Props) {
  const { view, player, list } = props;
  const tableRef = useRef<HTMLDivElement>(null); // pour remonter en haut du tableau au changement de page
  const pg = paginate(list, props.page);

  let title = "All matches";
  let record = `${list.length} matches`;
  if (view === "trash") {
    title = "Trash";
    record = `${list.length} matches · emptied when the library closes`;
  } else if (view === "player" && player) {
    const r = recordOf(player);
    title = player.name;
    record = `${player.count} matches · ${r.w} W – ${r.l} L${r.total ? ` (${r.pct}%)` : ""}`;
  }

  function goTo(n: number) {
    props.onPage(n);
    if (tableRef.current) tableRef.current.scrollTop = 0;
  }

  return (
    <section className="detail">
      {/* Titre + filtres */}
      <div className="detail-head">
        <div>
          <h1>{title}</h1>
          <p className="meta">{record}</p>
        </div>
        <div className="filters">
          <select
            title="Filter by tier"
            value={props.tier}
            onChange={(e) => props.onTier(e.target.value)}>
            <option value="">All tiers</option>
            {props.tiers.map((t) => (
              <option value={t} key={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            title="Sort matches"
            value={props.sort}
            onChange={(e) => props.onSort(e.target.value as MatchSort)}>
            <option value="date">Date (newest)</option>
            <option value="opp">Opponent</option>
            <option value="tier">Tier</option>
          </select>
        </div>
      </div>

      {/* Tableau des matchs, pagination, message vide */}
      <div className="table-wrap" ref={tableRef}>
        <table>
          <thead>
            <tr>
              {HEADS[view].map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pg.rows.map((m) => (
              <MatchRow
                key={m.roomid}
                m={m}
                view={view}
                pid={player?.id ?? null}
                onSelectPlayer={props.onSelectPlayer}
                onDelete={props.onDelete}
                onRestore={props.onRestore}
              />
            ))}
          </tbody>
        </table>
        <Pager page={pg.page} pages={pg.pages} onPage={goTo} />
        {!list.length && (
          <p className="empty">
            {view === "trash"
              ? "Trash is empty."
              : "No matches yet. They will appear here as soon as a match in one of your tiers starts."}
          </p>
        )}
      </div>
    </section>
  );
}
