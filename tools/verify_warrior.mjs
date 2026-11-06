/* 战士立绘 + 攻击动画专项验收：真实 Chrome、真实点击、逐帧采样与截图。 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts', 'verify');
const PROFILE = path.join(ROOT, 'artifacts', 'chrome-profile-verify');
const PORT = 9350;

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => existsSync(candidate));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fileUri = `file:///${ROOT.replace(/\\/g, '/')}/index.html`;
const URL_WARRIOR =
  '?dev=1&class=warrior&stage=3&seed=11&tokens=60&rice=2&skills=power,regen&slots=4&weapon=2&skipquestions=1&atk=1';

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch (err) { return; }
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
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket error')); });
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
      const off = this.on(method, (params) => { clearTimeout(timer); off(); resolve(params); });
      const timer = setTimeout(() => { off(); reject(new Error(`Event timeout: ${method}`)); }, timeout);
    });
  }

  close() {
    try { this.ws.close(); } catch (err) { /* ignore */ }
  }
}

async function waitFor(cdp, expression, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
      if (result && result.result && result.result.value) return true;
    } catch (err) { /* navigation */ }
    await sleep(120);
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

async function navigate(cdp, url, waitExpression) {
  const loaded = cdp.once('Page.loadEventFired', 20000).catch(() => null);
  await cdp.send('Page.navigate', { url });
  await loaded;
  if (waitExpression && !(await waitFor(cdp, waitExpression, 20000))) {
    throw new Error('navigation wait failed: ' + url);
  }
}

async function shot(cdp, name) {
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(path.join(OUT, name + '.png'), Buffer.from(screenshot.data, 'base64'));
  console.log('shot', name);
}

async function teleportMonsterNextToPlayer(cdp) {
  return evaluate(cdp, `(() => {
    const s = window.__BQ_STATE;
    const p = s.player.pos;
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
    const spots = dirs.map(([dx,dy]) => ({x:p.x+dx,y:p.y+dy}))
      .filter((t) => t.x >= 0 && t.y >= 0 && t.x < s.board.size && t.y < s.board.size)
      .filter((t) => !s.board.blocked.has(t.x+','+t.y))
      .filter((t) => !s.monsters.some((m) => m !== s.monsters[0] && m.pos.x === t.x && m.pos.y === t.y));
    const m = s.monsters[0];
    if (!m || !spots.length) return null;
    m.pos = spots[0];
    window.BQ.Render.draw(s);
    return { monsterId: m.id, x: m.pos.x, y: m.pos.y, hp: m.hp };
  })()`);
}

