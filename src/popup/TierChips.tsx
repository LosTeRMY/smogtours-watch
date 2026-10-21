// Tiers surveillés : une chip par tier (× pour retirer) + champ d'ajout (composant Figma « Chip tier »).

import { useState, type FormEvent } from "react";
import { toID } from "../lib/protocol.js";

interface Props {
  tiers: string[];
  onChange: (tiers: string[]) => void;
}

export default function TierChips({ tiers, onChange }: Props) {
  const [input, setInput] = useState(""); // texte en cours de saisie

  function add(e: FormEvent) {
    e.preventDefault(); // pas de rechargement de la page
    const added = input
      .split(/[,\s]+/)
      .map(toID)
      .filter(Boolean);
    if (!added.length) return;
    onChange([...new Set([...tiers, ...added])]);
    setInput("");
  }

  return (
    <>
      <div className="chips">
        {tiers.length ? (
          tiers.map((t) => (
            <span className="chip" key={t}>
              {t}
              <button
                type="button"
                title={`Remove ${t}`}
                onClick={() => onChange(tiers.filter((v) => v !== t))}>
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="hint">No tier: nothing is being watched.</span>
        )}
      </div>
      <form className="add" onSubmit={add}>
        <input
          placeholder="e.g. gen4ou, gen7ou, gen4ubers"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
      <p className="hint">
        The tier ID is the one in a match URL: battle-<b>gen4ou</b>-123456
      </p>
    </>
  );
}
