/* 棋盘、寻路与视线判定 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BQ = root.BQ || {};
    root.BQ.Grid = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DIRS = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];

  function key(pos) {
    return pos.x + ',' + pos.y;
  }

  function parseKey(text) {
    const parts = String(text).split(',');
    return { x: Number(parts[0]), y: Number(parts[1]) };
  }

  function inBounds(board, x, y) {
    return x >= 0 && y >= 0 && x < board.size && y < board.size;
  }

  function isBlocked(board, x, y) {
    return board.blocked.has(x + ',' + y);
  }

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function neighbors(board, pos) {
    const out = [];
    for (let i = 0; i < DIRS.length; i += 1) {
      const nx = pos.x + DIRS[i].x;
      const ny = pos.y + DIRS[i].y;
      if (inBounds(board, nx, ny)) out.push({ x: nx, y: ny });
    }
    return out;
  }

  function makeBlockedFn(board, extraSet) {
    return function (x, y) {
      if (!inBounds(board, x, y)) return true;
      if (isBlocked(board, x, y)) return true;
      if (extraSet && extraSet.has(x + ',' + y)) return true;
      return false;
    };
  }

  /* 从 start 出发的 BFS：返回 { dist: Map<key, number>, prev: Map<key, {x,y}> } */
  function reachable(board, start, blockedFn) {
    const dist = new Map();
    const prev = new Map();
    const queue = [];
    const startKey = key(start);
    dist.set(startKey, 0);
    queue.push({ x: start.x, y: start.y });
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head];
      head += 1;
      const curKey = key(cur);
      const curDist = dist.get(curKey);
      for (let i = 0; i < DIRS.length; i += 1) {
        const nx = cur.x + DIRS[i].x;
        const ny = cur.y + DIRS[i].y;
        if (blockedFn(nx, ny)) continue;
        const nk = nx + ',' + ny;
        if (dist.has(nk)) continue;
        dist.set(nk, curDist + 1);
        prev.set(nk, cur);
        queue.push({ x: nx, y: ny });
      }
    }
    return { dist: dist, prev: prev };
  }

  function pathTo(result, start, goal) {
    const goalKey = key(goal);
    if (!result.dist.has(goalKey)) return null;
    const path = [];
    let cur = { x: goal.x, y: goal.y };
    let guard = 0;
    while (!(cur.x === start.x && cur.y === start.y)) {
      path.push(cur);
      cur = result.prev.get(key(cur));
      guard += 1;
      if (!cur || guard > 500) return null;
    }
    path.reverse();
    return path;
  }

  function findPath(board, start, goal, extraSet) {
    const blockedFn = makeBlockedFn(board, extraSet);
    if (blockedFn(goal.x, goal.y)) return null;
    const result = reachable(board, start, blockedFn);
    return pathTo(result, start, goal);
  }

  /* Bresenham 视线：路径经过的中间格不得是障碍；端点不检查 */
  function hasLineOfSight(board, a, b) {
    let x0 = a.x;
    let y0 = a.y;
    const x1 = b.x;
    const y1 = b.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let guard = 0;
    while (!(x0 === x1 && y0 === y1)) {
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
      if (x0 === x1 && y0 === y1) break;
      if (inBounds(board, x0, y0) && isBlocked(board, x0, y0)) return false;
      guard += 1;
      if (guard > 200) break;
    }
    return true;
  }

  function freeTiles(board, occupiedSet) {
    const out = [];
    for (let y = 0; y < board.size; y += 1) {
      for (let x = 0; x < board.size; x += 1) {
        if (isBlocked(board, x, y)) continue;
        if (occupiedSet && occupiedSet.has(x + ',' + y)) continue;
        out.push({ x: x, y: y });
      }
    }
    return out;
  }

  function randomFreeNear(board, center, randomFn, occupiedSet) {
    const candidates = [];
    const seen = new Set();
    const push = function (x, y) {
      if (!inBounds(board, x, y) || isBlocked(board, x, y)) return;
      const k = x + ',' + y;
      if (seen.has(k)) return;
      if (occupiedSet && occupiedSet.has(k)) return;
      seen.add(k);
      candidates.push({ x: x, y: y });
    };
    push(center.x, center.y);
    neighbors(board, center).forEach(function (p) {
      push(p.x, p.y);
    });
    if (!candidates.length) return null;
    return candidates[Math.floor(randomFn() * candidates.length)];
  }

  function createBoard(opts) {
    const size = opts.size;
    const start = { x: opts.start.x, y: opts.start.y };
    const portals = opts.portals.map(function (p) {
      return Object.assign({}, p, { x: p.x, y: p.y });
    });
    const randomFn = opts.random || Math.random;
    const reserved = new Set();
    reserved.add(key(start));
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        reserved.add((start.x + dx) + ',' + (start.y + dy));
      }
    }
    portals.forEach(function (p) {
      reserved.add(key(p));
      neighbors({ size: size, blocked: new Set() }, p).forEach(function (n) {
        reserved.add(key(n));
      });
    });

    let accepted = null;
    for (let attempt = 0; attempt < 30 && !accepted; attempt += 1) {
      const candidates = [];
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const k = x + ',' + y;
          if (reserved.has(k)) continue;
          candidates.push({ x: x, y: y });
        }
      }
      for (let i = candidates.length - 1; i > 0; i -= 1) {
        const j = Math.floor(randomFn() * (i + 1));
        const tmp = candidates[i];
        candidates[i] = candidates[j];
        candidates[j] = tmp;
      }
      const blocked = new Set();
      for (let i = 0; i < Math.min(opts.obstacles, candidates.length); i += 1) {
        blocked.add(key(candidates[i]));
      }
      const board = { size: size, blocked: blocked, portals: portals, start: start };
      const blockedFn = makeBlockedFn(board, null);
      const result = reachable(board, start, blockedFn);
      const freeCount = size * size - blocked.size;
      if (result.dist.size >= freeCount - 2) {
        accepted = { size: size, blocked: blocked, portals: portals, start: start };
      }
    }

    if (!accepted) {
      accepted = { size: size, blocked: new Set(), portals: portals, start: start };
    }
    return accepted;
  }

  return {
    DIRS: DIRS,
    key: key,
    parseKey: parseKey,
    inBounds: inBounds,
    isBlocked: isBlocked,
    manhattan: manhattan,
    neighbors: neighbors,
    makeBlockedFn: makeBlockedFn,
    reachable: reachable,
    pathTo: pathTo,
    findPath: findPath,
    hasLineOfSight: hasLineOfSight,
    freeTiles: freeTiles,
    randomFreeNear: randomFreeNear,
    createBoard: createBoard
  };
});
