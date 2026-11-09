'use strict';

/* 无头模拟器：启发式 Bot 跑完整 40 关，用于平衡与结局覆盖验证 */
const State = require('../js/core/state.js');
const P = require('../js/core/progression.js');
const Skills = require('../js/core/skills.js');
const Shop = require('../js/core/shop.js');
const Grid = require('../js/core/grid.js');
const Questions = require('../js/core/questions.js');
const Endings = require('../js/core/endings.js');
const CONFIG = require('../js/core/config.js').CONFIG;

const SKILL_SCORE = {
  power: 76, vitality: 70, haste: 64, greed: 52, regen: 66, ironwall: 74,
  knowledgeReserve: 72,
  lifesteal: 84, thorns: 60, eagle: 50, crit: 74,
  fireball: 82, whirlwind: 58, heal: 68, frostnova: 80,
  shieldwall: 72, elemMastery: 86,
  meteor: 92, timeWarp: 94, undying: 96, dragonWrath: 98, monarch: 90, soulSiphon: 88
};

function skillScore(id) {
  return SKILL_SCORE[id] || 40;
}

function answerPending(state) {
  const pending = state.pendingQuestion;
  if (!pending || !pending.caseData) return false;
  const caseData = pending.caseData;
  const diagnosis = caseData.diagnoses.find(function (item) { return item.correct; })
    || caseData.diagnoses[0];
  const answer = {
    diagnosisId: diagnosis.id,
    checkIds: caseData.checks.filter(function (item) { return item.points >= 10; })
      .slice(0, 2).map(function (item) { return item.id; }),
    prescriptionId: caseData.prescriptions[0].id,
    text: ''
  };
  const judged = Questions.localJudge(caseData, answer);
  return P.answerQuestion(state, answer, judged).ok;
}

function attackable(state) {
  const stats = state.player.stats;
  return state.monsters.filter(function (monster) {
    const dist = Grid.manhattan(monster.pos, state.player.pos);
    if (dist > stats.range) return false;
    if (stats.range > 1 && !Grid.hasLineOfSight(state.board, state.player.pos, monster.pos)) return false;
    return true;
  });
}

function nearestMonster(state) {
  return state.monsters.slice().sort(function (a, b) {
    return Grid.manhattan(a.pos, state.player.pos) - Grid.manhattan(b.pos, state.player.pos);
  })[0] || null;
}

function bestClusterTile(state, skillId) {
  const def = CONFIG.skillMap[skillId];
  const active = def.active;
  let best = null;
  for (let y = 0; y < state.board.size; y += 1) {
    for (let x = 0; x < state.board.size; x += 1) {
      if (Grid.manhattan(state.player.pos, { x: x, y: y }) > active.range) continue;
      if (!Grid.hasLineOfSight(state.board, state.player.pos, { x: x, y: y })) continue;
      let hits = 0;
      state.monsters.forEach(function (monster) {
        if (Grid.manhattan(monster.pos, { x: x, y: y }) <= (active.radius || 0)) hits += 1;
      });
      if (hits > 0 && (!best || hits > best.hits)) best = { x: x, y: y, hits: hits };
    }
  }
  return best;
}

function castBestSkill(state) {
  const owned = state.player.skills.filter(function (skill) {
    const def = CONFIG.skillMap[skill.id];
    return def && def.type === 'active' && skill.cd <= 0;
  });
  for (let i = 0; i < owned.length; i += 1) {
    const skill = owned[i];
    const def = CONFIG.skillMap[skill.id];
    if (def.id === 'heal') {
      if (state.player.hp < state.player.stats.maxHp * 0.55) {
        if (P.useSkill(state, skill.id, {}).ok) return true;
      }
      continue;
    }
    if (def.id === 'fireball' || def.id === 'meteor') {
      const tile = bestClusterTile(state, skill.id);
      if (tile) {
        if (P.useSkill(state, skill.id, { x: tile.x, y: tile.y }).ok) return true;
      }
      continue;
    }
    if (def.id === 'frostnova') {
      const near = state.monsters.some(function (monster) {
        return Grid.manhattan(monster.pos, state.player.pos) <= 2;
      });
      if (near && P.useSkill(state, skill.id, {}).ok) return true;
      continue;
    }
    if (def.id === 'whirlwind') {
      const near = state.monsters.some(function (monster) {
        return Grid.manhattan(monster.pos, state.player.pos) <= 1;
      });
      if (near && P.useSkill(state, skill.id, {}).ok) return true;
      continue;
    }
    if (def.id === 'soulSiphon') {
      const target = attackable(state)[0];
      if (target && P.useSkill(state, skill.id, { monsterId: target.id, x: target.pos.x, y: target.pos.y }).ok) return true;
    }
  }
  return false;
}

