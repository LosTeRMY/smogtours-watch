// La bibliothèque complète : garde l'état de la vue (joueur, filtres, page) et assemble les composants.

import { useCallback, useMemo, useState } from "react";
import {
  buildPlayers,
  filterMatches,
  sortMatches,
  tiersOf,
  type MatchSort,
  type PlayerSort,
} from "./data";
import { setDeleted } from "./actions";
import { useMatches } from "./useMatches";
import { useFixedWindowSize } from "./useFixedWindowSize";
import TopBar from "./TopBar";
import PlayerList from "./PlayerList";
import MatchPanel from "./MatchPanel";
import type { View } from "./MatchRow";

export default function Library() {
  useFixedWindowSize();
  const { matches, trash, reload } = useMatches();

  // État de la vue
  const [selected, setSelected] = useState<string | null>(null); // joueur sélectionné, null = tous
  const [inTrash, setInTrash] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [playerSort, setPlayerSort] = useState<PlayerSort>("az");
  const [tier, setTier] = useState("");
  const [matchSort, setMatchSort] = useState<MatchSort>("date");

  // Données calculées (useMemo : recalculées seulement si leurs entrées changent)
  const players = useMemo(() => buildPlayers(matches), [matches]);
  const tiers = useMemo(() => tiersOf(matches), [matches]);
  const player = selected
    ? (players.find((p) => p.id === selected) ?? null)
    : null;

  // Joueur disparu ou corbeille vidée : on retombe sur All matches.
  const view: View =
    inTrash && trash.length ? "trash" : player ? "player" : "all";
  const pid = view === "player" ? selected : null;
  const tierValue = tiers.includes(tier) ? tier : "";

  const list = useMemo(
    () =>
      sortMatches(
        filterMatches(view === "trash" ? trash : matches, pid, tierValue),
        matchSort,
        pid,
      ),
    [view, trash, matches, pid, tierValue, matchSort],
  );

  // Actions (useCallback : mêmes fonctions d'un rendu à l'autre, pour que PlayerList ne se redessine pas)
  const selectPlayer = useCallback((id: string | null) => {
    setSelected(id);
    setInTrash(false);
    setPage(1);
  }, []);
  const openTrash = useCallback(() => {
    setSelected(null);
    setInTrash(true);
    setPage(1);
  }, []);
  const onDelete = useCallback(
    async (roomid: string) => {
      await setDeleted(roomid, Date.now());
      reload();
    },
    [reload],
  );
  const onRestore = useCallback(
    async (roomid: string) => {
      await setDeleted(roomid, null);
      reload();
    },
    [reload],
  );

  return (
    <>
      <TopBar matches={matches} playerCount={players.length} />
      <main className="cols">
        <PlayerList
          players={players}
          search={search}
          sort={playerSort}
          selected={view === "player" ? selected : null}
          inTrash={view === "trash"}
          allCount={matches.length}
          trashCount={trash.length}
          onSearch={setSearch}
          onSort={setPlayerSort}
          onSelect={selectPlayer}
          onTrash={openTrash}
        />
        <MatchPanel
          view={view}
          player={player}
          list={list}
          tiers={tiers}
          tier={tierValue}
          sort={matchSort}
          page={page}
          onTier={(t) => {
            setTier(t);
            setPage(1);
          }}
          onSort={(s) => {
            setMatchSort(s);
            setPage(1);
          }}
          onPage={setPage}
          onSelectPlayer={selectPlayer}
          onDelete={onDelete}
          onRestore={onRestore}
        />
      </main>
    </>
  );
}
