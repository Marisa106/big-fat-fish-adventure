/* 零依赖本地服务器：静态游戏 + DeepSeek API 代理
 * 使用方式：
 *   $env:DEEPSEEK_API_KEY = "sk-..."
 *   node tools/server.mjs
 * 然后打开 http://127.0.0.1:8123/
 */
import { createServer } from 'node:http';
import { createReadStream, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* 读取可选的 .env（零依赖）：不覆盖已存在的进程环境变量 */
function loadDotEnv(file) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    return;
  }
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  });
}

loadDotEnv(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 8123);
const API_BASE = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleChat(req, res) {
  if (!API_KEY) {
    sendJson(res, 503, {
      error: {
        message: '服务器没有配置 DEEPSEEK_API_KEY。请设置环境变量后重启 tools/server.mjs，或在游戏内切换到直连/离线模式。'
      }
    });
    return;
  }
  let payload;
  try {
    const raw = await readBody(req, 1024 * 1024);
    payload = raw ? JSON.parse(raw) : {};
  } catch (err) {
    sendJson(res, 400, { error: { message: '请求体不是合法 JSON：' + err.message } });
    return;
  }
  const body = {
    model: payload.model || DEFAULT_MODEL,
    messages: payload.messages,
    temperature: payload.temperature == null ? 0.2 : payload.temperature,
    max_tokens: payload.max_tokens == null ? 600 : payload.max_tokens,
    stream: false
  };
  if (!Array.isArray(body.messages) || !body.messages.length) {
    sendJson(res, 400, { error: { message: '缺少 messages' } });
    return;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const upstream = await fetch(API_BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + API_KEY
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(text);
  } catch (err) {
    sendJson(res, 502, {
      error: { message: '代理请求失败：' + (err && err.name === 'AbortError' ? '上游超时' : err.message) }
    });
  }
}

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start;
  let end;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Number(match[2]);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start: start, end: Math.min(end, size - 1) };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const target = path.resolve(ROOT, '.' + pathname);
  if (!target.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    /* 视频需要 Range 才能拖动进度、边下边播 */
    const range = type.indexOf('video/') === 0 ? parseRange(req.headers.range, info.size) : null;
    if (range) {
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': range.end - range.start + 1,
        'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + info.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      });
      createReadStream(target, { start: range.start, end: range.end }).pipe(res);
      return;
    }
    const data = await readFile(target);
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': data.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }
  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, hasKey: !!API_KEY, model: DEFAULT_MODEL, baseUrl: API_BASE });
    return;
  }
  if (url.pathname === '/api/chat') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: { message: '只支持 POST' } });
      return;
    }
    await handleChat(req, res);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }
  await serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('大肥鱼历险记 · 本地服务');
  console.log('  游戏地址: http://127.0.0.1:' + PORT + '/');
  console.log('  API 代理: http://127.0.0.1:' + PORT + '/api/chat');
  console.log('  API Key : ' + (API_KEY ? '已配置（' + API_KEY.slice(0, 6) + '…）' : '未配置，AI 点评将回退到本地'));
  console.log('  模型    : ' + DEFAULT_MODEL);
});
