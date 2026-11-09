/*
 * 将技术文档 HTML 打印为 PDF（Chrome DevTools Protocol，零依赖）
 * 用法：
 *   node docs/print_pdf.mjs body  docs/tech-doc.html docs/build/body.pdf
 *   node docs/print_pdf.mjs cover docs/cover.html    docs/build/cover.pdf
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const chromePath = CHROME_CANDIDATES.find((item) => existsSync(item));
if (!chromePath) {
  console.error('Chrome/Edge not found.');
  process.exit(1);
}

const mode = process.argv[2] === 'cover' ? 'cover' : 'body';
const input = path.resolve(ROOT, process.argv[3] || (mode === 'cover' ? 'docs/cover.html' : 'docs/tech-doc.html'));
const output = path.resolve(ROOT, process.argv[4] || (mode === 'cover' ? 'docs/build/cover.pdf' : 'docs/build/body.pdf'));
await mkdir(path.dirname(output), { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      const timer = setTimeout(() => reject(new Error('WebSocket timeout')), 10000);
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
          reject(new Error('CDP timeout: ' + method));
        }
      }, 30000);
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

  once(method, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const off = this.on(method, (params) => {
        clearTimeout(timer);
        off();
        resolve(params);
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error('Event timeout: ' + method));
      }, timeout);
    });
  }
}

const profile = path.join(ROOT, 'docs', 'build', 'chrome-profile');
await rm(profile, { recursive: true, force: true }).catch(() => {});
const port = 9477;
const chrome = spawn(chromePath, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  '--disable-extensions', '--no-first-run', '--no-default-browser-check',
  '--font-render-hinting=none',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  'about:blank'
], { stdio: 'ignore' });

let version = null;
for (let i = 0; i < 50 && !version; i += 1) {
  await sleep(200);
  try {
    const res = await fetch('http://127.0.0.1:' + port + '/json/version');
    if (res.ok) version = await res.json();
  } catch (err) { /* retry */ }
}
if (!version) {
  chrome.kill();
  console.error('Failed to start headless Chrome.');
  process.exit(1);
}
console.log('Chrome:', version['Browser']);

let cdp = null;
try {
  const targetRes = await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', { method: 'PUT' });
  const target = await targetRes.json();
  cdp = await CDP.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const loaded = cdp.once('Page.loadEventFired', 30000).catch(() => null);
  await cdp.send('Page.navigate', { url: pathToFileURL(input).href });
  await loaded;
  await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })));
      return true;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  await sleep(900);

  const footer = `<div style="width:100%;box-sizing:border-box;padding:0 17mm;font-size:8pt;color:#7d9188;font-family:'Noto Sans SC','Microsoft YaHei',sans-serif;display:flex;justify-content:space-between;">
    <span>大肥鱼历险记 · 技术文档</span>
    <span>第 <span class="pageNumber"></span> / <span class="totalPages"></span> 页</span>
  </div>`;

  const options = mode === 'cover'
    ? {
        printBackground: true,
        preferCSSPageSize: false,
        paperWidth: 8.27,
        paperHeight: 11.69,
        displayHeaderFooter: false,
        marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0
      }
    : {
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: footer,
        marginTop: 0.70,
        marginBottom: 0.66,
        marginLeft: 0.67,
        marginRight: 0.67
      };

  const result = await cdp.send('Page.printToPDF', options);
  const buffer = Buffer.from(result.data, 'base64');
  await writeFile(output, buffer);
  console.log('PDF:', path.relative(ROOT, output), (buffer.length / 1024).toFixed(0) + ' KB');
} catch (err) {
  console.error('Print failed:', err.message);
  process.exitCode = 1;
} finally {
  if (cdp) {
    await cdp.send('Browser.close').catch(() => {});
  }
  if (!chrome.killed) chrome.kill();
  await sleep(500);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
