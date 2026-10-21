// Colonne de gauche : recherche, tri, « All matches », liste des joueurs, « Trash (N) ».
// memo : la liste n'est redessinée que si ses props changent (pas à chaque changement de page).

import { memo } from "react";
import type { Player } from "../lib/types";
import { filterPlayers, type PlayerSort } from "./data";
import { TrashIcon } from "./icons";
import PlayerRow from "./PlayerRow";

interface Props {
  players: Player[];
  search: string;
  sort: PlayerSort;
  selected: string | null; // joueur sélectionné
  inTrash: boolean;
  allCount: number;
  trashCount: number;
  onSearch: (q: string) => void;
  onSort: (s: PlayerSort) => void;
  onSelect: (id: string | null) => void; // null = All matches
  onTrash: () => void;
}

function PlayerList(props: Props) {
  const { players, search, sort, selected, inTrash, allCount, trashCount } =
    props;
  const list = filterPlayers(players, search, sort);

  return (
    <aside className="players">
      {/* Recherche + tri des joueurs */}
      <div className="players-tools">
        <input
          type="search"
          placeholder="Player…"
          autoComplete="off"
          value={search}
          onChange={(e) => props.onSearch(e.target.value)}
        />
        <select
          title="Sort players"
          value={sort}
          onChange={(e) => props.onSort(e.target.value as PlayerSort)}>
          <option value="az">A → Z</option>
          <option value="count">Match count</option>
          <option value="recent">Latest match</option>
        </select>
      </div>

      {/* Entrée « All matches » */}
      <button
        className={
          "player all" + (selected === null && !inTrash ? " active" : "")
        }
        onClick={() => props.onSelect(null)}>
        <span className="name">All matches</span>
        <span className="count">{allCount}</span>
      </button>

      {/* Liste des joueurs */}
      <ul className="player-list">
        {list.map((p) => (
          <li key={p.id}>
            <PlayerRow
              player={p}
              active={p.id === selected}
              onSelect={props.onSelect}
            />
          </li>
        ))}
        {!list.length && players.length > 0 && (
          <li className="hint pad">No players found.</li>
        )}
      </ul>

      {/* Entrée « Trash (N) », masquée si la corbeille est vide */}
      {trashCount > 0 && (
        <button
          className={"player trash" + (inTrash ? " active" : "")}
          onClick={props.onTrash}>
          <TrashIcon />
          <span className="name">Trash</span>
          <span className="count">{trashCount}</span>
        </button>
      )}
    </aside>
  );
}

export default memo(PlayerList);
