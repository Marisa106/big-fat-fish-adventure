'use strict';

/* 结局 CG 素材：12 张剧照 / 缩略图 / 4 段成片的完整性，以及演出链路接线 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./_helpers.js');

const ROOT = path.resolve(__dirname, '..');
const VIDEO_ENDINGS = ['rice', 'openSource', 'promptMaster', 'truthHunter'];

function asset(url) {
  return path.join(ROOT, url.split('/').join(path.sep));
}

function webpInfo(url) {
  const file = asset(url);
  assert.ok(fs.existsSync(file), url + ' 不存在');
  const buf = fs.readFileSync(file);
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF', url + ' 不是 RIFF 容器');
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP', url + ' 不是 WebP');

  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    assert.equal(buf.subarray(23, 26).toString('hex'), '9d012a', url + ' 不是合法的 VP8 关键帧');
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
      bytes: buf.length
    };
  }
  if (chunk === 'VP8X') {
    return {
      width: buf.readUIntLE(24, 3) + 1,
      height: buf.readUIntLE(27, 3) + 1,
      bytes: buf.length
    };
  }
  throw new Error(url + ' 使用了未覆盖的 WebP 编码：' + chunk);
}

function mp4Boxes(buf, start, end, visitor) {
  const containers = ['moov', 'trak', 'mdia', 'minf', 'stbl'];
  let off = start;
  while (off + 8 <= end) {
    const size = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (!size || size < 8 || off + size > end) break;
    visitor(type, off, size);
    if (containers.indexOf(type) >= 0) mp4Boxes(buf, off + 8, off + size, visitor);
    off += size;
  }
}

function findMp4Box(buf, type) {
  let found = null;
  mp4Boxes(buf, 0, buf.length, function (name, off, size) {
    if (!found && name === type) found = { content: off + 8, size: size };
  });
  return found;
}

function videoInfo(url) {
  const file = asset(url);
  assert.ok(fs.existsSync(file), url + ' 不存在');
  const buf = fs.readFileSync(file);
  assert.ok(buf.length > 2 * 1024 * 1024, url + ' 文件太小，可能不是完整成片');
  assert.ok(findMp4Box(buf, 'ftyp'), url + ' 缺少 ftyp');
  assert.ok(findMp4Box(buf, 'moov'), url + ' 缺少 moov');
  assert.ok(findMp4Box(buf, 'mdat'), url + ' 缺少 mdat');
  assert.ok(buf.includes(Buffer.from('avc1')), url + ' 缺少 H.264 视频轨');

  const mvhd = findMp4Box(buf, 'mvhd');
  const version = buf[mvhd.content];
  const timescale = version === 0
    ? buf.readUInt32BE(mvhd.content + 12)
    : buf.readUInt32BE(mvhd.content + 20);
  const duration = version === 0
    ? buf.readUInt32BE(mvhd.content + 16)
    : Number(buf.readBigUInt64BE(mvhd.content + 24));

  let track = null;
  mp4Boxes(buf, 0, buf.length, function (name, off) {
    if (name !== 'tkhd' || track) return;
    const tver = buf[off + 8];
    const width = buf.readUInt32BE(off + 8 + (tver === 0 ? 76 : 84)) / 65536;
    const height = buf.readUInt32BE(off + 8 + (tver === 0 ? 80 : 88)) / 65536;
    if (width > 0 && height > 0) track = { width: width, height: height };
  });
  return {
    seconds: duration / timescale,
    width: track ? track.width : 0,
    height: track ? track.height : 0,
    bytes: buf.length
  };
}

test('every ending has a 1920x1080 still and a 640x360 gallery thumbnail', function () {
  assert.equal(H.Endings.ENDINGS.length, 12);
  H.Endings.ENDINGS.forEach(function (ending) {
    const media = ending.media;
    assert.ok(media, ending.id + ' 缺少 media 配置');
    assert.ok(media.still && media.still.indexOf('assets/endings/') === 0, ending.id + ' 缺少剧照路径');
    assert.ok(media.thumb && media.thumb.indexOf('assets/endings/thumbs/') === 0, ending.id + ' 缺少缩略图路径');

    const still = webpInfo(media.still);
    assert.equal(still.width, 1920, ending.id + ' 剧照宽度应为 1920');
    assert.equal(still.height, 1080, ending.id + ' 剧照高度应为 1080');
    assert.ok(still.bytes > 60000, ending.id + ' 剧照文件过小');

    const thumb = webpInfo(media.thumb);
    assert.equal(thumb.width, 640, ending.id + ' 缩略图宽度应为 640');
    assert.equal(thumb.height, 360, ending.id + ' 缩略图高度应为 360');
    assert.ok(thumb.bytes < still.bytes, ending.id + ' 缩略图应明显小于剧照');
  });
});

test('four endings carry a real 1280x720 mp4 ending film', function () {
  const withVideo = H.Endings.ENDINGS.filter(function (ending) {
    return ending.media && ending.media.video;
  }).map(function (ending) {
    return ending.id;
  });
  assert.deepEqual(withVideo.sort(), VIDEO_ENDINGS.slice().sort());

  VIDEO_ENDINGS.forEach(function (id) {
    const media = H.Endings.mediaOf(id);
    assert.ok(media.still, id + ' 的成片需要剧照当封面');
    const info = videoInfo(media.video);
    assert.equal(info.width, 1280, id + ' 成片宽度应为 1280');
    assert.equal(info.height, 720, id + ' 成片高度应为 720');
    assert.ok(info.seconds > 3.5 && info.seconds < 8, id + ' 成片时长应在 3.5~8 秒，实际 ' + info.seconds.toFixed(2));
  });
});

test('mediaOf falls back safely for unknown endings', function () {
  assert.equal(H.Endings.mediaOf('rice').video, 'assets/endings/rice-ending.mp4');
  assert.equal(H.Endings.mediaOf('nope'), null);
});

test('the ending UI plays video first and falls back to the still, not emoji', function () {
  const ui = fs.readFileSync(path.join(ROOT, 'js/ui/endings.js'), 'utf8');
  assert.ok(ui.indexOf('media.video') >= 0, '结局 UI 没有读取成片');
  assert.ok(ui.indexOf('media.still') >= 0, '结局 UI 没有读取剧照');
  assert.ok(ui.indexOf('stillEnding') >= 0, '结局 UI 没有回退到剧照 CG');
  assert.ok(ui.indexOf('gallery-thumb') >= 0, '图鉴没有使用缩略图');
  assert.ok(ui.indexOf('ending-summary-art') >= 0, '结算页没有展示剧照');

  const cine = fs.readFileSync(path.join(ROOT, 'js/ui/cinematics.js'), 'utf8');
  assert.ok(cine.indexOf('function stillEnding') >= 0, 'cinematics 缺少 stillEnding');
  assert.ok(cine.indexOf('stillEnding: stillEnding') >= 0, 'cinematics 没有导出 stillEnding');
  assert.ok(cine.indexOf('poster: still') >= 0, '吃饭结局成片没有使用剧照当封面');
});

test('still CG and gallery art have dedicated styles', function () {
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  ['.still-stage', '.still-backdrop', '.still-img', '.still-tag', '.gallery-art', '.gallery-thumb', '.ending-summary-art'].forEach(function (selector) {
    assert.ok(css.indexOf(selector) >= 0, 'CSS 缺少 ' + selector);
  });
  assert.ok(/\.still-img\s*\{[^}]*object-fit:\s*contain/.test(css), '剧照应按比例完整显示，不能裁掉标题');
});
