import { toID } from './lib/protocol.js';

const $ = (id) => document.getElementById(id);

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { enabled: true, tiers: ['gen4ou'], notifications: true, ...settings };
}
async function saveSettings(patch) {
  await chrome.storage.local.set({ settings: { ...(await getSettings()), ...patch } });
}

function ago(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
}

async function render() {
  const s = await getSettings();
  const { status = {}, log = [] } = await chrome.storage.local.get(['status', 'log']);

  $('notif').checked = s.notifications;
  $('pollNow').disabled = !s.enabled;

  $('tiers').replaceChildren(...s.tiers.map((t) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = t;
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.title = `Remove ${t}`;
    x.onclick = () => saveSettings({ tiers: s.tiers.filter((v) => v !== t) });
    chip.append(x);
    return chip;
  }));
  if (!s.tiers.length) $('tiers').innerHTML = '<span class="hint">No tier: nothing is being watched.</span>';

  if (!s.enabled) {
    $('status').textContent = 'paused';
    $('status').className = 'status';
  } else {
    $('status').textContent = status.connected ? `connected · ${status.liveCount || 0} live` : 'disconnected';
    $('status').className = `status ${status.connected ? 'ok' : 'off'}`;
  }
  $('status').title = s.enabled ? 'Pause monitoring' : 'Resume monitoring';
  $('meta').textContent = `Last poll: ${ago(status.lastPollAt)}`;
  $('log').textContent = log.slice(-60).join('\n');
}

// La pastille sert d'interrupteur : pause / reprise de la surveillance.
$('status').onclick = async () => saveSettings({ enabled: !(await getSettings()).enabled });
$('notif').onchange = (e) => saveSettings({ notifications: e.target.checked });

$('addTier').onsubmit = async (e) => {
  e.preventDefault();
  const add = $('tierInput').value.split(/[,\s]+/).map(toID).filter(Boolean);
  if (!add.length) return;
  const { tiers } = await getSettings();
  await saveSettings({ tiers: [...new Set([...tiers, ...add])] });
  $('tierInput').value = '';
};

$('openLib').onclick = async () => {
  await chrome.runtime.sendMessage({ type: 'openLibrary' });
  window.close();
};

$('pollNow').onclick = async () => {
  $('pollNow').disabled = true;
  await chrome.runtime.sendMessage({ type: 'pollNow' });
  $('pollNow').disabled = false;
};

$('copyLog').onclick = async () => {
  const { log = [], status = {}, settings = {} } = await chrome.storage.local.get(['log', 'status', 'settings']);
  await navigator.clipboard.writeText([`settings: ${JSON.stringify(settings)}`, `status: ${JSON.stringify(status)}`, ...log].join('\n'));
  $('copyLog').textContent = 'Copied';
  setTimeout(() => { $('copyLog').textContent = 'Copy log'; }, 1200);
};

$('clearLog').onclick = () => chrome.storage.local.set({ log: [] });

chrome.storage.onChanged.addListener((c) => { if (c.settings || c.status || c.log) render(); });
render();
setInterval(render, 5000);
