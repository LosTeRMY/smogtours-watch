import { allMatches, importMatches } from './lib/db.js';
import { toID, CLIENT_URL } from './lib/protocol.js';

const $ = (id) => document.getElementById(id);

let matches = [];
let selected = null; // id normalisé du joueur, ou null = tous
let page = 1;
const PAGE_SIZE = 10;
let playersKey = '';
let tiersKey = '';

function select(id) {
  selected = id;
  page = 1;
  renderAll();
}

const fmtDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
});

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n[k] = v;
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of children) if (c != null) n.append(c);
  return n;
}

// ---------- agrégation par joueur ----------
function buildPlayers() {
  const map = new Map();
  const sorted = [...matches].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
  for (const m of sorted) {
    for (const name of [m.p1, m.p2]) {
      if (!name) continue;
      const id = toID(name);
      const p = map.get(id) || { id, name, count: 0, w: 0, l: 0, last: 0 };
      p.name = name; // dernier pseudo vu
      p.count++;
      p.last = Math.max(p.last, m.startedAt || 0);
      if (m.status === 'saved' && m.winner) {
        if (toID(m.winner) === id) p.w++; else p.l++;
      }
      map.set(id, p);
    }
  }
  return [...map.values()];
}

function renderPlayers() {
  const players = buildPlayers();
  const q = toID($('search').value);
  const sort = $('playerSort').value;
  const list = players.filter((p) => !q || p.id.includes(q));
  list.sort((a, b) => {
    if (sort === 'count') return b.count - a.count || a.id.localeCompare(b.id);
    if (sort === 'recent') return b.last - a.last;
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  });

  $('allCount').textContent = matches.length;
  $('allBtn').classList.toggle('active', selected === null);

  // On ne redessine la liste que si elle a vraiment changé.
  const key = [selected, q, sort, ...list.map((p) => `${p.id}:${p.name}:${p.count}:${p.w}:${p.l}`)].join('|');
  if (key !== playersKey) {
    playersKey = key;
    const ul = $('playerList');
    ul.replaceChildren(...list.map((p) => el('li', {},
      el('button', {
        class: 'player' + (p.id === selected ? ' active' : ''),
        onclick: () => select(p.id),
      },
        el('span', { class: 'name' }, p.name),
        el('span', { class: 'wl' }, `${p.w}-${p.l}`),
        el('span', { class: 'count' }, String(p.count)),
      ),
    )));
    if (!list.length && players.length) ul.append(el('li', { class: 'hint pad' }, 'No players found.'));
  }

  $('totals').textContent = `${matches.length} matches · ${players.length} players`;
  return players;
}

// ---------- liste des matchs ----------
function statusCell(m) {
  if (m.status === 'saved' && m.replayUrl) {
    return el('a', { href: m.replayUrl, target: '_blank', rel: 'noopener', class: 'link' }, 'Replay ↗');
  }
  if (m.status === 'live') {
    return el('a', { href: `${CLIENT_URL}/${m.roomid}`, target: '_blank', rel: 'noopener', class: 'tag live' }, 'live ↗');
  }
  if (m.status === 'ended') return el('span', { class: 'tag' }, 'fetching…');
  if (m.status === 'missing') {
    return el('button', {
      class: 'tag missing', title: 'Retry fetching',
      onclick: async (e) => {
        e.target.textContent = '…';
        await chrome.runtime.sendMessage({ type: 'retryReplay', roomid: m.roomid });
      },
    }, 'not fetched ↻');
  }
  return el('span', { class: 'tag' }, m.status || '?');
}

function resultFor(m, pid) {
  if (m.status !== 'saved') return { text: '—', cls: '' };
  if (m.tie) return { text: 'Draw', cls: 'tie' };
  if (!m.winner) return { text: '?', cls: '' };
  const won = toID(m.winner) === pid;
  return { text: won ? 'W' : 'L', cls: won ? 'win' : 'loss' };
}

