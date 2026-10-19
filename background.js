// Service worker : surveille les combats smogtours des tiers choisis,
// notifie au démarrage d'un match et enregistre le replay à la fin.
//
// Cycle d'un match :
//   apparaît dans le roomlist  -> "live" (+ notification)
//   disparaît du roomlist      -> "ended", on cherche le replay
//   replay trouvé              -> "saved"  /  pas trouvé après les relances -> "missing"

import { SERVER_URL, CLIENT_URL, REPLAY_BASE, toID, formatOf, replayIdOf, parseReplay } from './lib/protocol.js';
import { getMatch, saveMatch, clearMatches } from './lib/db.js';

const POLL_MS = 10_000;
const TIMEOUT_MS = 8_000;
const FRESH_MS = 90_000; // au-delà, on a pu rater des choses : pas de notification au réveil
const RETRY_DELAYS = [5, 15, 30, 60, 120, 300].map((s) => s * 1000);
const LOG_MAX = 200;
const DEFAULT_SETTINGS = { tiers: ['gen4ou'], notifications: true };

// ---------- journal ----------
let logBuf = null;
let logTimer = null;
async function log(...parts) {
  const line = `${new Date().toLocaleTimeString('fr-FR')} ${parts.join(' ')}`;
  console.log('[smogtours-watch]', line);
  logBuf ??= (await chrome.storage.local.get('log')).log || [];
  logBuf.push(line);
  logBuf.splice(0, logBuf.length - LOG_MAX);
  clearTimeout(logTimer);
  logTimer = setTimeout(() => chrome.storage.local.set({ log: logBuf }), 500);
}

// ---------- stockage ----------
async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  const s = { ...DEFAULT_SETTINGS, ...settings };
  s.tiers = [...new Set(s.tiers.map(toID).filter(Boolean))];
  return s;
}

// state = { live: {roomid: format}, pending: [{roomid, attempt, next}], lastPollAt }
async function getState() {
  const { state } = await chrome.storage.local.get('state');
  return { live: {}, pending: [], lastPollAt: 0, ...state };
}
const saveState = (state) => chrome.storage.local.set({ state });
const setStatus = (status) => chrome.storage.local.set({ status });
const libraryChanged = () => chrome.storage.local.set({ dbRev: Date.now() });

// Une seule opération sur l'état à la fois.
let chain = Promise.resolve();
function exclusive(fn) {
  const run = chain.then(fn);
  chain = run.catch((e) => log('error', e?.message || e));
  return run;
}

// ---------- connexion ----------
let ws = null;
let waiter = null;
let pollTimer = null;

function connect() {
  if (ws) return;
  log('connecting to', SERVER_URL);
  ws = new WebSocket(SERVER_URL);
  ws.onopen = () => {
    log('connected');
    setStatus({ connected: true });
    clearInterval(pollTimer);
    pollTimer = setInterval(poll, POLL_MS);
    poll();
  };
  ws.onmessage = (ev) => onMessage(String(ev.data));
  ws.onclose = () => {
    log('disconnected');
    ws = null;
    clearInterval(pollTimer);
    pollTimer = null;
    waiter?.reject(new Error('disconnected'));
    waiter = null;
    setStatus({ connected: false });
    setTimeout(ensureRunning, 5000);
  };
}

function onMessage(data) {
  const prefix = '|queryresponse|roomlist|';
  for (const line of data.split('\n')) {
    if (line.startsWith(prefix) && waiter) {
      const w = waiter;
      waiter = null;
      clearTimeout(w.timer);
      try { w.resolve(JSON.parse(line.slice(prefix.length))?.rooms || {}); } catch (e) { w.reject(e); }
    } else if (line.startsWith('|popup|') || line.startsWith('|error|')) {
      log('server:', line.slice(0, 200));
    }
  }
}

// Une requête à la fois : les réponses du serveur ne disent pas à quel tier elles correspondent.
function queryRoomlist(tier) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiter = null; reject(new Error('no response')); }, TIMEOUT_MS);
    waiter = { resolve, reject, timer };
    ws.send(`|/cmd roomlist ${tier}`);
  });
}

