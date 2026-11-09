/* 真实视口截图 + UI E2E + 运行时错误检查（Chrome DevTools Protocol，零依赖） */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts', 'shots');
const PROFILE = path.join(ROOT, 'artifacts', 'chrome-profile');
const PORT_START = 9333;

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chromePath) {
  console.error('Chrome/Edge not found.');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fileUri = `file:///${ROOT.replace(/\\/g, '/')}/index.html`;

function shot(name, query, width, height, options = {}) {
  return {
    name,
    query,
    width,
    height,
    waitFor: options.waitFor || null,
    click: options.click || null,
    after: options.after || null,
    delay: options.delay == null ? 500 : options.delay,
    timeout: options.timeout == null ? 16000 : options.timeout
  };
}

const SHOTS = [
  shot('01-title', '', 1440, 900, { waitFor: 'document.querySelector("#screen-title:not(.hidden)")' }),
  shot('02-story', '?dev=1&screen=story', 1440, 900, { waitFor: 'document.querySelector("#screen-story:not(.hidden)")', delay: 1800 }),
  shot('03-class', '?dev=1&screen=class', 1440, 900, { waitFor: 'document.querySelector("#screen-class:not(.hidden)")' }),
  shot('04-battle', '?dev=1&class=warrior&stage=3&seed=11&tokens=60&rice=2&skills=power,regen&slots=4&weapon=2&skipquestions=1', 1440, 900, {
    waitFor: 'window.__BQ_STAGE_READY === true',
    delay: 400
  }),
  shot('05-case', '?dev=1&class=mage&stage=4&seed=13&tokens=40&rice=1&skills=power&slots=4', 1440, 900, {
    waitFor: 'document.querySelector(".case-modal .case-option")',
    delay: 300
  }),
  shot('06-shop', '?dev=1&class=warrior&stage=5&seed=17&tokens=120&rice=2&skills=power,regen&slots=4&skipquestions=1&panel=shop', 1440, 900, {
    waitFor: 'document.querySelector(".modal-title") && document.querySelector(".modal-title").textContent.includes("回合结算")'
  }),
  shot('07-boss', '?dev=1&class=warrior&stage=10&seed=19&tokens=100&rice=2&skills=power,shieldwall&slots=4&weapon=4&skipquestions=1', 1440, 900, {
    waitFor: 'window.__BQ_STAGE_READY === true',
    delay: 400
  }),
  shot('08-intro', '?dev=1&screen=bossintro&boss=hallucination', 1440, 900, {
    waitFor: 'document.querySelector("#cine-root:not(.hidden) .cine-name")',
    delay: 900
  }),
  shot('09-dialogue', '?dev=1&class=warrior&stage=1&seed=21&tokens=60&skills=power&slots=4&panel=bossdialogue', 1440, 900, {
    waitFor: 'document.querySelector(".dialogue-choice")',
    delay: 300
  }),
  shot('10-rune', '?dev=1&class=mage&stage=40&seed=23&tokens=220&rice=2&skills=fireball,elemMastery&slots=5&weapon=7&skipquestions=1&panel=rune', 1440, 900, {
    waitFor: 'document.querySelector(".tile.rune") && window.__BQ_STAGE_READY === true',
    delay: 400
  }),
  shot('11-final', '?dev=1&class=warrior&stage=1&seed=25&tokens=80&skills=power&slots=4&panel=final', 1440, 900, {
    waitFor: 'document.querySelector(".final-choice")',
    delay: 300
  }),
  shot('12-ending-cg', '?dev=1&class=warrior&stage=1&seed=27&tokens=80&skills=power&slots=4&panel=ending-cookerFriend', 1440, 900, {
    waitFor: '(() => { const img = document.querySelector(".still-img"); return !!img && img.complete && img.naturalWidth > 0; })()',
    delay: 1100
  }),
  shot('13-ending-summary', '?dev=1&class=warrior&stage=1&seed=29&tokens=80&skills=power&slots=4&panel=ending-summary-trueEnd', 1440, 900, {
    waitFor: '(() => { const img = document.querySelector(".ending-summary-img"); return !!img && img.complete && img.naturalWidth > 0; })()',
    delay: 400
  }),
  shot('14-gallery', '?dev=1&screen=gallery&unlock=all', 1440, 900, {
    waitFor: 'document.querySelectorAll(".gallery-card.unlocked .gallery-thumb").length === 12 && Array.from(document.querySelectorAll(".gallery-thumb")).every((img) => img.complete && img.naturalWidth > 0)'
  }),
  shot('15-api', '?dev=1&screen=api', 1440, 900, {
    waitFor: 'document.querySelector(".api-form")'
  }),
  shot('16-mobile-battle', '?dev=1&class=mage&stage=6&seed=31&tokens=40&rice=1&skills=fireball,power&slots=4&skipquestions=1', 390, 844, {
    waitFor: 'window.__BQ_STAGE_READY === true',
    delay: 400
  }),
  shot('17-mobile-title', '', 390, 844, {
    waitFor: 'document.querySelector("#screen-title:not(.hidden)")'
  }),
  shot('18-mobile-case', '?dev=1&class=warrior&stage=4&seed=33&tokens=30&rice=1&skills=power&slots=4', 390, 844, {
    waitFor: 'document.querySelector(".case-modal .case-option")',
    delay: 300
  }),
  shot('19-boss-stun', '?dev=1&class=warrior&stage=10&seed=19&tokens=100&rice=2&skills=power,shieldwall&slots=4&weapon=4&skipquestions=1&stun=1', 1440, 900, {
    waitFor: 'window.__BQ_STAGE_READY === true && document.querySelector("#stun-chip:not(.hidden)")',
    delay: 400
  }),
  shot('20-six-monsters', '?dev=1&class=mage&stage=33&seed=5&tokens=120&weapon=8&skills=power,fireball&slots=4&skipquestions=1', 1440, 900, {
    waitFor: 'window.__BQ_STAGE_READY === true && document.querySelectorAll(".entity-monster").length === 6',
    delay: 400
  }),
  shot('21-rice-ending', '?dev=1&screen=ending-video', 1440, 900, {
    waitFor: 'document.querySelector("#cine-root:not(.hidden) .ending-video")',
    delay: 1600
  }),
  shot('22-ending-video', '?dev=1&class=warrior&stage=1&seed=41&tokens=80&skills=power&slots=4&panel=ending-openSource', 1440, 900, {
    waitFor: '(() => { const v = document.querySelector(".ending-video"); return !!v && !v.paused && v.currentTime > 0.4; })()',
    delay: 600
  }),
  shot('23-ending-still', '?dev=1&class=warrior&stage=1&seed=43&tokens=80&skills=power&slots=4&panel=ending-trueEnd', 1440, 900, {
    waitFor: '(() => { const img = document.querySelector(".still-img"); return !!img && img.complete && img.naturalWidth > 0; })()',
    delay: 900
  }),
  shot('24-mobile-ending', '?dev=1&class=mage&stage=1&seed=45&tokens=60&skills=power&slots=4&panel=ending-popularizer', 390, 844, {
    waitFor: '(() => { const img = document.querySelector(".still-img"); return !!img && img.complete && img.naturalWidth > 0; })()',
    delay: 900
  }),
  shot('25-dev-confirm', '', 1440, 900, {
    waitFor: 'document.querySelector("#screen-title:not(.hidden)")',
    click: '#btn-dev',
    after: 'document.querySelector(".dev-confirm-modal")',
    delay: 500
  })
];

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (err) {
        return;
      }
      if (message.id && this.pending.has(message.id)) {
        const entry = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message || 'CDP error'));
        else entry.resolve(message.result);
        return;
      }
      if (message.method) {
        (this.listeners.get(message.method) || []).slice().forEach((fn) => fn(message.params));
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket timeout')), 8000);
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('WebSocket error'));
      });
    });
    return new CDP(ws);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 20000);
    });
  }

  on(method, fn) {
    const list = this.listeners.get(method) || [];
    list.push(fn);
    this.listeners.set(method, list);
    return () => {
      this.listeners.set(method, (this.listeners.get(method) || []).filter((item) => item !== fn));
    };
  }

  once(method, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const off = this.on(method, (params) => {
        clearTimeout(timer);
        off();
        resolve(params);
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Event timeout: ${method}`));
      }, timeout);
    });
  }

  close() {
    try { this.ws.close(); } catch (err) { /* ignore */ }
  }
}

async function waitFor(cdp, expression, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
      if (result && result.result && result.result.value) return true;
    } catch (err) {
      /* navigation */
    }
    await sleep(150);
  }
  return false;
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || 'evaluate failed');
  }
  return response.result ? response.result.value : undefined;
}

async function navigate(cdp, url, waitExpression, timeout = 20000) {
  const loaded = cdp.once('Page.loadEventFired', 20000).catch(() => null);
  await cdp.send('Page.navigate', { url });
  await loaded;
  if (waitExpression && !(await waitFor(cdp, waitExpression, timeout))) {
    throw new Error('navigation wait failed: ' + url);
  }
}

async function click(cdp, selector) {
  return evaluate(cdp, `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
}

async function runTitleE2E(cdp) {
  await navigate(cdp, fileUri, 'document.querySelector("#screen-title:not(.hidden)")');
  if (!(await click(cdp, '#btn-api'))) throw new Error('E2E: API button not clickable');
  if (!(await waitFor(cdp, 'document.querySelector(".api-form")', 5000))) throw new Error('E2E: API settings modal did not open');
  await click(cdp, '.modal-actions .btn');
  if (!(await waitFor(cdp, 'document.querySelector(".api-result") && document.querySelector(".api-result").textContent.length > 0', 4000))) {
    throw new Error('E2E: API test did not return a result');
  }
  await click(cdp, '.modal-close');
  if (!(await waitFor(cdp, 'document.querySelector("#modal-root").classList.contains("hidden")', 3000))) {
    throw new Error('E2E: API modal did not close');
  }
  if (!(await click(cdp, '#btn-gallery'))) throw new Error('E2E: gallery button not clickable');
  if (!(await waitFor(cdp, 'document.querySelectorAll(".gallery-card").length >= 12', 5000))) {
    throw new Error('E2E: gallery modal did not open');
  }
  await click(cdp, '.modal-close');
  console.log('E2E: API settings and ending gallery buttons OK.');

  await click(cdp, '#btn-start');
  if (!(await waitFor(cdp, 'document.querySelector("#screen-story:not(.hidden)")', 3000))) {
    throw new Error('E2E: start button did not open the story');
  }
  await click(cdp, '#btn-story-next');
  if (!(await waitFor(cdp, 'document.querySelector("#screen-class:not(.hidden)")', 3000))) {
    throw new Error('E2E: story did not lead to class selection');
  }
  await click(cdp, '.class-card');
  if (!(await waitFor(cdp, 'window.__BQ_STAGE_READY === true', 20000))) {
    throw new Error('E2E: selecting a class did not start the battle');
  }
  const spawned = await evaluate(cdp, 'document.querySelectorAll(".entity-monster").length');
  const moves = await evaluate(cdp, 'document.querySelectorAll(".tile.reachable").length');
  if (spawned < 1) throw new Error('E2E: no monsters spawned on a normal game start');
  if (moves < 1) throw new Error('E2E: no adjacent move tiles on a normal game start');
  console.log('E2E: normal title → story → class → battle spawn and movement highlight OK.');
}

async function runBattleE2E(cdp) {
  const url = `${fileUri}?dev=1&class=warrior&stage=3&seed=99&tokens=80&rice=1&hp=120&stamina=1&skills=power&slots=4&weapon=2&atk=9999`;
  await navigate(cdp, url, 'window.__BQ_STAGE_READY === true');
  const reachable = await evaluate(cdp, 'document.querySelectorAll(".tile.reachable").length');
  if (reachable < 1 || reachable > 4) throw new Error('E2E: expected 1-4 adjacent move tiles, got ' + reachable);
  const art = await evaluate(cdp, `(async () => {
    const monster = document.querySelector('.entity-monster');
    const mapWidth = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth);
      img.onerror = () => resolve(0);
      img.src = 'assets/map/battle-map.webp';
    });
    const boardBg = getComputedStyle(document.querySelector('#board')).backgroundImage;
    return {
      portals: document.querySelectorAll('.portal-decal').length,
      portalImgs: Array.from(document.querySelectorAll('.portal-decal .portal-img')).every((img) => img.complete && img.naturalWidth > 0),
      monsterImg: !!(monster && monster.classList.contains('has-img') && monster.querySelector('.monster-img') && monster.querySelector('.monster-img').naturalWidth > 0),
      voiceBase: monster ? monster.dataset.sfxBase : '',
      mapWidth: mapWidth,
      boardBg: boardBg,
      sounds: window.BQ && window.BQ.Audio ? window.BQ.Audio.available() : []
    };
  })()`);
  if (art.portals !== 3) throw new Error('E2E: expected 3 portal decals, got ' + art.portals);
  if (!art.portalImgs) throw new Error('E2E: portal art failed to load');
  if (!art.mapWidth) throw new Error('E2E: battle map asset failed to load');
  if (!art.boardBg || art.boardBg.indexOf('battle-map.webp') < 0) throw new Error('E2E: board is not using the forest map');
  if (!art.monsterImg) throw new Error('E2E: monster pixel art failed to render');
  if (!art.voiceBase) throw new Error('E2E: monster voice was not attached');
  ['monsterSpawn', 'monsterMove', 'monsterAttack', 'monsterDeath'].forEach(function (name) {
    if (art.sounds.indexOf(name) < 0) throw new Error('E2E: missing audio ' + name);
  });
  const staminaBefore = await evaluate(cdp, 'document.querySelector("#stamina-num").textContent');
  await click(cdp, '.tile.reachable');
  await waitFor(cdp, `document.querySelector("#stamina-num").textContent !== ${JSON.stringify(staminaBefore)}`, 8000);
  const staminaAfter = await evaluate(cdp, 'document.querySelector("#stamina-num").textContent');
  if (staminaBefore === staminaAfter) {
    const stateAfter = await evaluate(cdp, 'window.__BQ_STATE ? JSON.stringify({pos: window.__BQ_STATE.player.pos, stamina: window.__BQ_STATE.player.stamina, phase: window.__BQ_STATE.phase, toast: document.querySelector("#toast-root").textContent}) : "no-state"');
    throw new Error('E2E: moving did not reduce stamina before=' + staminaBefore + ' after=' + staminaAfter + ' stateAfter=' + stateAfter);
  }
  await waitFor(cdp, 'window.__BQ_STAGE_READY === true', 8000);
  await sleep(200);
  await click(cdp, '#btn-rest');
  await waitFor(cdp, 'document.querySelector("#stamina-num").textContent !== ' + JSON.stringify(staminaAfter), 8000);
  const staminaRest = await evaluate(cdp, 'document.querySelector("#stamina-num").textContent');
  if (staminaRest === staminaAfter) throw new Error('E2E: rest did not restore stamina');

  for (let i = 0; i < 30; i += 1) {
    const hasReward = await evaluate(cdp, '!!document.querySelector("#modal-root:not(.hidden) .modal-title")');
    if (hasReward) break;
    const action = await evaluate(cdp, `(() => {
      const s = window.__BQ_STATE;
      if (!s) return 'no-state';
      const G = window.BQ.Grid;
      const p = s.player.pos;
      const inRange = s.monsters.filter((m) => G.manhattan(m.pos, p) <= s.player.stats.range && (s.player.stats.range <= 1 || G.hasLineOfSight(s.board, p, m.pos)));
      if (inRange.length) {
        const m = inRange[0];
        const el = document.querySelector('.tile[data-x="' + m.pos.x + '"][data-y="' + m.pos.y + '"]');
        if (el) { el.click(); return 'attack'; }
      }
      if (s.player.stamina < 1) {
        const rest = document.querySelector('#btn-rest');
        if (rest && !rest.disabled) { rest.click(); return 'rest'; }
      }
      const target = s.monsters.slice().sort((a, b) => G.manhattan(a.pos, p) - G.manhattan(b.pos, p))[0];
      if (!target) return 'none';
      const options = G.neighbors(s.board, p).filter((t) => !G.isBlocked(s.board, t.x, t.y) && !s.monsters.some((m) => m.pos.x === t.x && m.pos.y === t.y));
      if (!options.length) return 'blocked';
      options.sort((a, b) => G.manhattan(a, target.pos) - G.manhattan(b, target.pos));
      const el = document.querySelector('.tile[data-x="' + options[0].x + '"][data-y="' + options[0].y + '"]');
      if (el) { el.click(); return 'move'; }
      return 'no-tile';
    })()`);
    if (action === 'none' || action === 'no-state' || action === 'blocked') {
      await sleep(500);
      continue;
    }
    await sleep(450);
  }
  if (!(await waitFor(cdp, 'document.querySelector("#modal-root:not(.hidden) .modal-title") && document.querySelector("#modal-root:not(.hidden) .modal-title").textContent.includes("回合结算")', 12000))) {
    throw new Error('E2E: clearing all monsters did not open the reward panel');
  }
  await click(cdp, '.modal-actions .btn-primary');
  if (!(await waitFor(cdp, 'document.querySelector(".case-modal .case-panel:not(.hidden) .case-option")', 20000))) {
    throw new Error('E2E: next case level did not open the diagnosis step');
  }
  await click(cdp, '.case-panel:not(.hidden) .case-option');
  await click(cdp, '.case-footer .btn-primary');
  if (!(await waitFor(cdp, 'document.querySelectorAll(".case-panel:not(.hidden) .case-check").length >= 3', 5000))) {
    throw new Error('E2E: case check step did not appear');
  }
  await click(cdp, '.case-panel:not(.hidden) .case-check');
  await click(cdp, '.case-panel:not(.hidden) .case-check:nth-of-type(2)');
  await click(cdp, '.case-footer .btn-primary');
  if (!(await waitFor(cdp, 'document.querySelector(".case-panel:not(.hidden) .case-input")', 5000))) {
    throw new Error('E2E: case prescription step did not appear');
  }
  await click(cdp, '.case-panel:not(.hidden) .case-option');
  await click(cdp, '.case-footer .btn-primary');
  if (!(await waitFor(cdp, 'document.querySelector(".feedback-box")', 10000))) {
    throw new Error('E2E: case feedback did not appear');
  }
  await click(cdp, '.modal-actions .btn-primary');
  if (!(await waitFor(cdp, 'window.__BQ_STAGE_READY === true && document.querySelector("#stage-label").textContent.includes("第 4 / 40 关")', 15000))) {
    throw new Error('E2E: case feedback did not resume the battle');
  }
  console.log('E2E: movement, stamina, rest, auto round clear, case diagnosis/checks/prescription and resume OK.');
}

async function runStunE2E(cdp) {
  const url = `${fileUri}?dev=1&class=warrior&stage=10&seed=19&tokens=100&rice=2&skills=power,shieldwall&slots=4&weapon=4&skipquestions=1&stun=1`;
  await navigate(cdp, url, 'window.__BQ_STAGE_READY === true && document.querySelector("#stun-chip:not(.hidden)")');
  const before = await evaluate(cdp, 'window.__BQ_STATE ? window.__BQ_STATE.player.stun : -1');
  if (before !== 1) throw new Error('E2E: boss control stun was not applied, got ' + before);
  if (!(await click(cdp, '#btn-struggle'))) throw new Error('E2E: struggle button not clickable');
  if (!(await waitFor(cdp, 'document.querySelector("#stun-chip").classList.contains("hidden")', 12000))) {
    throw new Error('E2E: struggle did not clear the stun state');
  }
  const after = await evaluate(cdp, 'window.__BQ_STATE ? window.__BQ_STATE.player.stun : -1');
  if (after !== 0) throw new Error('E2E: stun was not cleared, got ' + after);
  console.log('E2E: boss control stun and struggle OK.');
}

async function runEndingE2E(cdp) {
  const url = `${fileUri}?dev=1&class=warrior&stage=1&seed=5&tokens=80&skills=power&slots=4&panel=final`;
  await navigate(cdp, url, 'document.querySelector(".final-choice")');
  await click(cdp, '.final-choice');
  if (!(await waitFor(cdp, 'document.querySelector(".dialogue-line")', 5000))) {
    throw new Error('E2E: final dialogue reply did not appear');
  }
  await click(cdp, '.modal-actions .btn-primary');
  if (!(await waitFor(cdp, 'document.querySelector(".cg-stage") || document.querySelector("#cine-root:not(.hidden) .beam-column") || document.querySelector("#cine-root:not(.hidden) .ending-video")', 10000))) {
    throw new Error('E2E: ending CG did not play');
  }
  if (!(await waitFor(cdp, '(() => { const v = document.querySelector(".ending-video"); return !!v && !v.paused && v.currentTime > 0.2; })()', 15000))) {
    throw new Error('E2E: rice ending video did not start playing');
  }
  if (!(await waitFor(cdp, 'document.querySelector(".modal-title")', 24000))) {
    throw new Error('E2E: ending summary did not appear');
  }
  const unlocked = await evaluate(cdp, 'localStorage.getItem("bq.endings") || ""');
  if (!unlocked || unlocked.indexOf('rice') < 0) {
    throw new Error('E2E: ending was not recorded in the gallery');
  }
  console.log('E2E: final dialogue → ending CG → summary and gallery unlock OK.');
}

async function runDevModeE2E(cdp) {
  await navigate(cdp, fileUri, 'document.querySelector("#btn-dev")');
  await evaluate(cdp, 'localStorage.removeItem("bq.endings")');
  await navigate(cdp, fileUri, 'document.querySelector("#btn-dev")');
  if (!(await click(cdp, '#btn-dev'))) throw new Error('E2E: dev mode button not clickable');
  if (!(await waitFor(cdp, 'document.querySelector(".dev-confirm-modal")', 4000))) {
    throw new Error('E2E: dev mode confirmation did not open');
  }
  const before = await evaluate(cdp, 'localStorage.getItem("bq.endings")');
  if (before) throw new Error('E2E: dev unlock wrote storage before confirmation');
  await click(cdp, '.dev-confirm-modal .modal-actions .btn');
  if (!(await waitFor(cdp, 'document.querySelector("#modal-root").classList.contains("hidden")', 3000))) {
    throw new Error('E2E: cancelling dev mode did not close the confirmation');
  }
  const afterCancel = await evaluate(cdp, 'localStorage.getItem("bq.endings")');
  if (afterCancel) throw new Error('E2E: cancelling dev mode still unlocked endings');

  await click(cdp, '#btn-dev');
  await waitFor(cdp, 'document.querySelector(".dev-confirm-modal")', 4000);
  await click(cdp, '.dev-confirm-modal .btn-primary');
  if (!(await waitFor(cdp, 'document.querySelectorAll(".gallery-card.unlocked").length === 12', 6000))) {
    throw new Error('E2E: confirming dev mode did not unlock all 12 endings');
  }
  const stored = await evaluate(cdp, 'JSON.parse(localStorage.getItem("bq.endings") || "[]").length');
  if (stored !== 12) throw new Error('E2E: expected 12 stored endings, got ' + stored);
  await click(cdp, '.modal-close');
  const label = await evaluate(cdp, 'document.querySelector("#btn-gallery").textContent');
  if (label.indexOf('12/12') < 0) throw new Error('E2E: gallery label was not refreshed: ' + label);
  console.log('E2E: dev mode confirmation, cancel safety and unlock-all gallery OK.');
}

async function runGalleryE2E(cdp) {
  await navigate(cdp, `${fileUri}?dev=1&screen=gallery&unlock=all`, 'document.querySelectorAll(".gallery-card.unlocked").length === 12');
  const thumbsOk = await waitFor(cdp, 'document.querySelectorAll(".gallery-thumb").length === 12 && Array.from(document.querySelectorAll(".gallery-thumb")).every((img) => img.complete && img.naturalWidth > 0)', 10000);
  if (!thumbsOk) {
    const thumbs = await evaluate(cdp, 'Array.from(document.querySelectorAll(".gallery-thumb")).filter((img) => img.complete && img.naturalWidth > 0).length');
    throw new Error('E2E: gallery thumbnails failed to load, got ' + thumbs);
  }
  const clicked = await evaluate(cdp, `(() => {
    const card = Array.from(document.querySelectorAll('.gallery-card.unlocked')).find((item) => item.querySelector('.gallery-title').textContent === '和电饭煲做朋友');
    if (!card) return false;
    card.click();
    return true;
  })()`);
  if (!clicked) throw new Error('E2E: could not find the still-only gallery card');
  if (!(await waitFor(cdp, '(() => { const img = document.querySelector(".still-img"); return !!img && img.complete && img.naturalWidth > 0; })()', 8000))) {
    throw new Error('E2E: gallery replay did not show the ending still');
  }
  await click(cdp, '.cine-skip');
  if (!(await waitFor(cdp, 'document.querySelector("#cine-root").classList.contains("hidden")', 5000))) {
    throw new Error('E2E: skipping the still CG did not close the overlay');
  }
  console.log('E2E: gallery art and still CG replay OK.');
}

async function main() {
  const e2eOnly = process.argv.includes('--e2e');
  const shotsOnly = process.argv.includes('--shots-only');
  await mkdir(OUT, { recursive: true });
  await rm(PROFILE, { recursive: true, force: true }).catch(() => {});

  let port = PORT_START;
  let chrome = null;
  let version = null;
  for (let attempt = 0; attempt < 8 && !version; attempt += 1) {
    const candidatePort = PORT_START + attempt;
    chrome = spawn(chromePath, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
      '--disable-extensions', '--no-first-run', '--no-default-browser-check',
      `--remote-debugging-port=${candidatePort}`,
      `--user-data-dir=${PROFILE}`,
      'about:blank'
    ], { stdio: 'ignore' });
    for (let wait = 0; wait < 40; wait += 1) {
      await sleep(150);
      try {
        const res = await fetch(`http://127.0.0.1:${candidatePort}/json/version`);
        if (res.ok) {
          version = await res.json();
          port = candidatePort;
          break;
        }
      } catch (err) { /* retry */ }
    }
  }
  if (!version) {
    console.error('Failed to start headless Chrome.');
    process.exit(1);
  }
  console.log('Chrome:', version['Browser']);

  const errors = [];
  const failed = [];
  let cdp = null;
  try {
    const newTargetRes = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
    const target = await newTargetRes.json();
    cdp = await CDP.connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    cdp.on('Runtime.exceptionThrown', (params) => {
      const detail = params.exceptionDetails || {};
      errors.push(detail.text + ' ' + (detail.exception ? detail.exception.description : ''));
    });
    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        errors.push((params.args || []).map((arg) => arg.value || arg.description || '').join(' '));
      }
    });
    cdp.on('Log.entryAdded', (params) => {
      const entry = params.entry || {};
      if (entry.level === 'error') errors.push(entry.text || '');
    });

    for (const item of SHOTS) {
      if (e2eOnly) break;
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: item.width, height: item.height, deviceScaleFactor: 1, mobile: false
      });
      const loaded = cdp.once('Page.loadEventFired', 20000).catch(() => null);
      await cdp.send('Page.navigate', { url: fileUri + item.query });
      await loaded;
      await sleep(150);
      let ready = true;
      if (item.waitFor) ready = await waitFor(cdp, item.waitFor, item.timeout);
      if (ready && item.click) {
        await click(cdp, item.click);
        if (item.after) ready = await waitFor(cdp, item.after, 5000);
      }
      if (!ready) {
        failed.push(item.name + ' (wait timeout)');
        console.warn('WAIT TIMEOUT', item.name);
      }
      await sleep(item.delay);
      const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      await writeFile(path.join(OUT, `${item.name}.png`), Buffer.from(screenshot.data, 'base64'));
      console.log('OK   ', item.name, `${item.width}x${item.height}`);
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
    });

    if (!e2eOnly) {
      const loaded = cdp.once('Page.loadEventFired', 20000).catch(() => null);
      await cdp.send('Page.navigate', { url: fileUri + '?selftest=1' });
      await loaded;
      await waitFor(cdp, 'document.querySelector("#selftest-result") && document.querySelector("#selftest-result").dataset.status', 12000);
      const selftest = await evaluate(cdp, 'document.querySelector("#selftest-result").dataset.status + " " + document.querySelector("#selftest-result").textContent');
      console.log('Selftest:', selftest);
      if (String(selftest).indexOf('pass') !== 0) failed.push('selftest: ' + selftest);
    }

    if (!shotsOnly) {
      await runTitleE2E(cdp);
      await runDevModeE2E(cdp);
      await runGalleryE2E(cdp);
      await runBattleE2E(cdp);
      await runStunE2E(cdp);
      await runEndingE2E(cdp);
    }
  } catch (err) {
    console.error('Capture failed:', err.message);
    failed.push(err.message);
  } finally {
    if (cdp) {
      await cdp.send('Browser.close').catch(() => {});
      cdp.close();
    }
    if (chrome && !chrome.killed) chrome.kill();
    await sleep(700);
    await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
    if (errors.length) {
      console.log('--- runtime errors ---');
      errors.slice(0, 20).forEach((text) => console.log(text));
      failed.push(`${errors.length} runtime error(s)`);
    } else {
      console.log('No runtime errors captured.');
    }
    if (failed.length) {
      console.log('FAILED:', failed.join('; '));
      process.exitCode = 1;
    } else {
      console.log('All captures succeeded.');
    }
  }
}

await main();
