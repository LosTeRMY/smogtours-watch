// Hook : charge tous les matchs depuis IndexedDB et les recharge quand le service worker
// signale un changement (clé dbRev dans chrome.storage).

import { useCallback, useEffect, useMemo, useState } from "react";
import { allMatches } from "../lib/db";
import type { Match } from "../lib/types";
import { splitTrash } from "./data";

export function useMatches() {
  const [all, setAll] = useState<Match[]>([]);

  const reload = useCallback(async () => {
    setAll((await allMatches()) as Match[]);
  }, []);

  useEffect(() => {
    reload();
    // Plusieurs matchs peuvent changer d'un coup : on regroupe les rechargements (300 ms).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local" || !changes.dbRev) return;
      clearTimeout(timer);
      timer = setTimeout(reload, 300);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      clearTimeout(timer);
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, [reload]);

  const { matches, trash } = useMemo(() => splitTrash(all), [all]);
  return { matches, trash, reload };
}
