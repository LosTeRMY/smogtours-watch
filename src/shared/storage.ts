// Accès à chrome.storage.local, partagé par le popup et la bibliothèque.

import { useEffect, useState } from 'react';

export interface Settings {
  enabled: boolean; // surveillance active (false = pause)
  tiers: string[];
  notifications: boolean;
}

export interface Status {
  connected?: boolean;
  paused?: boolean;
  lastPollAt?: number;
  liveCount?: number;
}

export const DEFAULT_SETTINGS: Settings = { enabled: true, tiers: ['gen4ou'], notifications: true };

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings>) };
}

// Fusionne un changement dans les réglages (ex. saveSettings({ enabled: false })).
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set({ settings: { ...(await getSettings()), ...patch } });
}

// Hook React : lit une clé de chrome.storage.local et se met à jour dès qu'elle change.
// Ex. const status = useStorage<Status>('status', {});
export function useStorage<T>(key: string, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    chrome.storage.local.get(key).then((r) => setValue((r[key] as T) ?? fallback));
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && key in changes) setValue((changes[key].newValue as T) ?? fallback);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange); // nettoyage quand le composant disparaît
  }, [key]);

  return value;
}

// Réglages avec les valeurs par défaut appliquées.
export function useSettings(): Settings {
  const stored = useStorage<Partial<Settings>>('settings', {});
  return { ...DEFAULT_SETTINGS, ...stored };
}
