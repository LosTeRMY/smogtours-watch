// Une ligne de la liste des joueurs : nom + nombre de matchs (composant Figma « Ligne joueur »).

import type { Player } from "../lib/types";

interface Props {
  player: Player;
  active: boolean;
  onSelect: (id: string) => void;
}

export default function PlayerRow({ player, active, onSelect }: Props) {
  return (
    <button
      className={"player" + (active ? " active" : "")}
      onClick={() => onSelect(player.id)}>
      <span className="name">{player.name}</span>
      <span className="count">{player.count}</span>
    </button>
  );
}