// ---------- sondage ----------
function poll() {
  return exclusive(async () => {
    const settings = await getSettings();
    const state = await getState();
    const now = Date.now();

    const seen = new Map();    // roomid -> {p1, p2}
    const checked = new Set(); // tiers dont on a bien reçu la liste
    if (ws?.readyState === WebSocket.OPEN) {
      for (const tier of settings.tiers) {
        try {
          for (const [roomid, info] of Object.entries(await queryRoomlist(tier))) {
            if (formatOf(roomid) === tier) seen.set(roomid, info);
          }
          checked.add(tier);
        } catch (e) {
          log('roomlist', tier, ':', e.message);
        }
      }
    }

    let changed = false;

    // Nouveaux matchs
    const notify = settings.notifications && now - state.lastPollAt < FRESH_MS;
    for (const [roomid, { p1, p2 }] of seen) {
      if (state.live[roomid] || (await getMatch(roomid))) continue;
      const format = formatOf(roomid);
      state.live[roomid] = format;
      await saveMatch(roomid, { format, p1, p2, startedAt: now, status: 'live' });
      if (notify) notifyStart(roomid, format, p1, p2);
      log('match', roomid, p1, 'vs', p2);
      changed = true;
    }

    // Matchs terminés : absents d'une liste bien reçue, ou tier retiré des réglages
    for (const [roomid, format] of Object.entries(state.live)) {
      if (seen.has(roomid)) continue;
      if (settings.tiers.includes(format) && !checked.has(format)) continue; // liste non reçue : on attend
      delete state.live[roomid];
      state.pending.push({ roomid, attempt: 0, next: now + RETRY_DELAYS[0] });
      await saveMatch(roomid, { status: 'ended' });
      log('ended', roomid);
      changed = true;
    }

    if (checked.size) state.lastPollAt = now;
    if (await fetchPendingReplays(state)) changed = true;
    await saveState(state);
    await setStatus({ connected: ws?.readyState === WebSocket.OPEN, lastPollAt: state.lastPollAt, liveCount: Object.keys(state.live).length });
    if (changed) libraryChanged();
  });
}

// ---------- replays ----------
// Renvoie true si un match a changé de statut.
async function fetchPendingReplays(state) {
  const now = Date.now();
  const remaining = [];
  let changed = false;
  for (const job of state.pending) {
    if (job.next > now) { remaining.push(job); continue; }
    if (await fetchReplay(job.roomid)) { changed = true; continue; }
    job.attempt++;
    if (job.attempt < RETRY_DELAYS.length) {
      job.next = now + RETRY_DELAYS[job.attempt];
      remaining.push(job);
    } else {
      await saveMatch(job.roomid, { status: 'missing' });
      log('replay not found', job.roomid);
      changed = true;
    }
  }
  state.pending = remaining;
  return changed;
}

async function fetchReplay(roomid) {
  const id = replayIdOf(roomid);
  try {
    const res = await fetch(`${REPLAY_BASE}/${id}.json`, { cache: 'no-store' });
    if (!res.ok) return false;
    const r = parseReplay(await res.json());
    await saveMatch(roomid, {
      ...r,
      startedAt: r.startedAt ?? undefined,
      format: r.format ?? undefined,
      replayUrl: `${REPLAY_BASE}/${id}`,
      status: 'saved',
    });
    log('replay', id);
    return true;
  } catch (e) {
    log('replay', id, ':', e.message);
    return false;
  }
}

// ---------- notification ----------
function notifyStart(roomid, format, p1, p2) {
  chrome.notifications.create(roomid, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `${format} — match started`,
    message: `${p1 || '?'} vs ${p2 || '?'}`,
    contextMessage: 'smogtours · clic pour regarder',
  });
}

chrome.notifications.onClicked.addListener((id) => {
  chrome.tabs.create({ url: `${CLIENT_URL}/${id}` });
  chrome.notifications.clear(id);
});

// ---------- cycle de vie ----------
async function ensureRunning() {
  const { tiers } = await getSettings();
  if (tiers.length) connect();
  else poll(); // rien à surveiller, mais on termine les replays en attente
}

chrome.alarms.create('keepalive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(ensureRunning);
chrome.runtime.onStartup.addListener(ensureRunning);

chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  // Les versions 1.0.0 / 1.0.1 se connectaient au serveur principal : on repart de zéro.
  if (reason === 'update' && /^1\.0\.[01]$/.test(previousVersion)) {
    await clearMatches();
    await chrome.storage.local.remove(['state', 'lastGoodUrl']);
    libraryChanged();
    log(`updated from ${previousVersion}: library cleared`);
  }
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...settings } });
  ensureRunning();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.log?.newValue?.length === 0) logBuf = [];
  if (changes.settings) ensureRunning();
});

// Bibliothèque : une seule fenêtre dédiée. La taille exacte (1100 × 620 de contenu)
// est corrigée par library.js une fois la fenêtre ouverte.
async function openLibrary() {
  const url = chrome.runtime.getURL('library.html');
  const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['popup'] });
  const existing = wins.find((w) => w.tabs?.some((t) => t.url === url));
  if (existing) {
    await chrome.windows.update(existing.id, { focused: true, drawAttention: true });
    return;
  }
  await chrome.windows.create({ url, type: 'popup', width: 1100, height: 620 });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'openLibrary') {
    openLibrary().then(() => sendResponse(true), () => sendResponse(false));
    return true;
  }
  if (msg?.type === 'pollNow') {
    ensureRunning().then(poll).then(() => sendResponse(true), () => sendResponse(false));
    return true;
  }
  if (msg?.type === 'retryReplay') {
    exclusive(async () => {
      const state = await getState();
      if (!state.pending.some((j) => j.roomid === msg.roomid)) {
        state.pending.push({ roomid: msg.roomid, attempt: 0, next: 0 });
      }
      await saveState(state);
    }).then(poll).then(() => sendResponse(true), () => sendResponse(false));
    return true;
  }
});

ensureRunning();
