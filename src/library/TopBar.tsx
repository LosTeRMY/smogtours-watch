// Barre du haut : titre, totaux, Export / Import, bouton thème.

import type { ChangeEvent } from "react";
import type { Match } from "../lib/types";
import { exportLibrary, importLibrary } from "./actions";
import ThemeButton from "./ThemeButton";

interface Props {
  matches: Match[];
  playerCount: number;
}

export default function TopBar({ matches, playerCount }: Props) {
  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const n = await importLibrary(file, matches);
      alert(`${n} matches imported.`);
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`);
    }
    e.target.value = ""; // permet de réimporter le même fichier
  }

  return (
    <header className="bar lib-bar">
      <span className="brand">
        <img src="/icons/icon48.png" alt="" />
        Replay library
      </span>
      <span className="meta">
        {matches.length} matches · {playerCount} players
      </span>
      <span className="spacer"></span>
      <button onClick={exportLibrary}>Export</button>
      <label className="btn">
        Import
        <input
          type="file"
          accept="application/json"
          hidden
          onChange={onImport}
        />
      </label>
      <ThemeButton />
    </header>
  );
}
