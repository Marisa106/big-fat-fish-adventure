/* 游戏状态：建局、日志、派生属性入口 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({
      Config: require('./config.js'),
      Rng: require('./rng.js'),
      Grid: require('./grid.js'),
      Stats: require('./stats.js')
    });
  } else {
    root.BQ = root.BQ || {};
    root.BQ.State = factory(root.BQ);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BQ) {
  'use strict';

  const CONFIG = BQ.Config.CONFIG;
  const Rng = BQ.Rng;
  const Grid = BQ.Grid;
  const Stats = BQ.Stats;

  function pushLog(state, text) {
    if (!text) return;
    state.log.push({ text: text, stage: state.stage });
    if (state.log.length > 60) state.log.shift();
  }

  function emptyAxes() {
    const out = {};
    Object.keys(CONFIG.axes).forEach(function (key) {
      out[key] = 0;
    });
    return out;
  }

  function createRun(opts) {
    const options = opts || {};
    const classId = options.classId === 'mage' ? 'mage' : 'warrior';
    const seed = Rng.hashSeed(options.seed == null ? Date.now() : options.seed);
    const rng = Rng.create(seed);
    const board = Grid.createBoard({
      size: CONFIG.board.size,
      obstacles: CONFIG.board.obstacles,
      start: CONFIG.board.start,
      portals: CONFIG.board.portals,
      random: function () {
        return rng.next();
      }
    });
    const cls = CONFIG.classes[classId];
    /* 本局植被皮肤：单独取一条随机流，避免影响既有种子的地图布局 */
    const decorRng = Rng.create((seed ^ 0x9e3779b9) >>> 0);
    const grassArt = CONFIG.board.grassArt || [];
    const treeArt = CONFIG.board.treeArt || [];
    const grass = grassArt.length ? decorRng.pick(grassArt) : null;
    const tree = treeArt.length ? decorRng.pick(treeArt) : null;
    const player = {
      pos: { x: CONFIG.board.start.x, y: CONFIG.board.start.y },
      hp: cls.hp,
      stamina: cls.stamina,
      weapon: { id: cls.weapon, level: 1 },
      skills: [],
      slots: 4,
      rice: 0,
      tokens: 0,
      stun: 0,
      reviveUsed: false,
      dead: false,
      stats: null
    };
    const state = {
      seed: seed,
      rng: rng,
      classId: classId,
      board: board,
      /* 本局使用的植被素材（每局随机），渲染层只读 */
      decor: {
        grass: grass,
        grassIndex: grass ? grassArt.indexOf(grass) : -1,
        tree: tree,
        treeIndex: tree ? treeArt.indexOf(tree) : -1
      },
      player: player,
      stage: 0,
      phase: 'battle',
      monsters: [],
      nextMonsterId: 1,
      boss: null,
      telegraph: null,
      shop: null,
      pendingBoss: null,
      pendingBossReward: null,
      pendingSkillReward: null,
      pendingQuestion: null,
      pendingBossDialogue: null,
      pendingFinalDialogue: null,
      lastDialogue: null,
      bossDefeated: false,
      lastBoss: null,
      finalChoice: null,
      questionAnswers: [],
      axes: emptyAxes(),
      rune: null,
      ending: null,
      result: null,
      flags: { skillOffered: false, bossDialogueShown: false, finalAnswered: false },
      log: [],
      stats: {
        kills: 0,
        tokensEarned: 0,
        riceEaten: 0,
        stageReached: 0,
        questionsAnswered: 0,
        startedAt: Date.now()
      }
    };
    Stats.recompute(state);
    player.hp = player.stats.maxHp;
    player.stamina = player.stats.stamina;
    pushLog(state, '大肥鱼掉进了 AI 认知森林。');
    return state;
  }

  return {
    createRun: createRun,
    pushLog: pushLog,
    emptyAxes: emptyAxes
  };
});