function renderMatches(players) {
  const tier = $('tierFilter').value;
  const sort = $('matchSort').value;
  const player = players.find((p) => p.id === selected);

  if (selected && !player) selected = null;

  const list = matches.filter((m) => (!selected || m.ids?.includes(selected)) && (!tier || m.format === tier));

  const oppOf = (m) => {
    if (!selected) return '';
    return toID(m.p1) === selected ? (m.p2 || '') : (m.p1 || '');
  };
  list.sort((a, b) => {
    if (sort === 'opp' && selected) return oppOf(a).localeCompare(oppOf(b), 'en', { sensitivity: 'base' });
    if (sort === 'tier') return (a.format || '').localeCompare(b.format || '') || (b.startedAt || 0) - (a.startedAt || 0);
    return (b.startedAt || 0) - (a.startedAt || 0);
  });

  if (player) {
    $('title').textContent = player.name;
    const total = player.w + player.l;
    const pct = total ? Math.round((player.w / total) * 100) : 0;
    $('record').textContent = `${player.count} matches · ${player.w} W – ${player.l} L${total ? ` (${pct}%)` : ''}`;
  } else {
    $('title').textContent = 'All matches';
    $('record').textContent = `${list.length} matches`;
  }

  const head = selected
    ? ['Date', 'Tier', 'Opponent', 'Result', 'Replay']
    : ['Date', 'Tier', 'Player 1', 'Player 2', 'Winner', 'Replay'];
  $('thead').replaceChildren(el('tr', {}, ...head.map((h) => el('th', {}, h))));

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  page = Math.min(Math.max(page, 1), pages);
  const rows = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((m) => {
    const date = m.startedAt ? fmtDate.format(new Date(m.startedAt)) : '—';
    if (selected) {
      const opp = oppOf(m);
      const r = resultFor(m, selected);
      return el('tr', {},
        el('td', { class: 'num' }, date),
        el('td', {}, el('span', { class: 'tier' }, m.format || '?')),
        el('td', {}, el('button', {
          class: 'plink', onclick: () => select(toID(opp)),
        }, opp || '?')),
        el('td', {}, el('span', { class: 'res ' + r.cls }, r.text)),
        el('td', {}, statusCell(m)),
      );
    }
    const pbtn = (name) => name ? el('button', {
      class: 'plink' + (m.winner && toID(m.winner) === toID(name) ? ' won' : ''),
      onclick: () => select(toID(name)),
    }, name) : '?';
    return el('tr', {},
      el('td', { class: 'num' }, date),
      el('td', {}, el('span', { class: 'tier' }, m.format || '?')),
      el('td', {}, pbtn(m.p1)),
      el('td', {}, pbtn(m.p2)),
      el('td', {}, m.status === 'saved' ? (m.tie ? 'Draw' : (m.winner || '?')) : '—'),
      el('td', {}, statusCell(m)),
    );
  });
  $('rows').replaceChildren(...rows);
  $('empty').hidden = list.length > 0;
  renderPager(pages);
}

// ‹ 1 2 3 … 200 › : masquée s'il n'y a qu'une page.
function renderPager(pages) {
  const nav = $('pager');
  nav.hidden = pages <= 1;
  if (pages <= 1) return;

  const shown = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 2) [1, 2, 3].forEach((n) => shown.add(n));
  if (page >= pages - 1) [pages - 2, pages - 1, pages].forEach((n) => shown.add(n));
  const nums = [...shown].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  const go = (n) => () => { page = n; renderMatches(buildPlayers()); $('tableWrap').scrollTop = 0; };
  const items = [el('button', { class: 'pg chevron', title: 'Previous page', disabled: page === 1 ? '' : null, onclick: go(page - 1) }, '‹')];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) items.push(el('span', { class: 'pg-gap' }, '…'));
    items.push(el('button', { class: 'pg' + (n === page ? ' active' : ''), onclick: go(n) }, String(n)));
    prev = n;
  }
  items.push(el('button', { class: 'pg chevron', title: 'Next page', disabled: page === pages ? '' : null, onclick: go(page + 1) }, '›'));
  nav.replaceChildren(...items);
}

