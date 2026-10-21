// Réglages et statut enregistrés dans chrome.storage.local.
// Sans React : utilisé aussi par le service worker.

import { toID } from "../lib/protocol";

export interface Settings {
  enabled: boolean; // surveillance active (false = pause)
  tiers: string[];
  notifications: boolean;
}

// Écrit par le service worker, lu par le popup.
export interface Status {
  connected?: boolean;
  paused?: boolean;
  lastPollAt?: number;
  liveCount?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  tiers: ["gen4ou"],
  notifications: true,
};

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  const s = { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings>) };
  s.tiers = [...new Set(s.tiers.map(toID).filter(Boolean))];
  return s;
}

// Fusionne un changement dans les réglages (ex. saveSettings({ enabled: false })).
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set({
    settings: { ...(await getSettings()), ...patch },
  });
}