async function main() {
  if (!CHROME) {
    console.error('Chrome/Edge not found.');
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });
  await rm(PROFILE, { recursive: true, force: true }).catch(() => {});

  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
    '--disable-extensions', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'
  ], { stdio: 'ignore' });

  let version = null;
  for (let i = 0; i < 40 && !version; i += 1) {
    await sleep(150);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) version = await res.json();
    } catch (err) { /* retry */ }
  }
  if (!version) {
    console.error('Failed to start headless Chrome.');
    process.exit(1);
  }

  const errors = [];
  let cdp = null;
  let ok = true;
  try {
    const targetRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
    const target = await targetRes.json();
    cdp = await CDP.connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    cdp.on('Runtime.exceptionThrown', (params) => {
      const detail = params.exceptionDetails || {};
      errors.push(detail.text + ' ' + (detail.exception ? detail.exception.description : ''));
    });
    cdp.on('Log.entryAdded', (params) => {
      if ((params.entry || {}).level === 'error') errors.push((params.entry || {}).text || '');
    });

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 2, mobile: false
    });
    await navigate(cdp, fileUri + URL_WARRIOR, 'window.__BQ_STAGE_READY === true');
    await sleep(300);

    const idleInfo = await evaluate(cdp, `(() => {
      const s = window.__BQ_STATE;
      const sprite = document.querySelector('.entity-player .entity-sprite');
      const tile = document.querySelector('.tile[data-x="'+s.player.pos.x+'"][data-y="'+s.player.pos.y+'"]');
      const r = sprite.getBoundingClientRect();
      const t = tile.getBoundingClientRect();
      return {
        classId: s.classId,
        pos: s.player.pos,
        bg: getComputedStyle(sprite).backgroundImage,
        backgroundSize: getComputedStyle(sprite).backgroundSize,
        sprite: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
        tile: { x: +t.x.toFixed(1), y: +t.y.toFixed(1), w: +t.width.toFixed(1), h: +t.height.toFixed(1) },
        hasArt: document.querySelector('.entity-player').classList.contains('has-art')
      };
    })()`);
    console.log('idle', JSON.stringify(idleInfo));
    await shot(cdp, '01-idle');

    const placed = await teleportMonsterNextToPlayer(cdp);
    console.log('monster', JSON.stringify(placed));
    if (!placed) throw new Error('could not place a monster next to the player');
    await sleep(200);

    // 在页面内每帧记录精灵图位置，避免 CDP 往返造成的时间误差
    await evaluate(cdp, `(() => {
      const sprite = document.querySelector('.entity-player .entity-sprite');
      window.__FRAMES = [];
      const t0 = performance.now();
      function tick(ts) {
        window.__FRAMES.push({
          t: Math.round(ts - t0),
          bg: getComputedStyle(sprite).backgroundImage,
          pos: getComputedStyle(sprite).backgroundPosition,
          attacking: sprite.classList.contains('is-attacking')
        });
        if (ts - t0 < 1600) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      return true;
    })()`);

    const clickAt = Date.now();
    await evaluate(cdp, `(() => {
      const t = document.querySelector('.tile[data-x="${placed.x}"][data-y="${placed.y}"]');
      if (!t) return false;
      t.click();
      return true;
    })()`);
    await sleep(300);
    await shot(cdp, '02-windup');
    await sleep(380);
    await shot(cdp, '03-impact');
    await sleep(260);
    await shot(cdp, '04-recover');
    await sleep(500);
    await shot(cdp, '05-idle-after');

    const frameInfo = await evaluate(cdp, `(() => {
      const frames = window.__FRAMES || [];
      const unique = [];
      const seen = new Set();
      frames.forEach((f) => {
        if (!seen.has(f.pos)) { seen.add(f.pos); unique.push(f); }
      });
      return {
        samples: frames.length,
        uniqueFrames: unique.length,
        attackFrames: unique.filter((f) => f.attacking).length,
        first: unique[0],
        impact: unique[Math.min(unique.length - 1, 21)],
        last: unique[unique.length - 1],
        elapsed: Date.now() - ${clickAt}
      };
    })()`);
    console.log('frames', JSON.stringify(frameInfo));

    const endInfo = await evaluate(cdp, `(() => {
      const sprite = document.querySelector('.entity-player .entity-sprite');
      return {
        bg: getComputedStyle(sprite).backgroundImage,
        attacking: sprite.classList.contains('is-attacking'),
        busy: !!(window.__BQ_STATE && document.querySelector('#dock .rest-btn').disabled)
      };
    })()`);
    console.log('end', JSON.stringify(endInfo));

    const idleOk = /idle\.png/.test(idleInfo.bg) && idleInfo.hasArt;
    const animOk = frameInfo.uniqueFrames > 10 && frameInfo.attackFrames > 10;
    const restoreOk = /idle\.png/.test(endInfo.bg) && !endInfo.attacking;
    const scaleOk = idleInfo.sprite.w > idleInfo.tile.w * 1.8 && idleInfo.sprite.h > idleInfo.tile.h * 2.5;
    console.log({ idleOk, animOk, restoreOk, scaleOk });

    if (!idleOk || !animOk || !restoreOk || !scaleOk) {
      ok = false;
      console.error('visual verification failed');
    }

    // 职业选择页也截图，确认头像对齐
    await navigate(cdp, fileUri + '?dev=1&screen=class', 'document.querySelector("#screen-class:not(.hidden)")');
    await sleep(250);
    await shot(cdp, '06-class');

    // 静态定格在攻击命中帧，检查精灵图本身（挥砍光束）在棋盘上的观感
    await navigate(cdp, fileUri + URL_WARRIOR, 'window.__BQ_STAGE_READY === true');
    await sleep(250);
    const placed2 = await teleportMonsterNextToPlayer(cdp);
    await evaluate(cdp, `(() => {
      const sprite = document.querySelector('.entity-player .entity-sprite');
      window.BQ.Sprite.cancel(sprite);
      sprite.style.backgroundImage = 'url("assets/warrior/attack_sheet.webp")';
      sprite.style.backgroundSize = '800% 500%';
      sprite.style.backgroundPosition = '71.4286% 50%';
      return true;
    })()`);
    await sleep(150);
    await shot(cdp, '07-impact-frame');
    console.log('impact static', JSON.stringify(placed2));

    // 手机视口
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: false
    });
    await navigate(cdp, fileUri + URL_WARRIOR, 'window.__BQ_STAGE_READY === true');
    await sleep(300);
    await shot(cdp, '08-mobile-battle');
  } catch (err) {
    ok = false;
    console.error('verify failed:', err.message);
  } finally {
    if (cdp) {
      await cdp.send('Browser.close').catch(() => {});
      cdp.close();
    }
    if (chrome && !chrome.killed) chrome.kill();
    await sleep(500);
    await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
    if (errors.length) {
      ok = false;
      console.log('--- runtime errors ---');
      errors.slice(0, 20).forEach((text) => console.log(text));
    } else {
      console.log('No runtime errors captured.');
    }
    console.log(ok ? 'WARRIOR VERIFY PASSED' : 'WARRIOR VERIFY FAILED');
    if (!ok) process.exitCode = 1;
  }
}

main();