function dodgeTelegraph(state) {
  if (!state.telegraph || !state.telegraph.tiles) return false;
  const danger = new Set(state.telegraph.tiles.map(function (t) { return t.x + ',' + t.y; }));
  if (!danger.has(Grid.key(state.player.pos))) return false;
  if (state.player.stamina < 1) return false;
  const target = state.telegraph.tiles[0];
  const info = P.playerReachable(state);
  let safe = null;
  Grid.neighbors(state.board, state.player.pos).forEach(function (tile) {
    if (Grid.isBlocked(state.board, tile.x, tile.y)) return;
    if (state.monsters.some(function (m) { return m.pos.x === tile.x && m.pos.y === tile.y; })) return;
    if (danger.has(Grid.key(tile))) return;
    const score = Grid.manhattan(tile, target);
    if (!safe || score > safe.score) safe = { x: tile.x, y: tile.y, score: score };
  });
  if (!safe) return false;
  void info;
  return P.movePlayer(state, safe.x, safe.y).ok;
}

function moveTowardAny(state) {
  if (state.player.stamina < 1) return false;
  // 最近的怪可能被别的怪堵住，按距离依次换目标，避免 Bot 原地卡死
  const ordered = state.monsters.slice().sort(function (a, b) {
    return Grid.manhattan(a.pos, state.player.pos) - Grid.manhattan(b.pos, state.player.pos);
  });
  for (let i = 0; i < ordered.length; i += 1) {
    const monster = ordered[i];
    const blocked = new Set(state.monsters.filter(function (m) {
      return m !== monster;
    }).map(function (m) { return Grid.key(m.pos); }));
    const path = Grid.findPath(state.board, state.player.pos, monster.pos, blocked);
    if (!path || !path.length) continue;
    if (P.movePlayer(state, path[0].x, path[0].y).ok) return true;
  }
  return false;
}

function botBattle(state) {
  let riceUsed = false;
  let guard = 0;
  while (state.phase === 'battle' && guard < 160) {
    guard += 1;
    const player = state.player;

    if (player.stun > 0) {
      if (P.struggle(state).ok) continue;
      break;
    }
    if (!riceUsed && player.rice > 0 && player.hp < player.stats.maxHp * 0.45) {
      riceUsed = true;
      if (P.useRice(state).ok) continue;
    }
    if (dodgeTelegraph(state)) continue;
    if (castBestSkill(state)) continue;

    const targets = attackable(state).sort(function (a, b) { return a.hp - b.hp; });
    if (targets.length) {
      if (P.playerAttack(state, targets[0].id).ok) continue;
    }

    const nearest = nearestMonster(state);
    if (!nearest) break;
    if (state.player.stamina < 1) {
      if (P.rest(state).ok) continue;
      break;
    }
    if (moveTowardAny(state)) continue;
    if (P.rest(state).ok) continue;
    break;
  }
}

function chooseBestChoice(state, choices) {
  let best = null;
  let bestScore = -Infinity;
  choices.forEach(function (choice) {
    if (choice.type === 'token') {
      const score = 35;
      if (score > bestScore) {
        best = choice;
        bestScore = score;
      }
      return;
    }
    const def = CONFIG.skillMap[choice.skillId];
    let score = skillScore(choice.skillId);
    if (choice.kind === 'upgrade') score += 22;
    if (state.player.skills.length >= state.player.slots && choice.kind === 'new') score -= 8;
    if (def && def.classOnly && def.classOnly !== state.classId) score = -1;
    if (score > bestScore) {
      best = choice;
      bestScore = score;
    }
  });
  return best;
}

