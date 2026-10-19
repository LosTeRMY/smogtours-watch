import { toID } from './lib/protocol.js';

const $ = (id) => document.getElementById(id);

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { tiers: ['gen4ou'], notifications: true, ...settings };
}
async function saveSettings(patch) {
  await chrome.storage.local.set({ settings: { ...(await getSettings()), ...patch } });
}

function ago(ts) {
  if (!ts) return 'jamais';
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 60 ? `il y a ${s} s` : `il y a ${Math.round(s / 60)} min`;
}

async function render() {
  const s = await getSettings();
  const { status = {}, log = [] } = await chrome.storage.local.get(['status', 'log']);

  $('notif').checked = s.notifications;

  $('tiers').replaceChildren(...s.tiers.map((t) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = t;
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.title = `Retirer ${t}`;
    x.onclick = () => saveSettings({ tiers: s.tiers.filter((v) => v !== t) });
    chip.append(x);
    return chip;
  }));
  if (!s.tiers.length) $('tiers').innerHTML = '<span class="hint">Aucun tier : rien n\'est surveillé.</span>';

  $('status').textContent = status.connected ? `connecté · ${status.liveCount || 0} en cours` : 'déconnecté';
  $('status').className = `status ${status.connected ? 'ok' : 'off'}`;
  $('meta').textContent = `Dernier sondage : ${ago(status.lastPollAt)}`;
  $('log').textContent = log.slice(-60).join('\n');
}

$('notif').onchange = (e) => saveSettings({ notifications: e.target.checked });

$('addTier').onsubmit = async (e) => {
  e.preventDefault();
  const add = $('tierInput').value.split(/[,\s]+/).map(toID).filter(Boolean);
  if (!add.length) return;
  const { tiers } = await getSettings();
  await saveSettings({ tiers: [...new Set([...tiers, ...add])] });
  $('tierInput').value = '';
};

$('openLib').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('library.html') });

$('pollNow').onclick = async () => {
  $('pollNow').disabled = true;
  await chrome.runtime.sendMessage({ type: 'pollNow' });
  $('pollNow').disabled = false;
};

$('copyLog').onclick = async () => {
  const { log = [], status = {}, settings = {} } = await chrome.storage.local.get(['log', 'status', 'settings']);
  await navigator.clipboard.writeText([`settings: ${JSON.stringify(settings)}`, `status: ${JSON.stringify(status)}`, ...log].join('\n'));
  $('copyLog').textContent = 'Copié';
  setTimeout(() => { $('copyLog').textContent = 'Copier le journal'; }, 1200);
};

$('clearLog').onclick = () => chrome.storage.local.set({ log: [] });

chrome.storage.onChanged.addListener((c) => { if (c.settings || c.status || c.log) render(); });
render();
setInterval(render, 5000);
