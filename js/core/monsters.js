/* 怪物与 Boss：回合开始刷新、行动反应、Boss 阶段与特殊技预警 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({
      Config: require('./config.js'),
      Grid: require('./grid.js'),
      Combat: require('./combat.js')
    });
  } else {
    root.BQ = root.BQ || {};
    root.BQ.Monsters = factory(root.BQ);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BQ) {
  'use strict';

  const CONFIG = BQ.Config.CONFIG;
  const Grid = BQ.Grid;
  const Combat = BQ.Combat;
  const CAP = CONFIG.combat.monsterCap;

  function aliveCount(state) {
    return state.monsters.length;
  }

  function createMonster(state, kind, pos) {
    const def = CONFIG.monsters[kind];
    const stage = state.stage;
    const hp = Math.max(1, Math.round(def.hp * (1 + CONFIG.scaling.hpPerStage * (stage - 1))));
    const atk = Math.max(1, Math.round(def.atk * (1 + CONFIG.scaling.atkPerStage * (stage - 1))));
    const scaledToken = Math.round(def.token * (1 + CONFIG.scaling.tokenPer10Stage * Math.floor((stage - 1) / 10)));
    return {
      id: state.nextMonsterId++,
      kind: kind,
      name: def.name,
      emoji: def.emoji,
      img: def.img || '',
      voice: def.voice || null,
      lore: def.lore || '',
      hp: hp,
      maxHp: hp,
      atk: atk,
      baseAtk: atk,
      speed: def.speed,
      range: def.range,
      tokenValue: scaledToken,
      pos: { x: pos.x, y: pos.y },
      frozen: 0,
      attackCd: 0,
      dead: false,
      isBoss: false
    };
  }

  function createBoss(state, def, pos) {
    return {
      id: state.nextMonsterId++,
      kind: 'boss',
      name: def.name,
      emoji: def.emoji,
      img: def.img || '',
      voice: def.voice || null,
      lore: def.title || '',
      hp: def.hp,
      maxHp: def.hp,
      atk: def.atk,
      baseAtk: def.atk,
      speed: def.speed,
      range: def.range,
      tokenValue: def.token,
      pos: { x: pos.x, y: pos.y },
      frozen: 0,
      attackCd: 0,
      dead: false,
      isBoss: true,
      bossDef: def,
      reactionCount: 0,
      specialIndex: 0,
      phaseIdx: 0,
      charge: 0
    };
  }

  function occupiedSet(state, except) {
    const set = new Set();
    set.add(Grid.key(state.player.pos));
    state.monsters.forEach(function (m) {
      if (m === except || m.dead) return;
      set.add(Grid.key(m.pos));
    });
    return set;
  }

  function gatherAround(state, centers, count) {
    const occupied = occupiedSet(state, null);
    const seen = new Set();
    const candidates = [];
    centers.forEach(function (center) {
      const cells = [center].concat(Grid.neighbors(state.board, center));
      cells.forEach(function (cell) {
        if (!Grid.inBounds(state.board, cell.x, cell.y)) return;
        if (Grid.isBlocked(state.board, cell.x, cell.y)) return;
        const k = Grid.key(cell);
        if (occupied.has(k) || seen.has(k)) return;
        seen.add(k);
        candidates.push({ x: cell.x, y: cell.y });
      });
    });
    return state.rng.shuffle(candidates).slice(0, count);
  }

  function spawnPositions(state, count, centers) {
    const portalCenters = centers || state.board.portals;
    let positions = gatherAround(state, portalCenters, count);
    if (positions.length < count) {
      const occupied = occupiedSet(state, null);
      const free = Grid.freeTiles(state.board, occupied);
      const shuffled = state.rng.shuffle(free);
      const existing = new Set(positions.map(Grid.key));
      shuffled.forEach(function (tile) {
        if (positions.length >= count) return;
        if (existing.has(Grid.key(tile))) return;
        positions.push(tile);
      });
    }
    return positions;
  }

  function spawnAddsNear(state, kind, count, center, events) {
    let remaining = Math.max(0, Math.min(count, CAP - aliveCount(state)));
    if (remaining <= 0) return 0;
    const positions = gatherAround(state, [center], remaining);
    let spawned = 0;
    positions.forEach(function (pos) {
      if (remaining <= 0) return;
      const monster = createMonster(state, kind, pos);
      state.monsters.push(monster);
      remaining -= 1;
      spawned += 1;
      if (events) {
        events.push({
          type: 'spawn',
          id: monster.id,
          kind: monster.kind,
          name: monster.name,
          emoji: monster.emoji,
          img: monster.img,
          voice: monster.voice,
          pos: { x: pos.x, y: pos.y },
          hp: monster.hp,
          maxHp: monster.maxHp,
          isBoss: false
        });
      }
    });
    return spawned;
  }

  /* 只在每回合开始时调用 */
  function spawnWave(state, events) {
    const stage = state.stage;
    const isBossStage = CONFIG.campaign.bossStages.indexOf(stage) >= 0;
    if (isBossStage) {
      if (state.monsters.some(function (m) { return m.isBoss && !m.dead; })) return;
      const def = CONFIG.bossByStage[stage];
      if (!def) return;
      const positions = spawnPositions(state, 1, state.board.portals);
      const pos = positions[0] || { x: 0, y: 4 };
      const boss = createBoss(state, def, pos);
      state.monsters.push(boss);
      state.boss = boss;
      events.push({
        type: 'spawn',
        id: boss.id,
        kind: 'boss',
        name: boss.name,
        emoji: boss.emoji,
        img: boss.img,
        voice: boss.voice,
        pos: { x: pos.x, y: pos.y },
        hp: boss.hp,
        maxHp: boss.maxHp,
        isBoss: true
      });
      spawnAddsNear(state, def.addKind, def.adds, pos, events);
      events.push({
        type: 'boss-intro',
        bossId: def.id,
        name: def.name,
        title: def.title,
        introLine: def.introLine
      });
      state.telegraph = null;
      return;
    }

    const baseCount = CONFIG.spawn.base + Math.floor((stage - 1) / CONFIG.spawn.perStages);
    const count = Math.min(baseCount, CONFIG.spawn.max, CAP - aliveCount(state));
    if (count <= 0) return;

    const pool = [];
    Object.keys(CONFIG.monsters).forEach(function (kind) {
      const def = CONFIG.monsters[kind];
      if (def.weight <= 0) return;
      if (def.unlock > stage) return;
      pool.push([kind, def.weight]);
    });
    if (!pool.length) return;

    const positions = spawnPositions(state, count, state.board.portals);
    for (let i = 0; i < positions.length; i += 1) {
      const kind = state.rng.weighted(pool);
      const monster = createMonster(state, kind, positions[i]);
      state.monsters.push(monster);
      events.push({
        type: 'spawn',
        id: monster.id,
        kind: monster.kind,
        name: monster.name,
        emoji: monster.emoji,
        img: monster.img,
        voice: monster.voice,
        pos: { x: positions[i].x, y: positions[i].y },
        hp: monster.hp,
        maxHp: monster.maxHp,
        isBoss: false
      });
    }
  }

  function phaseDef(monster) {
    const def = monster.bossDef;
    if (!def || !def.phases) return null;
    return def.phases[monster.phaseIdx] || def.phases[0];
  }

  function bossInterval(monster) {
    const phase = phaseDef(monster);
    if (phase && phase.interval) return phase.interval;
    return (monster.bossDef && monster.bossDef.specialInterval) || 4;
  }

  function bossSpeed(monster) {
    const phase = phaseDef(monster);
    if (phase && phase.speed) return phase.speed;
    return (monster.bossDef && monster.bossDef.speed) || 1;
  }

  function bossAtkValue(monster) {
    const phase = phaseDef(monster);
    const base = (monster.bossDef && monster.bossDef.atk) || monster.atk;
    return Math.round(base * ((phase && phase.atkMul) || 1));
  }

  function refreshBosses(state, events) {
    const boss = state.monsters.find(function (m) {
      return m.isBoss && !m.dead;
    });
    if (!boss) return;
    boss.atk = bossAtkValue(boss);
    boss.speed = bossSpeed(boss);
    const def = boss.bossDef;
    if (!def || !def.phases) return;
    const pct = boss.hp / boss.maxHp;
    let idx = 0;
    def.phases.forEach(function (phase, i) {
      if (pct <= phase.hpPct) idx = i;
    });
    if (idx > boss.phaseIdx) {
      boss.phaseIdx = idx;
      if (events) {
        events.push({
          type: 'boss-phase',
          bossId: boss.id,
          phase: idx,
          label: def.phases[idx].label || '',
          name: boss.name,
          pos: { x: boss.pos.x, y: boss.pos.y }
        });
      }
    }
  }

  function canHit(state, monster, dist) {
    if (monster.range <= 1) return dist <= 1;
    if (dist > monster.range) return false;
    return Grid.hasLineOfSight(state.board, monster.pos, state.player.pos);
  }

  function moveMonster(state, monster, to, events) {
    events.push({
      type: 'monster-move',
      id: monster.id,
      from: { x: monster.pos.x, y: monster.pos.y },
      to: { x: to.x, y: to.y }
    });
    monster.pos = { x: to.x, y: to.y };
  }

  function bestStep(state, monster, maxSteps) {
    const blockedFn = Grid.makeBlockedFn(state.board, occupiedSet(state, monster));
    const result = Grid.reachable(state.board, monster.pos, blockedFn);
    const playerPos = state.player.pos;
    let best = null;
    result.dist.forEach(function (dist, key) {
      if (dist === 0 || dist > maxSteps) return;
      const tile = Grid.parseKey(key);
      if (tile.x === playerPos.x && tile.y === playerPos.y) return;
      const score = Grid.manhattan(tile, playerPos);
      if (!best || score < best.score) {
        best = { tile: tile, score: score };
      }
    });
    return best;
  }

  function chaseAndAttack(state, monster, events) {
    if (monster.dead || state.player.dead) return;
    const attackEvery = Math.max(1, CONFIG.combat.monsterAttackEvery || 2);
    monster.attackCd = Math.max(0, (monster.attackCd || 0) - 1);
    let dist = Grid.manhattan(monster.pos, state.player.pos);
    if (canHit(state, monster, dist)) {
      if (monster.attackCd <= 0) {
        Combat.attackPlayer(state, monster, 1, events);
        monster.attackCd = attackEvery;
      }
      return;
    }
    const speed = Math.max(1, monster.speed || 1);
    const step = bestStep(state, monster, speed);
    if (step && step.score < dist) {
      moveMonster(state, monster, step.tile, events);
      dist = Grid.manhattan(monster.pos, state.player.pos);
    }
    if (monster.dead || state.player.dead) return;
    if (canHit(state, monster, dist) && monster.attackCd <= 0) {
      Combat.attackPlayer(state, monster, 1, events);
      monster.attackCd = attackEvery;
    }
  }

  function computeSpecialTiles(state, boss, special) {
    if (special.kind === 'aoe') {
      const anchor = special.anchor === 'self' ? boss.pos : state.player.pos;
      const tiles = [];
      for (let y = 0; y < state.board.size; y += 1) {
        for (let x = 0; x < state.board.size; x += 1) {
          if (Grid.manhattan(anchor, { x: x, y: y }) > (special.radius || 1)) continue;
          if (Grid.isBlocked(state.board, x, y)) continue;
          tiles.push({ x: x, y: y });
        }
      }
      return tiles;
    }
    if (special.kind === 'barrage') {
      const tiles = [{ x: state.player.pos.x, y: state.player.pos.y }];
      const seen = new Set([Grid.key(state.player.pos)]);
      for (let attempt = 0; attempt < 40 && tiles.length < (special.count || 3); attempt += 1) {
        const nx = state.player.pos.x + state.rng.int(-2, 2);
        const ny = state.player.pos.y + state.rng.int(-2, 2);
        if (!Grid.inBounds(state.board, nx, ny)) continue;
        if (Grid.isBlocked(state.board, nx, ny)) continue;
        const k = nx + ',' + ny;
        if (seen.has(k)) continue;
        seen.add(k);
        tiles.push({ x: nx, y: ny });
      }
      return tiles;
    }
    return [];
  }

  function telegraphNextSpecial(state, boss) {
    const def = boss.bossDef;
    if (!def) return;
    const special = def.specials[boss.specialIndex % def.specials.length];
    if (!special || !special.telegraph) {
      state.telegraph = null;
      return;
    }
    state.telegraph = {
      bossId: boss.id,
      name: special.name,
      kind: special.kind,
      mul: special.mul || 1,
      tiles: computeSpecialTiles(state, boss, special)
    };
  }

  function applyControl(state, special, events) {
    if (!special || !special.control || state.player.dead) return;
    const turns = Math.max(1, special.control);
    state.player.stun = Math.max(state.player.stun || 0, turns);
    events.push({
      type: 'player-stun',
      turns: turns,
      name: special.name,
      pos: { x: state.player.pos.x, y: state.player.pos.y }
    });
  }

  function executeSpecial(state, boss, special, events) {
    const tiles = special.kind === 'aoe' || special.kind === 'barrage'
      ? (state.telegraph && state.telegraph.bossId === boss.id && state.telegraph.name === special.name
        ? state.telegraph.tiles
        : computeSpecialTiles(state, boss, special))
      : [];
    events.push({
      type: 'boss-special',
      bossId: boss.id,
      name: special.name,
      kind: special.kind,
      control: special.control || 0,
      tiles: tiles.map(function (t) { return { x: t.x, y: t.y }; }),
      pos: { x: boss.pos.x, y: boss.pos.y }
    });

    if (special.kind === 'aoe' || special.kind === 'barrage') {
      const hit = tiles.some(function (t) {
        return t.x === state.player.pos.x && t.y === state.player.pos.y;
      });
      if (hit) {
        Combat.attackPlayer(state, boss, special.mul || 1, events);
        applyControl(state, special, events);
      } else {
        events.push({ type: 'log', text: boss.name + ' 的「' + special.name + '」被躲开了！' });
      }
    } else if (special.kind === 'charge') {
      const playerPos = state.player.pos;
      const occupied = occupiedSet(state, boss);
      const candidates = Grid.neighbors(state.board, playerPos).filter(function (cell) {
        return !Grid.isBlocked(state.board, cell.x, cell.y) && !occupied.has(Grid.key(cell));
      });
      candidates.sort(function (a, b) {
        return Grid.manhattan(boss.pos, a) - Grid.manhattan(boss.pos, b);
      });
      const target = candidates[0];
      if (target && Grid.manhattan(boss.pos, target) <= 6) {
        moveMonster(state, boss, target, events);
        Combat.attackPlayer(state, boss, special.mul || 1, events);
        applyControl(state, special, events);
      } else {
        chaseAndAttack(state, boss, events);
      }
    }
    state.telegraph = null;
  }

  function bossReact(state, boss, events) {
    boss.atk = bossAtkValue(boss);
    boss.speed = bossSpeed(boss);
    const def = boss.bossDef;
    const interval = bossInterval(boss);
    boss.reactionCount += 1;
    boss.charge += 1;

    if (boss.charge >= interval && def) {
      boss.charge = 0;
      const special = def.specials[boss.specialIndex % def.specials.length];
      boss.specialIndex += 1;
      executeSpecial(state, boss, special, events);
      return;
    }

    if (boss.charge === interval - 1 && def) {
      telegraphNextSpecial(state, boss);
    }

    chaseAndAttack(state, boss, events);
  }

  function reactAll(state, events) {
    const order = state.monsters.slice().sort(function (a, b) {
      const da = Grid.manhattan(a.pos, state.player.pos);
      const db = Grid.manhattan(b.pos, state.player.pos);
      if (da !== db) return da - db;
      return a.id - b.id;
    });
    for (let i = 0; i < order.length; i += 1) {
      const monster = order[i];
      if (monster.dead || state.monsters.indexOf(monster) < 0) continue;
      if (state.player.dead) break;
      if (monster.frozen > 0) {
        monster.frozen -= 1;
        events.push({
          type: 'freeze-skip',
          id: monster.id,
          pos: { x: monster.pos.x, y: monster.pos.y }
        });
        continue;
      }
      if (monster.isBoss) bossReact(state, monster, events);
      else chaseAndAttack(state, monster, events);
    }
    refreshBosses(state, events);
    return events;
  }

  return {
    createMonster: createMonster,
    createBoss: createBoss,
    spawnWave: spawnWave,
    spawnAddsNear: spawnAddsNear,
    spawnPositions: spawnPositions,
    reactAll: reactAll,
    refreshBosses: refreshBosses,
    phaseDef: phaseDef,
    bossInterval: bossInterval,
    bossSpeed: bossSpeed,
    bossAtkValue: bossAtkValue,
    computeSpecialTiles: computeSpecialTiles
  };
});