function worstOwned(state) {
  let worst = null;
  state.player.skills.forEach(function (skill) {
    if (!worst || skillScore(skill.id) < skillScore(worst.id)) worst = skill;
  });
  return worst;
}

function chooseDialogue(state, dialogue) {
  let best = null;
  let bestScore = -Infinity;
  dialogue.choices.forEach(function (choice) {
    let score = 0;
    Object.keys(choice.axes || {}).forEach(function (key) {
      score += key === 'reliance' ? -choice.axes[key] * 2 : choice.axes[key];
    });
    if (score > bestScore) {
      best = choice;
      bestScore = score;
    }
  });
  return best;
}

function resolveSkillChoice(state, choice) {
  if (!choice) return;
  const applied = P.applyChoice(state, choice);
  if (applied.result.type === 'needsSwap') {
    const worst = worstOwned(state);
    if (worst) P.swapAndApply(state, applied.result.skillId, worst.id);
  }
}

function buyFromShop(state) {
  if (!state.shop) return;
  let guard = 0;
  while (state.shop && guard < 12) {
    guard += 1;
    let spent = false;
    const weaponLevel = state.player.weapon.level;
    const weaponMax = CONFIG.weapons[state.player.weapon.id].maxLevel;
    if (weaponLevel < weaponMax) {
      const cost = CONFIG.combat.weaponCostBase + CONFIG.combat.weaponCostPerLevel * (weaponLevel - 1);
      if (state.player.tokens >= cost + 3) {
        if (P.upgradeWeapon(state).ok) {
          spent = true;
          continue;
        }
      }
    }
    for (let i = 0; i < state.shop.items.length; i += 1) {
      const item = state.shop.items[i];
      if (item.sold || state.player.tokens < item.price) continue;
      if (item.type === 'rice') {
        if (state.player.rice < 2 && Shop.buy(state, i).ok) {
          spent = true;
          break;
        }
      } else if (item.type === 'slot') {
        if (state.player.slots < 8 && state.player.tokens >= item.price + 24 && Shop.buy(state, i).ok) {
          spent = true;
          break;
        }
      } else if (item.kind === 'upgrade') {
        if (Shop.buy(state, i).ok) {
          spent = true;
          break;
        }
      } else if (state.player.skills.length < state.player.slots) {
        if (Shop.buy(state, i).ok) {
          spent = true;
          break;
        }
      }
    }
    if (!spent) break;
  }
}

function botRewards(state) {
  if (state.pendingBossDialogue) {
    const choice = chooseDialogue(state, state.pendingBossDialogue);
    P.applyBossDialogue(state, choice.id);
  }
  if (state.pendingBossReward) {
    resolveSkillChoice(state, chooseBestChoice(state, state.pendingBossReward.choices));
    state.pendingBossReward = null;
  }
  if (state.pendingSkillReward) {
    resolveSkillChoice(state, chooseBestChoice(state, state.pendingSkillReward.choices));
    state.pendingSkillReward = null;
  }
  buyFromShop(state);
  return P.nextRound(state).ok;
}

function chooseFinal(state) {
  const a = Endings.axesPercent(state);
  if (a.teaching >= 55) return 'teach';
  if (a.practice >= 55) return 'share';
  if (a.knowledge >= 65 && a.critical >= 55) return 'ask';
  if (a.critical >= 50) return 'ask';
  if (a.reliance >= 60) return 'rely';
  return 'home';
}

function botRune(state) {
  let guard = 0;
  while (state.phase === 'rune' && guard < 20) {
    guard += 1;
    if (!state.rune) break;
    if (state.player.pos.x === state.rune.x && state.player.pos.y === state.rune.y) break;
    const path = Grid.findPath(state.board, state.player.pos, state.rune, new Set());
    if (!path || !path.length) break;
    const result = P.movePlayer(state, path[0].x, path[0].y);
    if (!result.ok) break;
    if (state.phase === 'dialogue') break;
  }
  if (state.phase === 'dialogue') {
    const choice = chooseFinal(state);
    P.applyFinalDialogue(state, choice);
  }
}

