'use strict';

/* 立绘、传送门与怪物音效的资源完整性测试 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const H = require('./_helpers.js');
const Monsters = require('../js/core/monsters.js');
const Combat = require('../js/core/combat.js');

const ROOT = path.resolve(__dirname, '..');

function png(pathname) {
  const buf = fs.readFileSync(pathname);
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', pathname + ' is not a PNG');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
    bytes: buf.length
  };
}

function assetPath(url) {
  return path.join(ROOT, url.replace(/\//g, path.sep));
}

test('every monster and boss uses the new transparent pixel art', function () {
  const entries = Object.keys(H.CONFIG.monsters).map(function (key) {
    return H.CONFIG.monsters[key];
  }).concat(H.CONFIG.bosses);

  entries.forEach(function (def) {
    assert.ok(def.img, def.name + ' 缺少 img');
    assert.ok(def.img.indexOf('assets/monsters/') === 0, def.name + ' 的 img 路径不正确');
    const info = png(assetPath(def.img));
    assert.equal(info.colorType, 6, def.name + ' 需要透明通道');
    assert.ok(info.width >= 16 && info.height >= 16, def.name + ' 尺寸过小');
    assert.ok(info.bytes > 100, def.name + ' 文件为空');

    assert.ok(def.voice, def.name + ' 缺少 voice');
    assert.ok(def.voice.base >= 50 && def.voice.base <= 1600, def.name + ' voice.base 越界');
    assert.ok(['sine', 'square', 'sawtooth', 'triangle'].indexOf(def.voice.type) >= 0);
  });
});

test('the battle map is a readable WebP asset wired into the board CSS', function () {
  const mapFile = path.join(ROOT, 'assets/map/battle-map.webp');
  const buf = fs.readFileSync(mapFile);
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.ok(buf.length > 50000, 'map file looks too small');

  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  assert.ok(css.indexOf('../assets/map/battle-map.webp') >= 0, 'board CSS does not reference the map');
});

test('the three portals sit on the left, bottom and right edges with keyed art', function () {
  const portals = H.CONFIG.board.portals;
  assert.equal(portals.length, 3);
  assert.deepEqual(portals.map(function (p) { return [p.x, p.y]; }), [[0, 4], [4, 8], [8, 4]]);
  assert.equal(new Set(portals.map(function (p) { return p.name; })).size, 3);

  portals.forEach(function (portal) {
    assert.ok(portal.img, portal.name + ' 缺少 img');
    const info = png(assetPath(portal.img));
    assert.equal(info.colorType, 6, portal.name + ' 需要透明通道');
    assert.equal(info.width, 512);
    assert.equal(info.height, 512);
  });
});

function checkPropArt(list, label, minCount) {
  assert.ok(Array.isArray(list) && list.length >= minCount, label + ' 至少需要 ' + minCount + ' 套素材');
  const ids = new Set();
  const imgs = new Set();
  list.forEach(function (art) {
    assert.ok(art.id, label + '素材缺少 id');
    assert.ok(art.name, label + '素材缺少 name');
    assert.ok(art.img && art.img.indexOf('assets/map/') === 0, label + '素材路径应在 assets/map/ 下');
    const info = png(assetPath(art.img));
    assert.equal(info.colorType, 6, art.name + ' 需要透明通道');
    assert.equal(info.width, 256, art.name + ' 宽度应为 256');
    assert.equal(info.height, 256, art.name + ' 高度应为 256');
    assert.ok(info.bytes > 2000, art.name + ' 文件过小');
    ids.add(art.id);
    imgs.add(art.img);
  });
  assert.equal(ids.size, list.length, label + '的 id 不能重复');
  assert.equal(imgs.size, list.length, label + '的图片不能重复');
}

test('grass sprites are transparent square PNGs listed in the board config', function () {
  checkPropArt(H.CONFIG.board.grassArt, '草丛', 2);
});

test('the tree canopy sprite replaces the old tree emoji', function () {
  checkPropArt(H.CONFIG.board.treeArt, '树丛', 1);
});

test('every new run rolls one grass variant and keeps it for the whole run', function () {
  const seen = new Set();
  const trees = new Set();
  for (let seed = 1; seed <= 40; seed += 1) {
    const run = H.makeRun({ seed: seed });
    assert.ok(run.decor && run.decor.grass, '开局应挑好本局草丛素材');
    assert.ok(run.decor.tree, '开局应挑好本局树丛素材');
    assert.equal(run.decor.grass, H.CONFIG.board.grassArt[run.decor.grassIndex]);
    assert.equal(run.decor.tree, H.CONFIG.board.treeArt[run.decor.treeIndex]);
    seen.add(run.decor.grass.id);
    trees.add(run.decor.tree.id);
  }
  assert.equal(seen.size, 2, '多次开局应该两种草丛都出现过');
  assert.ok(trees.size >= 1, '多次开局应该挑出树丛素材');

  const first = H.makeRun({ seed: 7 });
  const second = H.makeRun({ seed: 7 });
  assert.equal(first.decor.grass.id, second.decor.grass.id, '同一种子应得到同一套植被');
  assert.equal(first.decor.tree.id, second.decor.tree.id, '同一种子应得到同一套树丛');
  assert.equal(
    JSON.stringify(first.board.blocked && Array.from(first.board.blocked)),
    JSON.stringify(second.board.blocked && Array.from(second.board.blocked)),
    '植被随机不应影响地图障碍布局'
  );
});

test('renderer swaps both obstacle emojis for the rolled sprites', function () {
  const source = fs.readFileSync(path.join(ROOT, 'js/ui/render.js'), 'utf8');
  assert.ok(source.indexOf('state.decor') >= 0, 'renderer 没有读取本局植被');
  assert.ok(source.indexOf('tile-grass') >= 0, 'renderer 没有输出草丛贴图');
  assert.ok(source.indexOf('tile-tree-art') >= 0, 'renderer 没有输出树丛贴图');
  assert.ok(source.indexOf("'🌿'") < 0, '仍然在使用旧的草丛 emoji');

  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  assert.ok(css.indexOf('.tile-mark.tile-grass') >= 0, 'CSS 缺少草丛贴图样式');
  assert.ok(css.indexOf('.tile-mark.tile-tree-art') >= 0, 'CSS 缺少树丛贴图样式');
});

test('spawn and kill events carry the sprite and voice for renderer audio', function () {
  const state = H.makeRun();
  const events = [];
  state.stage = 4;
  H.P.startRound(state, events, true);
  const spawned = events.filter(function (ev) { return ev.type === 'spawn'; });
  assert.ok(spawned.length > 0);
  spawned.forEach(function (ev) {
    assert.ok(ev.img && ev.img.indexOf('assets/monsters/') === 0);
    assert.ok(ev.voice && ev.voice.base > 0);
  });

  const monster = state.monsters[0];
  const deathEvents = [];
  Combat.killMonster(state, monster, deathEvents);
  assert.equal(deathEvents[0].type, 'kill');
  assert.equal(deathEvents[0].img, monster.img);
  assert.deepEqual(deathEvents[0].voice, monster.voice);
});

test('audio exposes spawn / move / attack / death monster sounds', function () {
  const source = fs.readFileSync(path.join(ROOT, 'js/ui/audio.js'), 'utf8');
  const sandbox = {
    localStorage: { getItem: function () { return null; }, setItem: function () {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const names = sandbox.BQ.Audio.available();
  ['monsterSpawn', 'monsterMove', 'monsterAttack', 'monsterDeath'].forEach(function (name) {
    assert.ok(names.indexOf(name) >= 0, 'missing sound ' + name);
  });
  assert.equal(typeof sandbox.BQ.Audio.play, 'function');
});

test('background music is bundled and wired into the page', function () {
  const track = path.join(ROOT, 'assets/audio/bgm.mp3');
  const buf = fs.readFileSync(track);
  assert.equal(buf.subarray(0, 3).toString('ascii'), 'ID3', 'BGM should be an MP3 file');
  assert.ok(buf.length > 1000000, 'BGM file looks too small');

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.indexOf('assets/audio/bgm.mp3') >= 0, 'index.html does not reference the BGM');
  assert.ok(html.indexOf('js/ui/bgm.js') >= 0, 'index.html does not load the BGM controller');
  assert.ok(html.indexOf('btn-music-title') >= 0, 'title screen is missing the music toggle');

  const source = fs.readFileSync(path.join(ROOT, 'js/ui/bgm.js'), 'utf8');
  assert.ok(source.indexOf('bq.music.muted') >= 0, 'music mute state is not persisted');
  assert.ok(source.indexOf('loop') >= 0, 'BGM should loop');
});
