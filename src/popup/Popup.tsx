// Le popup complet : assemble les composants, de haut en bas.

import {
  saveSettings,
  useSettings,
  useStorage,
  type Status,
} from "../shared/storage";
import StatusPill from "./StatusPill";
import Switch from "./Switch";
import TierChips from "./TierChips";
import DebugPanel from "./DebugPanel";
import RefreshButton from "./RefreshButton";

export default function Popup() {
  const settings = useSettings();
  const status = useStorage<Status>("status", {});

  async function openLibrary() {
    await chrome.runtime.sendMessage({ type: "openLibrary" });
    window.close();
  }

  return (
    <>
      {/* Barre du haut : nom + pastille de statut */}
      <header className="bar">
        <span className="brand">
          <img src="/icons/icon48.png" alt="" />
          Smogtours Watch
        </span>
        <span className="spacer"></span>
        <StatusPill
          enabled={settings.enabled}
          connected={!!status.connected}
          onToggle={() => saveSettings({ enabled: !settings.enabled })}
        />
      </header>

      {/* Interrupteur des notifications */}
      <section className="block">
        <Switch
          label="Match notifications"
          checked={settings.notifications}
          onChange={(notifications) => saveSettings({ notifications })}
        />
      </section>

      {/* Tiers surveillés : chips + ajout */}
      <section className="block">
        <h2>Watched tiers</h2>
        <TierChips
          tiers={settings.tiers}
          onChange={(tiers) => saveSettings({ tiers })}
        />
      </section>

      {/* Boutons Open library / Refresh */}
      <section className="block row">
        <button className="primary" onClick={openLibrary}>
          Open library
        </button>
        <RefreshButton disabled={!settings.enabled} />
      </section>

      {/* Debug (replié) : dernier sondage + journal */}
      <DebugPanel lastPollAt={status.lastPollAt} />
    </>
  );
}
