import { allMatches, importMatches, saveMatch } from './lib/db.js';
import { toID, CLIENT_URL } from './lib/protocol.js';
import {
  splitTrash, buildPlayers, filterPlayers, recordOf, tiersOf, opponentOf,
  filterMatches, sortMatches, isWinner, isLoser, resultFor, paginate, pagerItems,
} from './library/data';

const $ = (id) => document.getElementById(id);

let matches = [];  // matchs visibles (hors corbeille)
let trash = [];    // matchs en corbeille (deletedAt)
let selected = null; // id normalisé du joueur, ou null = tous
let inTrash = false; // vue Corbeille
let page = 1;
let playersKey = '';
let tiersKey = '';

function select(id) {
  selected = id;
  inTrash = false;
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

// ---------- joueurs ----------
function renderPlayers() {
  const players = buildPlayers(matches);
  const q = $('search').value;
  const sort = $('playerSort').value;
  const list = filterPlayers(players, q, sort);

  $('allCount').textContent = matches.length;
  $('allBtn').classList.toggle('active', selected === null && !inTrash);
  $('trashBtn').hidden = !trash.length;
  $('trashBtn').classList.toggle('active', inTrash);
  $('trashCount').textContent = trash.length;

  // On ne redessine la liste que si elle a vraiment changé.
  const key = [selected, toID(q), sort, ...list.map((p) => `${p.id}:${p.name}:${p.count}`)].join('|');
  if (key !== playersKey) {
    playersKey = key;
    const ul = $('playerList');
    ul.replaceChildren(...list.map((p) => el('li', {},
      el('button', {
        class: 'player' + (p.id === selected ? ' active' : ''),
        onclick: () => select(p.id),
      },
        el('span', { class: 'name' }, p.name),
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

// ---------- corbeille ----------
const TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';

async function setDeleted(roomid, deletedAt) {
  await saveMatch(roomid, { deletedAt });
  await chrome.storage.local.set({ dbRev: Date.now() }); // prévient les autres pages
  load();
}

// Cellule Replay + corbeille (visible au survol de la ligne).
function replayCell(m) {
  const del = el('button', { class: 'del', type: 'button', title: 'Delete', onclick: () => setDeleted(m.roomid, Date.now()) });
  del.innerHTML = TRASH_ICON;
  return el('td', {}, el('div', { class: 'replay-cell' }, statusCell(m), del));
}

function renderMatches(players) {
  const tier = $('tierFilter').value;
  const sort = $('matchSort').value;
  const player = players.find((p) => p.id === selected);

  if (selected && !player) selected = null;
  if (inTrash && !trash.length) inTrash = false; // corbeille vidée : retour à tous les matchs

  const list = sortMatches(filterMatches(inTrash ? trash : matches, selected, tier), sort, selected);

  if (inTrash) {
    $('title').textContent = 'Trash';
    $('record').textContent = `${list.length} matches · emptied when the library closes`;
  } else if (player) {
    $('title').textContent = player.name;
    const r = recordOf(player);
    $('record').textContent = `${player.count} matches · ${r.w} W – ${r.l} L${r.total ? ` (${r.pct}%)` : ''}`;
  } else {
    $('title').textContent = 'All matches';
    $('record').textContent = `${list.length} matches`;
  }

  const head = inTrash
    ? ['Date', 'Tier', 'Player 1', 'Player 2', '']
    : selected
      ? ['Date', 'Tier', 'Opponent', 'Result', 'Replay']
      : ['Date', 'Tier', 'Player 1', 'Player 2', 'Replay'];
  $('thead').replaceChildren(el('tr', {}, ...head.map((h) => el('th', {}, h))));

  const pg = paginate(list, page);
  page = pg.page;
  const rows = pg.rows.map((m) => {
    const date = m.startedAt ? fmtDate.format(new Date(m.startedAt)) : '—';
    if (inTrash) {
      return el('tr', {},
        el('td', { class: 'num' }, date),
        el('td', {}, el('span', { class: 'tier' }, m.format || '?')),
        el('td', {}, m.p1 || '?'),
        el('td', {}, m.p2 || '?'),
        el('td', {}, el('button', { class: 'linkbtn', type: 'button', onclick: () => setDeleted(m.roomid, null) }, 'Restore')),
      );
    }
    if (selected) {
      const opp = opponentOf(m, selected);
      const r = resultFor(m, selected);
      return el('tr', {},
        el('td', { class: 'num' }, date),
        el('td', {}, el('span', { class: 'tier' }, m.format || '?')),
        el('td', {}, el('button', {
          class: 'plink', onclick: () => select(toID(opp)),
        }, opp || '?')),
        el('td', {}, el('span', { class: 'res ' + r.cls }, r.text)),
        replayCell(m),
      );
    }
    const pbtn = (name) => name ? el('button', {
      class: 'plink' + (isWinner(m, name) ? ' won' : ''),
      onclick: () => select(toID(name)),
    }, name) : '?';
    const cellClass = (name) => (isWinner(m, name) ? 'winner' : isLoser(m, name) ? 'loser' : null);
    return el('tr', {},
      el('td', { class: 'num' }, date),
      el('td', {}, el('span', { class: 'tier' }, m.format || '?')),
      el('td', { class: cellClass(m.p1) }, pbtn(m.p1)),
      el('td', { class: cellClass(m.p2) }, pbtn(m.p2)),
      replayCell(m),
    );
  });
  $('rows').replaceChildren(...rows);
  $('empty').hidden = list.length > 0;
  $('empty').textContent = inTrash ? 'Trash is empty.' : EMPTY_TEXT;
  renderPager(pg.pages);
}

// ‹ 1 2 3 … 200 › : masquée s'il n'y a qu'une page.
function renderPager(pages) {
  const nav = $('pager');
  nav.hidden = pages <= 1;
  if (pages <= 1) return;

  const go = (n) => () => { page = n; renderMatches(buildPlayers(matches)); $('tableWrap').scrollTop = 0; };
  const items = [el('button', { class: 'pg chevron', title: 'Previous page', disabled: page === 1 ? '' : null, onclick: go(page - 1) }, '‹')];
  for (const n of pagerItems(page, pages)) {
    items.push(n === null
      ? el('span', { class: 'pg-gap' }, '…')
      : el('button', { class: 'pg' + (n === page ? ' active' : ''), onclick: go(n) }, String(n)));
  }
  items.push(el('button', { class: 'pg chevron', title: 'Next page', disabled: page === pages ? '' : null, onclick: go(page + 1) }, '›'));
  nav.replaceChildren(...items);
}

function renderTierFilter() {
  const sel = $('tierFilter');
  const cur = sel.value;
  const tiers = tiersOf(matches);
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
  ({ matches, trash } = splitTrash(await allMatches()));
  renderAll();
}

// ---------- export / import ----------
$('export').onclick = async () => {
  const kept = (await allMatches()).filter((m) => !m.deletedAt); // la corbeille n'est pas exportée
  const data = { app: 'smogtours-watch', version: 1, exportedAt: new Date().toISOString(), matches: kept };
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
const EMPTY_TEXT = $('empty').textContent;
$('allBtn').onclick = () => select(null);
$('trashBtn').onclick = () => { selected = null; inTrash = true; page = 1; renderAll(); };
$('search').oninput = renderPlayers;
$('playerSort').onchange = renderPlayers;
$('tierFilter').onchange = () => { page = 1; renderMatches(buildPlayers(matches)); };
$('matchSort').onchange = () => { page = 1; renderMatches(buildPlayers(matches)); };

// Plusieurs matchs peuvent changer d'un coup : on regroupe les rechargements.
let reloadTimer = null;
chrome.storage.onChanged.addListener((c, area) => {
  if (area !== 'local' || !c.dbRev) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(load, 300);
});

load();
