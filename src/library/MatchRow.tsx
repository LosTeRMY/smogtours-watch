// Une ligne du tableau (composant Figma « Ligne match »), selon la vue :
// - all    : Date · Tier · Player 1 · Player 2 · Replay (gagnant en vert, perdant en rouge)
// - player : Date · Tier · Opponent · Result · Replay
// - trash  : Date · Tier · Player 1 · Player 2 · Restore

import { toID } from "../lib/protocol";
import type { Match } from "../lib/types";
import { isLoser, isWinner, opponentOf, resultFor } from "./data";
import { TrashIcon } from "./icons";
import StatusCell from "./StatusCell";

export type View = "all" | "player" | "trash";

const fmtDate = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

interface Props {
  m: Match;
  view: View;
  pid: string | null; // joueur sélectionné (vue player)
  onSelectPlayer: (id: string) => void;
  onDelete: (roomid: string) => void;
  onRestore: (roomid: string) => void;
}

export default function MatchRow({
  m,
  view,
  pid,
  onSelectPlayer,
  onDelete,
  onRestore,
}: Props) {
  const date = m.startedAt ? fmtDate.format(new Date(m.startedAt)) : "—";
  const dateCell = <td className="num">{date}</td>;
  const tierCell = (
    <td>
      <span className="tier">{m.format || "?"}</span>
    </td>
  );

  // Cellule Replay + corbeille (visible au survol de la ligne, cf. .del dans ui.css).
  const replayCell = (
    <td>
      <div className="replay-cell">
        <StatusCell m={m} />
        <button
          className="del"
          type="button"
          title="Delete"
          onClick={() => onDelete(m.roomid)}>
          <TrashIcon />
        </button>
      </div>
    </td>
  );

  if (view === "trash") {
    return (
      <tr>
        {dateCell}
        {tierCell}
        <td>{m.p1 || "?"}</td>
        <td>{m.p2 || "?"}</td>
        <td>
          <button
            className="linkbtn"
            type="button"
            onClick={() => onRestore(m.roomid)}>
            Restore
          </button>
        </td>
      </tr>
    );
  }

  if (view === "player" && pid) {
    const opp = opponentOf(m, pid);
    const r = resultFor(m, pid);
    return (
      <tr>
        {dateCell}
        {tierCell}
        <td>
          <button className="plink" onClick={() => onSelectPlayer(toID(opp))}>
            {opp || "?"}
          </button>
        </td>
        <td>
          <span className={"res " + r.cls}>{r.text}</span>
        </td>
        {replayCell}
      </tr>
    );
  }

  // Vue all : un bouton par joueur, case colorée selon gagnant / perdant.
  const playerCell = (name: string | null | undefined) => (
    <td
      className={
        isWinner(m, name) ? "winner" : isLoser(m, name) ? "loser" : undefined
      }>
      {name ? (
        <button
          className={"plink" + (isWinner(m, name) ? " won" : "")}
          onClick={() => onSelectPlayer(toID(name))}>
          {name}
        </button>
      ) : (
        "?"
      )}
    </td>
  );

  return (
    <tr>
      {dateCell}
      {tierCell}
      {playerCell(m.p1)}
      {playerCell(m.p2)}
      {replayCell}
    </tr>
  );
}
