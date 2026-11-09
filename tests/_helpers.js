'use strict';

const State = require('../js/core/state.js');
const P = require('../js/core/progression.js');
const Grid = require('../js/core/grid.js');
const Combat = require('../js/core/combat.js');
const Monsters = require('../js/core/monsters.js');
const Stats = require('../js/core/stats.js');
const Questions = require('../js/core/questions.js');
const Endings = require('../js/core/endings.js');
const CONFIG = require('../js/core/config.js').CONFIG;

function makeRun(opts) {
  const options = opts || {};
  return State.createRun({
    classId: options.classId || 'warrior',
    seed: options.seed == null ? 1234 : options.seed
  });
}

function begin(state, stage, opts) {
  const options = opts || {};
  state.stage = (stage || 1) - 1;
  if (!options.questions) state.devSkipQuestions = true;
  P.startRound(state, [], true);
  return state;
}

function buff(state, overrides) {
  const patch = overrides || {};
  const stats = state.player.stats;
  stats.atk = patch.atk == null ? 60 : patch.atk;
  stats.maxHp = patch.maxHp == null ? 9999 : patch.maxHp;
  stats.range = patch.range == null ? 3 : patch.range;
  stats.stamina = patch.stamina == null ? 8 : patch.stamina;
  stats.crit = patch.crit == null ? 0 : patch.crit;
  stats.splash = patch.splash == null ? 0 : patch.splash;
  stats.damageReduction = patch.damageReduction == null ? 0 : patch.damageReduction;
  stats.thorns = patch.thorns == null ? 0 : patch.thorns;
  stats.tokenMult = patch.tokenMult == null ? 1 : patch.tokenMult;
  state.player.hp = stats.maxHp;
  state.player.stamina = stats.stamina;
  return state;
}

function clearMonsters(state) {
  state.monsters = [];
  return state;
}

function freeNeighbor(state, pos) {
  const playerKey = Grid.key(state.player.pos);
  return Grid.neighbors(state.board, pos).find(function (tile) {
    if (Grid.isBlocked(state.board, tile.x, tile.y)) return false;
    if (state.monsters.some(function (m) { return m.pos.x === tile.x && m.pos.y === tile.y; })) return false;
    if (tile.x + ',' + tile.y === playerKey) return false;
    return true;
  });
}

function addMonster(state, kind, pos, overrides) {
  const monster = Monsters.createMonster(state, kind || 'promptBubble', pos);
  Object.assign(monster, overrides || {});
  state.monsters.push(monster);
  return monster;
}

function findBoss(state) {
  return state.monsters.find(function (m) { return m.isBoss; }) || null;
}

function standAdjacent(state, targetPos) {
  const spot = freeNeighbor(state, targetPos);
  if (!spot) throw new Error('no free neighbor');
  state.player.pos = { x: spot.x, y: spot.y };
  return spot;
}

function answerCurrent(state, optionIndex) {
  const pending = state.pendingQuestion;
  if (!pending || !pending.caseData) throw new Error('no pending case');
  const caseData = pending.caseData;
  const diagnosis = caseData.diagnoses[optionIndex || 0] || caseData.diagnoses[0];
  const answer = {
    diagnosisId: diagnosis.id,
    checkIds: caseData.checks.filter(function (item) { return item.points >= 10; })
      .slice(0, 2).map(function (item) { return item.id; }),
    prescriptionId: caseData.prescriptions[0].id,
    text: ''
  };
  const judged = Questions.localJudge(caseData, answer);
  return P.answerQuestion(state, answer, judged);
}

function reachableNeighbor(state, target) {
  const blocked = new Set(state.monsters.map(function (m) { return Grid.key(m.pos); }));
  const result = Grid.reachable(state.board, state.player.pos, Grid.makeBlockedFn(state.board, blocked));
  return result;
}

module.exports = {
  CONFIG: CONFIG,
  State: State,
  P: P,
  Grid: Grid,
  Combat: Combat,
  Monsters: Monsters,
  Stats: Stats,
  Questions: Questions,
  Endings: Endings,
  makeRun: makeRun,
  begin: begin,
  buff: buff,
  clearMonsters: clearMonsters,
  freeNeighbor: freeNeighbor,
  addMonster: addMonster,
  findBoss: findBoss,
  standAdjacent: standAdjacent,
  answerCurrent: answerCurrent,
  reachableNeighbor: reachableNeighbor
};