function renderTierFilter() {
  const sel = $('tierFilter');
  const cur = sel.value;
  const tiers = [...new Set(matches.map((m) => m.format).filter(Boolean))].sort();
  const key = tiers.join('|');
  if (key === tiersKey) return;
  tiersKey = key;
  sel.replaceChildren(el('option', { value: '' }, 'All tiers'),
    ...tiers.map((t) => el('option', { value: t }, t)));
  sel.value = tiers.includes(cur) ? cur : '';
}

function renderAll() {
  renderTierFilter();
  const players = renderPlayers();
  renderMatches(players);
}

async function load() {
  matches = await allMatches();
  renderAll();
}

// ---------- export / import ----------
$('export').onclick = async () => {
  const data = { app: 'smogtours-watch', version: 1, exportedAt: new Date().toISOString(), matches: await allMatches() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `smogtours-replays-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$('import').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.matches;
    if (!Array.isArray(list)) throw new Error('unknown format');
    // On garde les replays déjà enregistrés plutôt qu'une version moins complète.
    const saved = new Set(matches.filter((m) => m.status === 'saved').map((m) => m.roomid));
    const toPut = list.filter((m) => m?.roomid && !(saved.has(m.roomid) && m.status !== 'saved'));
    await importMatches(toPut);
    alert(`${toPut.length} matches imported.`);
    load();
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  }
  e.target.value = '';
};

// ---------- thème ----------
// L'icône montre le mode vers lequel on bascule (icônes Lucide moon et sun-dim).
const ICONS = {
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 4h.01"/><path d="M20 12h.01"/><path d="M12 20h.01"/><path d="M4 12h.01"/><path d="M17.657 6.343h.01"/><path d="M17.657 17.657h.01"/><path d="M6.343 17.657h.01"/><path d="M6.343 6.343h.01"/>',
};
function renderThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('theme').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${dark ? ICONS.sun : ICONS.moon}</svg>`;
  $('theme').title = dark ? 'Switch to light mode' : 'Switch to dark mode';
}
$('theme').onclick = () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  renderThemeButton();
};
renderThemeButton();

// ---------- taille fixe de la fenêtre (1100 × 620 de contenu) ----------
const CONTENT_W = 1100;
const CONTENT_H = 620;
let fixed = null; // { id, width, height } : taille extérieure voulue

async function fixWindowSize() {
  const win = await chrome.windows.getCurrent();
  if (win.type !== 'popup') return; // ouverte dans un onglet : rien à faire
  fixed = {
    id: win.id,
    width: win.width + (CONTENT_W - innerWidth),
    height: win.height + (CONTENT_H - innerHeight),
  };
  if (win.width !== fixed.width || win.height !== fixed.height) {
    await chrome.windows.update(win.id, { width: fixed.width, height: fixed.height });
  }
}

chrome.windows.onBoundsChanged.addListener((win) => {
  if (!fixed || win.id !== fixed.id) return;
  if (win.state === 'normal' && win.width === fixed.width && win.height === fixed.height) return;
  chrome.windows.update(win.id, { state: 'normal', width: fixed.width, height: fixed.height });
});

fixWindowSize();

// ---------- événements ----------
$('allBtn').onclick = () => select(null);
$('search').oninput = renderPlayers;
$('playerSort').onchange = renderPlayers;
$('tierFilter').onchange = () => { page = 1; renderMatches(buildPlayers()); };
$('matchSort').onchange = () => { page = 1; renderMatches(buildPlayers()); };

// Plusieurs matchs peuvent changer d'un coup : on regroupe les rechargements.
let reloadTimer = null;
chrome.storage.onChanged.addListener((c, area) => {
  if (area !== 'local' || !c.dbRev) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(load, 300);
});

load();
