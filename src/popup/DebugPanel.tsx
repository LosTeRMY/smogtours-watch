// Section Debug (repliée) : dernier sondage, journal, boutons Copy log / Clear.

import { useEffect, useState } from 'react';
import { useStorage } from '../shared/storage';

function ago(ts: number | undefined, now: number): string {
  if (!ts) return 'never';
  const s = Math.round((now - ts) / 1000);
  return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
}

export default function DebugPanel({ lastPollAt }: { lastPollAt?: number }) {
  const log = useStorage<string[]>('log', []);
  const [copied, setCopied] = useState(false);

  // « il y a X s » doit avancer tout seul : on relit l'heure toutes les 5 s.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  async function copyLog() {
    const { log = [], status = {}, settings = {} } = await chrome.storage.local.get(['log', 'status', 'settings']);
    const lines = [`settings: ${JSON.stringify(settings)}`, `status: ${JSON.stringify(status)}`, ...(log as string[])];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <details className="block">
      <summary>Debug</summary>
      <p className="meta">Last poll: {ago(lastPollAt, now)}</p>
      <div className="row">
        <button onClick={copyLog}>{copied ? 'Copied' : 'Copy log'}</button>
        <button onClick={() => chrome.storage.local.set({ log: [] })}>Clear</button>
      </div>
      <pre className="log">{log.slice(-60).join('\n')}</pre>
    </details>
  );
}
