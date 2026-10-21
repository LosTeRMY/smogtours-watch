// Statut d'un match dans la colonne Replay (composant Figma « Statut ») :
// Replay ↗ / live ↗ / fetching… / not fetched ↻.

import { useState } from "react";
import { CLIENT_URL } from "../lib/protocol.js";
import type { Match } from "../lib/types";

export default function StatusCell({ m }: { m: Match }) {
  const [retrying, setRetrying] = useState(false);

  if (m.status === "saved" && m.replayUrl) {
    return (
      <a className="link" href={m.replayUrl} target="_blank" rel="noopener">
        Replay ↗
      </a>
    );
  }
  if (m.status === "live") {
    return (
      <a
        className="tag live"
        href={`${CLIENT_URL}/${m.roomid}`}
        target="_blank"
        rel="noopener">
        live ↗
      </a>
    );
  }
  if (m.status === "ended") return <span className="tag">fetching…</span>;
  if (m.status === "missing") {
    async function retry() {
      setRetrying(true);
      await chrome.runtime.sendMessage({
        type: "retryReplay",
        roomid: m.roomid,
      });
    }
    return (
      <button className="tag missing" title="Retry fetching" onClick={retry}>
        {retrying ? "…" : "not fetched ↻"}
      </button>
    );
  }
  return <span className="tag">{m.status || "?"}</span>;
}
