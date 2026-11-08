'use strict';

/* 吃饭结局成片 CG：资源、配置与播放链路测试 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./_helpers.js');

const ROOT = path.resolve(__dirname, '..');
const CONTAINERS = ['moov', 'trak', 'mdia', 'minf', 'stbl'];

function walkBoxes(buf, start, end, visitor) {
  let off = start;
  while (off + 8 <= end) {
    const size = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (!size || size < 8 || off + size > end) break;
    visitor(type, off, size);
    if (CONTAINERS.indexOf(type) >= 0) walkBoxes(buf, off + 8, off + size, visitor);
    off += size;
  }
}

function findBox(buf, type) {
  const all = findBoxes(buf, type);
  return all.length ? all[0] : null;
}

function findBoxes(buf, type) {
  const found = [];
  walkBoxes(buf, 0, buf.length, function (name, off, size) {
    if (name === type) found.push({ offset: off, content: off + 8, size: size });
  });
  return found;
}

test('rice ending points at the generated video CG asset', function () {
  const cfg = H.CONFIG.cinematics;
  assert.ok(cfg, 'CONFIG 缺少 cinematics 配置');
  assert.equal(cfg.riceEndingVideo, 'assets/endings/rice-ending.mp4');
});

test('the rice ending video is a real 6s 1280x720 mp4 with audio', function () {
  const rel = H.CONFIG.cinematics.riceEndingVideo;
  const file = path.join(ROOT, rel.split('/').join(path.sep));
  assert.ok(fs.existsSync(file), rel + ' 不存在');
  const buf = fs.readFileSync(file);
  assert.ok(buf.length > 5 * 1024 * 1024, '成片文件太小，可能不是完整视频');

  const ftyp = findBox(buf, 'ftyp');
  assert.ok(ftyp, '缺少 ftyp box');
  assert.ok(['isom', 'mp42', 'iso2'].indexOf(buf.toString('latin1', ftyp.content, ftyp.content + 4)) >= 0, '不是常见的 MP4 brand');
  assert.ok(findBox(buf, 'moov'), '缺少 moov');
  assert.ok(findBox(buf, 'mdat'), '缺少 mdat');
  assert.ok(buf.includes(Buffer.from('avc1')), '缺少 H.264 视频轨');
  assert.ok(buf.includes(Buffer.from('soun')), '缺少音频轨');

  const mvhd = findBox(buf, 'mvhd');
  assert.ok(mvhd, '缺少 mvhd');
  const version = buf[mvhd.content];
  const timescale = version === 0
    ? buf.readUInt32BE(mvhd.content + 12)
    : buf.readUInt32BE(mvhd.content + 20);
  const duration = version === 0
    ? buf.readUInt32BE(mvhd.content + 16)
    : Number(buf.readBigUInt64BE(mvhd.content + 24));
  const seconds = duration / timescale;
  assert.ok(seconds > 5 && seconds < 8, '成片时长应在 5~8 秒，实际 ' + seconds.toFixed(2));

  const tracks = findBoxes(buf, 'tkhd').map(function (tkhd) {
    const tver = buf[tkhd.content];
    return {
      width: buf.readUInt32BE(tkhd.content + (tver === 0 ? 76 : 84)) / 65536,
      height: buf.readUInt32BE(tkhd.content + (tver === 0 ? 80 : 88)) / 65536
    };
  });
  const video = tracks.filter(function (track) { return track.width > 0 && track.height > 0; })[0];
  assert.ok(video, '找不到视频轨尺寸');
  assert.equal(video.width, 1280, '成片宽度应为 1280');
  assert.equal(video.height, 720, '成片高度应为 720');
});

test('cinematics exposes a video ending path and rice ending uses it', function () {
  const cinematics = fs.readFileSync(path.join(ROOT, 'js/ui/cinematics.js'), 'utf8');
  assert.ok(cinematics.indexOf('function videoEnding') >= 0, '缺少 videoEnding');
  assert.ok(cinematics.indexOf('function riceEnding') >= 0, '缺少 riceEnding');
  assert.ok(cinematics.indexOf('riceEndingVideo') >= 0, '没有读取 CONFIG 里的成片路径');
  assert.ok(cinematics.indexOf('videoEnding: videoEnding') >= 0, '没有导出 videoEnding');
  assert.ok(cinematics.indexOf('ending-video') >= 0, '没有创建成片 video 元素');
  assert.ok(cinematics.indexOf('beam()') >= 0 && cinematics.indexOf('home()') >= 0, '缺少旧演出回退');

  const ui = fs.readFileSync(path.join(ROOT, 'js/ui/endings.js'), 'utf8');
  assert.ok(ui.indexOf('Cinematics.riceEnding()') >= 0, '吃饭结局没有走成片 CG');
  assert.ok(ui.indexOf('Cinematics.beam()') < 0, '吃饭结局仍在直接播放光束演出');
});

test('ending video has letterboxed styles and a skip/progress UI', function () {
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  ['.cine-video-ending', '.ending-video', '.video-ending-progress', '.video-ending-play'].forEach(function (selector) {
    assert.ok(css.indexOf(selector) >= 0, 'CSS 缺少 ' + selector);
  });
  assert.ok(/\.ending-video\s*\{[^}]*object-fit:\s*contain/.test(css), '成片应按比例完整显示');
});

test('the dev server serves mp4 with byte ranges', function () {
  const server = fs.readFileSync(path.join(ROOT, 'tools/server.mjs'), 'utf8');
  assert.ok(server.indexOf("'.mp4': 'video/mp4'") >= 0, '服务器没有 mp4 MIME');
  assert.ok(server.indexOf('parseRange') >= 0, '服务器没有 Range 解析');
  assert.ok(server.indexOf('Content-Range') >= 0, '服务器没有返回 Content-Range');
  assert.ok(server.indexOf('createReadStream') >= 0, '服务器没有流式返回视频');
});
