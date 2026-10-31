'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Grid = require('../js/core/grid.js');
const CONFIG = require('../js/core/config.js').CONFIG;

function boardWith(blocked, size) {
  return {
    size: size || 5,
    blocked: new Set(blocked || []),
    portals: [],
    start: { x: 0, y: 0 }
  };
}

test('board generation keeps start and portals free', function () {
  let seed = 1;
  const random = function () {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 20; i += 1) {
    const board = Grid.createBoard({
      size: CONFIG.board.size,
      obstacles: CONFIG.board.obstacles,
      start: CONFIG.board.start,
      portals: CONFIG.board.portals,
      random: random
    });
    assert.equal(board.size, 9);
    assert.equal(board.blocked.size, CONFIG.board.obstacles);
    assert.equal(Grid.isBlocked(board, CONFIG.board.start.x, CONFIG.board.start.y), false);
    CONFIG.board.portals.forEach(function (portal) {
      assert.equal(Grid.isBlocked(board, portal.x, portal.y), false);
    });
  }
});

test('board generation leaves the map mostly reachable', function () {
  const board = Grid.createBoard({
    size: 9,
    obstacles: 8,
    start: { x: 4, y: 4 },
    portals: CONFIG.board.portals,
    random: function () { return 0.37; }
  });
  const result = Grid.reachable(board, board.start, Grid.makeBlockedFn(board, null));
  const freeCount = 81 - board.blocked.size;
  assert.ok(result.dist.size >= freeCount - 2, 'reachable ' + result.dist.size + '/' + freeCount);
});

test('reachable and pathTo find an orthogonal shortest path', function () {
  const board = boardWith([]);
  const result = Grid.reachable(board, { x: 0, y: 0 }, Grid.makeBlockedFn(board, null));
  assert.equal(result.dist.get('2,2'), 4);
  const path = Grid.pathTo(result, { x: 0, y: 0 }, { x: 2, y: 2 });
  assert.ok(path);
  assert.equal(path.length, 4);
  assert.deepEqual(path[path.length - 1], { x: 2, y: 2 });
  let previous = { x: 0, y: 0 };
  path.forEach(function (step) {
    assert.equal(Math.abs(step.x - previous.x) + Math.abs(step.y - previous.y), 1);
    previous = step;
  });
});

test('findPath avoids blocked tiles and returns null when unreachable', function () {
  const board = boardWith(['1,0', '1,1', '1,2', '1,3', '1,4']);
  assert.equal(Grid.findPath(board, { x: 0, y: 0 }, { x: 2, y: 0 }), null);
  const openBoard = boardWith(['1,1']);
  const path = Grid.findPath(openBoard, { x: 0, y: 0 }, { x: 2, y: 0 });
  assert.ok(path);
  assert.equal(path.some(function (p) { return p.x === 1 && p.y === 1; }), false);
});

test('line of sight is blocked by obstacles but ignores endpoints', function () {
  const board = boardWith(['1,0']);
  assert.equal(Grid.hasLineOfSight(board, { x: 0, y: 0 }, { x: 2, y: 0 }), false);
  assert.equal(Grid.hasLineOfSight(board, { x: 0, y: 0 }, { x: 1, y: 0 }), true);
  assert.equal(Grid.hasLineOfSight(board, { x: 0, y: 0 }, { x: 0, y: 3 }), true);
  const diagonal = boardWith(['2,2']);
  assert.equal(Grid.hasLineOfSight(diagonal, { x: 1, y: 1 }, { x: 3, y: 3 }), false);
  assert.equal(Grid.manhattan({ x: 1, y: 1 }, { x: 3, y: 3 }), 4);
});

test('freeTiles excludes obstacles and occupied tiles', function () {
  const board = boardWith(['0,1']);
  const free = Grid.freeTiles(board, new Set(['1,0', '0,0']));
  assert.equal(free.some(function (p) { return p.x === 0 && p.y === 1; }), false);
  assert.equal(free.some(function (p) { return p.x === 1 && p.y === 0; }), false);
  assert.equal(free.some(function (p) { return p.x === 4 && p.y === 4; }), true);
});

test('randomFreeNear never returns a blocked tile', function () {
  const board = boardWith(['4,4', '3,4']);
  let seed = 3;
  const random = function () {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 100; i += 1) {
    const tile = Grid.randomFreeNear(board, { x: 4, y: 4 }, random, null);
    if (!tile) continue;
    assert.equal(Grid.isBlocked(board, tile.x, tile.y), false);
  }
});
