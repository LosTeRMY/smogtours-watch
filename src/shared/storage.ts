// Hooks React pour lire chrome.storage.local (popup et bibliothèque).

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

export { saveSettings, type Settings, type Status } from "./settings";

// Hook React : lit une clé de chrome.storage.local et se met à jour dès qu'elle change.
// Ex. const status = useStorage<Status>('status', {});
export function useStorage<T>(key: string, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    chrome.storage.local
      .get(key)
      .then((r) => setValue((r[key] as T) ?? fallback));
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === "local" && key in changes)
        setValue((changes[key].newValue as T) ?? fallback);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange); // nettoyage quand le composant disparaît
  }, [key]);

  return value;
}

// Réglages avec les valeurs par défaut appliquées.
export function useSettings(): Settings {
  const stored = useStorage<Partial<Settings>>("settings", {});
  return { ...DEFAULT_SETTINGS, ...stored };
}