function simulateRun(options) {
  const opts = options || {};
  const state = State.createRun({
    classId: opts.classId || 'warrior',
    seed: opts.seed == null ? 1 : opts.seed
  });
  const events = [];
  P.startRound(state, events, true);

  let guard = 0;
  while (state.phase !== 'over' && state.phase !== 'ending' && guard < 8000) {
    guard += 1;
    if (state.phase === 'question') {
      if (!answerPending(state)) break;
      continue;
    }
    if (state.phase === 'battle') {
      botBattle(state);
      continue;
    }
    if (state.phase === 'reward') {
      if (!botRewards(state)) break;
      continue;
    }
    if (state.phase === 'rune') {
      botRune(state);
      continue;
    }
    break;
  }

  return {
    seed: state.seed,
    classId: state.classId,
    result: state.result || (state.player.dead ? 'defeat' : 'unfinished'),
    ending: state.ending ? state.ending.id : null,
    stage: state.stats.stageReached || state.stage,
    kills: state.stats.kills,
    tokens: state.stats.tokensEarned,
    questions: state.stats.questionsAnswered,
    weapon: state.player.weapon.level,
    slots: state.player.slots,
    rice: state.player.rice,
    skills: state.player.skills.map(function (skill) { return skill.id + ':' + skill.level; }),
    axes: Questions.axesPercent(state),
    hp: state.player.hp,
    maxHp: state.player.stats.maxHp
  };
}

function parseArgs(argv) {
  const options = { runs: 200, seed: 1, classId: 'warrior', verbose: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--runs') options.runs = Number(argv[++i]);
    else if (arg === '--seed') options.seed = Number(argv[++i]);
    else if (arg === '--class') options.classId = argv[++i];
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--json') options.json = true;
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const runs = [];
  for (let i = 0; i < options.runs; i += 1) {
    runs.push(simulateRun({ classId: options.classId, seed: options.seed + i }));
  }
  const victories = runs.filter(function (run) { return run.result === 'victory'; }).length;
  const avg = function (fn) {
    return runs.reduce(function (sum, run) { return sum + fn(run); }, 0) / runs.length;
  };
  const endings = {};
  runs.forEach(function (run) {
    const key = run.ending || 'none';
    endings[key] = (endings[key] || 0) + 1;
  });
  const summary = {
    classId: options.classId,
    runs: options.runs,
    victoryRate: victories / runs.length,
    avgStage: avg(function (run) { return run.stage; }),
    avgKills: avg(function (run) { return run.kills; }),
    avgTokens: avg(function (run) { return run.tokens; }),
    avgQuestions: avg(function (run) { return run.questions; }),
    avgWeapon: avg(function (run) { return run.weapon; }),
    endings: endings
  };
  if (options.json) {
    console.log(JSON.stringify({ summary: summary, runs: runs }, null, 2));
    return;
  }
  console.log('职业:', options.classId, '局数:', options.runs);
  console.log('胜率:', (summary.victoryRate * 100).toFixed(1) + '%');
  console.log('平均到达关卡:', summary.avgStage.toFixed(1));
  console.log('平均击杀:', summary.avgKills.toFixed(1));
  console.log('平均 Token:', summary.avgTokens.toFixed(0));
  console.log('平均诊疗:', summary.avgQuestions.toFixed(1));
  console.log('平均武器等级:', summary.avgWeapon.toFixed(1));
  console.log('结局分布:', JSON.stringify(endings));
  if (options.verbose) {
    runs.slice(0, 10).forEach(function (run) {
      console.log(' -', JSON.stringify({ seed: run.seed, result: run.result, stage: run.stage, ending: run.ending, hp: run.hp, maxHp: run.maxHp }));
    });
  }
}

module.exports = {
  simulateRun: simulateRun,
  skillScore: skillScore,
  botBattle: botBattle,
  botRewards: botRewards,
  botRune: botRune,
  answerPending: answerPending
};

if (require.main === module) {
  main();
}
