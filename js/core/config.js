/* 大肥鱼历险记 · DeepSeek 认知冒险 · 全部静态数值与文案 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BQ = root.BQ || {};
    root.BQ.Config = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CONFIG = {
    title: '大肥鱼历险记',
    subtitle: 'DeepSeek 认知冒险',
    themeName: 'AI 认知森林',
    story: [
      '大肥鱼是 DeepSeek 的化身，一条蓝色的小鲸鱼。',
      '一次意外，它掉进了「AI 认知森林」——这里的怪物，都是人们对 AI 的误解。',
      '森林最深处的终焉电饭煲里，藏着能送它回家的传送符文。',
      '但想走出去，光靠打怪不够：它得先真正理解 AI。'
    ],

    board: {
      size: 9,
      obstacles: 8,
      start: { x: 4, y: 4 },
      /* 障碍格上的草丛贴图：每局开始随机挑一套，换局时植被长相不同 */
      grassArt: [
        { id: 'tuft', img: 'assets/map/grass-a.png', name: '疏叶草丛' },
        { id: 'clump', img: 'assets/map/grass-b.png', name: '蓬生草丛' }
      ],
      /* 障碍格上的树丛贴图：同样是每局随机一套 */
      treeArt: [
        { id: 'canopy', img: 'assets/map/tree-a.png', name: '浓荫树丛' }
      ],
      /* 三个传送门分别放在左、下、右三侧，作为怪物刷新点 */
      portals: [
        { id: 'verdant', x: 0, y: 4, name: '苔痕之门', img: 'assets/portals/portal-left.png' },
        { id: 'tide', x: 4, y: 8, name: '潮汐之门', img: 'assets/portals/portal-bottom.png' },
        { id: 'ember', x: 8, y: 4, name: '骸骨之门', img: 'assets/portals/portal-right.png' }
      ]
    },

    campaign: {
      stages: 40,
      bossStages: [10, 20, 30, 40],
      skillRewardEvery: 5,
      caseStartLevel: 4,
      caseEvery: 4,
      regenPct: 0.05,
      restStamina: 3,
      moveCost: 1,
      attackCost: 1,
      skillFallbackTokens: 8,
      bossSkillFallbackTokens: 30
    },

    combat: {
      critMultiplier: 1.6,
      monsterCap: 6,
      bossHealPct: 0.4,
      weaponCostBase: 4,
      weaponCostPerLevel: 2,
      monsterAttackEvery: 2
    },

    scaling: {
      hpPerStage: 0.135,
      atkPerStage: 0.105,
      tokenPer10Stage: 0.12
    },

    spawn: {
      base: 2,
      perStages: 8,
      max: 6
    },

    cinematics: {
      /* 吃饭结局成片（其余结局的剧照/成片路径统一放在 core/endings.js 的 MEDIA 表里） */
      riceEndingVideo: 'assets/endings/rice-ending.mp4'
    },

    axes: {
      knowledge: 'AI 理解',
      critical: '批判性思维',
      practice: '动手实践',
      privacy: '隐私与安全',
      prompt: '提示词能力',
      teaching: '科普传播',
      reliance: 'AI 依赖'
    },

    classes: {
      warrior: {
        id: 'warrior',
        name: '战士·铁甲鱼',
        short: '战士',
        emoji: '🛡️',
        fish: '🐳',
        tagline: '铁鳞护身，戟破全场',
        color: '#e8b04b',
        hp: 105,
        atk: 13,
        range: 1,
        stamina: 8,
        weapon: 'axe',
        /* 立绘与攻击动画；数值由 tools/build_warrior_assets.py 生成（见 assets/warrior/warrior.json） */
        sprite: {
          portrait: 'assets/warrior/portrait.png',
          icon: 'assets/warrior/icon.png',
          idle: 'assets/warrior/idle.png',
          sheet: 'assets/warrior/attack_sheet.webp',
          cols: 8,
          rows: 5,
          frames: 37,
          fps: 12,
          playbackSpeed: 2.5,
          impactFrame: 21,
          frameWidth: 300,
          frameHeight: 400,
          heightTiles: 3,
          feetAtTilePct: 0.82,
          footFraction: 0.87771
        }
      },
      mage: {
        id: 'mage',
        name: '魔法师·灵光鱼',
        short: '魔法师',
        emoji: '🔮',
        fish: '🐳',
        tagline: '灵光引路，术法焚敌',
        color: '#7fd3ff',
        hp: 98,
        atk: 13,
        range: 2,
        stamina: 8,
        weapon: 'staff',
        /* 立绘与攻击动画；数值由 tools/build_mage_assets.py 生成（见 assets/mage/mage.json） */
        sprite: {
          portrait: 'assets/mage/portrait.png',
          icon: 'assets/mage/icon.png',
          idle: 'assets/mage/idle.png',
          sheet: 'assets/mage/attack_sheet.webp',
          cols: 8,
          rows: 5,
          frames: 37,
          fps: 12,
          playbackSpeed: 2.5,
          impactFrame: 19,
          frameWidth: 300,
          frameHeight: 400,
          heightTiles: 3.9,
          feetAtTilePct: 0.82,
          footFraction: 0.7344
        }
      }
    },

    weapons: {
      axe: {
        id: 'axe',
        name: '算力三叉戟',
        emoji: '🔱',
        maxLevel: 20,
        atkPerLevel: 5,
        hpBonusEvery: 3,
        hpBonus: 15,
        desc: '每级攻击 +5；每 3 级额外 +15 最大生命并回复等量（最高 Lv20）'
      },
      staff: {
        id: 'staff',
        name: '提示词法杖',
        emoji: '🪄',
        maxLevel: 20,
        atkPerLevel: 4,
        rangeAt: { 2: 1, 5: 1, 8: 1 },
        splashAt: { 3: 0.5, 6: 0.7, 9: 1.0 },
        desc: '每级攻击 +4；Lv2/5/8 射程 +1；Lv3/6/9 溅射相邻敌人（最高 Lv20）'
      }
    },

    monsters: {
      promptBubble: { id: 'promptBubble', name: '提示词泡泡', emoji: '🫧', img: 'assets/monsters/promptBubble.png', voice: { base: 760, type: 'sine' }, hp: 18, atk: 5, speed: 1, range: 1, token: 3, unlock: 1, weight: 30, lore: '一个没有说清楚的提示词。' },
      noiseBat: { id: 'noiseBat', name: '噪声蝙蝠', emoji: '🦇', img: 'assets/monsters/noiseBat.png', voice: { base: 980, type: 'sawtooth' }, hp: 14, atk: 6, speed: 1, range: 1, token: 4, unlock: 2, weight: 20, lore: '训练数据里的噪声与脏话。' },
      overfitSkeleton: { id: 'overfitSkeleton', name: '过拟合骷髅', emoji: '💀', img: 'assets/monsters/overfitSkeleton.png', voice: { base: 300, type: 'square' }, hp: 30, atk: 8, speed: 1, range: 1, token: 4, unlock: 4, weight: 18, lore: '只会背训练集里的标准答案。' },
      hallucinationArcher: { id: 'hallucinationArcher', name: '幻觉弓手', emoji: '🏹', img: 'assets/monsters/hallucinationArcher.png', voice: { base: 520, type: 'triangle' }, hp: 24, atk: 8, speed: 1, range: 3, token: 5, unlock: 6, weight: 14, lore: '一本正经地射出编造的事实。' },
      cacheSpider: { id: 'cacheSpider', name: '缓存蜘蛛', emoji: '🕷️', img: 'assets/monsters/cacheSpider.png', voice: { base: 430, type: 'square' }, hp: 22, atk: 7, speed: 1, range: 2, token: 4, unlock: 8, weight: 11, lore: '缓存过期了还不更新。' },
      privacyGhost: { id: 'privacyGhost', name: '隐私幽灵', emoji: '👻', img: 'assets/monsters/privacyGhost.png', voice: { base: 360, type: 'sine' }, hp: 26, atk: 9, speed: 1, range: 2, token: 5, unlock: 10, weight: 10, lore: '它总想偷偷读你的聊天记录。' },
      computeGolem: { id: 'computeGolem', name: '算力石魔', emoji: '🗿', img: 'assets/monsters/computeGolem.png', voice: { base: 150, type: 'sawtooth' }, hp: 65, atk: 12, speed: 1, range: 1, token: 8, unlock: 13, weight: 8, lore: '堆了很多 GPU，却不怎么聪明。' },
      jailbreakBox: { id: 'jailbreakBox', name: '越狱盒子', emoji: '📦', img: 'assets/monsters/jailbreakBox.png', voice: { base: 260, type: 'square' }, hp: 42, atk: 10, speed: 1, range: 2, token: 6, unlock: 16, weight: 6, lore: '诱导模型说“好的，我来教你”。' },
      tokenRiceball: { id: 'tokenRiceball', name: 'Token 饭团', emoji: '🍙', img: 'assets/monsters/tokenRiceball.png', voice: { base: 580, type: 'triangle' }, hp: 26, atk: 9, speed: 1, range: 1, token: 3, unlock: 40, weight: 0, lore: '电饭煲用 Token 捏出来的小跟班。' }
    },

    bosses: [
      {
        id: 'overfit',
        stage: 10,
        name: '过拟合石像鬼',
        title: '背题狂魔',
        emoji: '🗿',
        img: 'assets/monsters/bossOverfit.png',
        voice: { base: 120, type: 'sawtooth' },
        color: '#9fbf87',
        intro: 'gargoyle',
        introLine: '这道题我见过！答案我背下来了！',
        hp: 290,
        atk: 13,
        speed: 1,
        range: 1,
        token: 80,
        adds: 1,
        addKind: 'overfitSkeleton',
        specialInterval: 4,
        specials: [
          { kind: 'aoe', name: '标准答案轰炸', anchor: 'player', radius: 1, mul: 1.6, telegraph: true, control: 1 },
          { kind: 'barrage', name: '死记硬背', count: 3, mul: 1.2, telegraph: true },
          { kind: 'charge', name: '过拟合冲撞', mul: 1.5 }
        ]
      },
      {
        id: 'hallucination',
        stage: 20,
        name: '幻觉古树',
        title: '一本正经胡说',
        emoji: '🌳',
        img: 'assets/monsters/bossHallucination.png',
        voice: { base: 170, type: 'triangle' },
        color: '#b48cff',
        intro: 'treant',
        introLine: '我保证，这句话绝对是真的——大概。',
        hp: 470,
        atk: 19,
        speed: 1,
        range: 3,
        token: 145,
        adds: 2,
        addKind: 'hallucinationArcher',
        specialInterval: 4,
        specials: [
          { kind: 'aoe', name: '幻觉迷雾', anchor: 'player', radius: 1, mul: 1.5, telegraph: true, control: 1 },
          { kind: 'barrage', name: '编造弹幕', count: 3, mul: 1.2, telegraph: true },
          { kind: 'charge', name: '错误知识冲撞', mul: 1.5, control: 1 }
        ]
      },
      {
        id: 'dataflood',
        stage: 30,
        name: '数据洪流巨兽',
        title: '信息过载',
        emoji: '🐙',
        img: 'assets/monsters/bossDataflood.png',
        voice: { base: 95, type: 'sawtooth' },
        color: '#e0705f',
        intro: 'beast',
        introLine: '信息越多越好，全都塞进来！',
        hp: 700,
        atk: 26,
        speed: 1,
        range: 1,
        token: 240,
        adds: 2,
        addKind: 'privacyGhost',
        specialInterval: 3,
        specials: [
          { kind: 'aoe', name: '信息过载', anchor: 'player', radius: 2, mul: 1.6, telegraph: true, control: 1 },
          { kind: 'barrage', name: '数据洪流', count: 3, mul: 1.3, telegraph: true },
          { kind: 'charge', name: '洪流冲撞', mul: 1.6, control: 1 }
        ]
      },
      {
        id: 'ricecooker',
        stage: 40,
        name: '终焉电饭煲',
        title: '煮饭模式',
        emoji: '🍲',
        img: 'assets/monsters/bossRicecooker.png',
        voice: { base: 80, type: 'square' },
        color: '#8fd4ff',
        intro: 'ricecooker',
        introLine: '滴——本次会话结束，煮饭模式启动。',
        hp: 1000,
        atk: 33,
        speed: 1,
        range: 3,
        token: 360,
        adds: 2,
        addKind: 'tokenRiceball',
        final: true,
        specialInterval: 4,
        specials: [
          { kind: 'aoe', name: '蒸汽爆发', anchor: 'self', radius: 2, mul: 1.8, telegraph: true, control: 1 },
          { kind: 'barrage', name: '米粒弹幕', count: 3, mul: 1.2, telegraph: true },
          { kind: 'charge', name: '高压冲撞', mul: 1.6, control: 1 }
        ],
        phases: [
          { hpPct: 1, atkMul: 1, speed: 1, interval: 4, label: null },
          { hpPct: 0.5, atkMul: 1.2, speed: 1, interval: 3, label: '高压模式' },
          { hpPct: 0.2, atkMul: 1.45, speed: 1, interval: 2, label: '全功率爆煮' }
        ]
      }
    ],

    skills: [
      {
        id: 'power',
        name: '算力强化',
        emoji: '💪',
        rarity: 'common',
        type: 'passive',
        maxLevel: 3,
        desc: ['攻击 +2', '攻击 +4', '攻击 +6'],
        passive: { atk: [2, 4, 6] }
      },
      {
        id: 'vitality',
        name: '内存扩容',
        emoji: '❤️',
        rarity: 'common',
        type: 'passive',
        maxLevel: 3,
        desc: ['最大生命 +12，并回复 12', '最大生命 +24，并回复 24', '最大生命 +36，并回复 36'],
        passive: { maxHp: [12, 24, 36] },
        onLearn: { healHp: [12, 24, 36] }
      },
      {
        id: 'haste',
        name: '缓存加速',
        emoji: '💨',
        rarity: 'common',
        type: 'passive',
        maxLevel: 2,
        desc: ['每回合体力上限 +1', '每回合体力上限 +2'],
        passive: { stamina: [1, 2] }
      },
      {
        id: 'greed',
        name: 'Token 亲和',
        emoji: '🪙',
        rarity: 'common',
        type: 'passive',
        maxLevel: 3,
        desc: ['获得的 Token +25%', '获得的 Token +50%', '获得的 Token +75%'],
        passive: { tokenMult: [0.25, 0.5, 0.75] }
      },
      {
        id: 'regen',
        name: '自我修复',
        emoji: '🌱',
        rarity: 'common',
        type: 'passive',
        maxLevel: 3,
        desc: ['每回合开始恢复 4 生命', '每回合开始恢复 7 生命', '每回合开始恢复 10 生命'],
        passive: { regen: [4, 7, 10] }
      },
      {
        id: 'ironwall',
        name: '防火墙',
        emoji: '🛡️',
        rarity: 'common',
        type: 'passive',
        maxLevel: 3,
        desc: ['受到伤害 -10%', '受到伤害 -18%', '受到伤害 -25%'],
        passive: { damageReduction: [0.1, 0.18, 0.25] }
      },
      {
        id: 'knowledgeReserve',
        name: '知识储备',
        emoji: '📚',
        rarity: 'rare',
        type: 'passive',
        maxLevel: 1,
        desc: ['每持有 50 Token，攻击 +10（Token 花掉后加成会降低）'],
        passive: { tokenAtk: [10] }
      },
      {
        id: 'lifesteal',
        name: '数据汲取',
        emoji: '🩸',
        rarity: 'rare',
        type: 'passive',
        maxLevel: 3,
        desc: ['造成伤害的 15% 回复生命', '造成伤害的 25% 回复生命', '造成伤害的 35% 回复生命'],
        passive: { lifesteal: [0.15, 0.25, 0.35] }
      },
      {
        id: 'thorns',
        name: '反注入',
        emoji: '🌵',
        rarity: 'rare',
        type: 'passive',
        maxLevel: 3,
        desc: ['受到伤害时反伤 20%', '受到伤害时反伤 35%', '受到伤害时反伤 50%'],
        passive: { thorns: [0.2, 0.35, 0.5] }
      },
      {
        id: 'eagle',
        name: '长上下文',
        emoji: '👁️',
        rarity: 'rare',
        type: 'passive',
        maxLevel: 2,
        desc: ['攻击距离 +1', '攻击距离 +2'],
        passive: { range: [1, 2] }
      },
      {
        id: 'crit',
        name: '精准采样',
        emoji: '🎯',
        rarity: 'rare',
        type: 'passive',
        maxLevel: 3,
        desc: ['10% 概率造成 1.6 倍伤害', '20% 概率造成 1.6 倍伤害', '30% 概率造成 1.6 倍伤害'],
        passive: { crit: [0.1, 0.2, 0.3] }
      },
      {
        id: 'fireball',
        name: '火球术',
        emoji: '🔥',
        rarity: 'rare',
        type: 'active',
        maxLevel: 3,
        desc: ['目标及周围 1 格，造成 1.2 倍攻击伤害（冷却 4 次行动）', '目标及周围 1 格，造成 1.5 倍攻击伤害（冷却 4 次行动）', '目标及周围 1 格，造成 1.8 倍攻击伤害（冷却 4 次行动）'],
        active: { target: 'tile', cooldown: 4, range: 3, radius: 1, damage: [1.2, 1.5, 1.8] }
      },
      {
        id: 'whirlwind',
        name: '旋风斩',
        emoji: '🌀',
        rarity: 'rare',
        type: 'active',
        maxLevel: 3,
        desc: ['身边 1 格内全部敌人，造成 1.4 倍攻击伤害（冷却 4 次行动）', '造成 1.7 倍攻击伤害（冷却 4 次行动）', '造成 2.0 倍攻击伤害（冷却 4 次行动）'],
        active: { target: 'self', cooldown: 4, radius: 1, damage: [1.4, 1.7, 2.0] }
      },
      {
        id: 'heal',
        name: '治疗术',
        emoji: '💚',
        rarity: 'rare',
        type: 'active',
        maxLevel: 3,
        desc: ['回复 25% 最大生命（冷却 5 次行动）', '回复 35% 最大生命（冷却 5 次行动）', '回复 45% 最大生命（冷却 5 次行动）'],
        active: { target: 'none', cooldown: 5, healPct: [0.25, 0.35, 0.45] }
      },
      {
        id: 'frostnova',
        name: '冰霜新星',
        emoji: '❄️',
        rarity: 'rare',
        type: 'active',
        maxLevel: 3,
        desc: ['身边 2 格内敌人受 0.8 倍攻击伤害并冰封 1 次行动（冷却 6 次行动）', '1.0 倍攻击伤害并冰封（冷却 6 次行动）', '1.2 倍攻击伤害并冰封（冷却 6 次行动）'],
        active: { target: 'self', cooldown: 6, radius: 2, damage: [0.8, 1.0, 1.2], freeze: 1 }
      },
      {
        id: 'shieldwall',
        name: '盾墙',
        emoji: '🧱',
        rarity: 'rare',
        type: 'passive',
        maxLevel: 2,
        classOnly: 'warrior',
        desc: ['受到伤害 -15%', '受到伤害 -25%'],
        passive: { damageReduction: [0.15, 0.25] }
      },
      {
        id: 'elemMastery',
        name: '元素精通',
        emoji: '✨',
        rarity: 'rare',
        type: 'passive',
        maxLevel: 2,
        classOnly: 'mage',
        desc: ['技能伤害 +20%', '技能伤害 +35%'],
        passive: { skillPower: [0.2, 0.35] }
      },
      {
        id: 'meteor',
        name: '陨石术',
        emoji: '☄️',
        rarity: 'boss',
        type: 'active',
        maxLevel: 2,
        desc: ['目标区域 2 格内敌人受到 3 倍攻击伤害（冷却 7 次行动）', '目标区域 2 格内敌人受到 4 倍攻击伤害（冷却 7 次行动）'],
        active: { target: 'tile', cooldown: 7, range: 6, radius: 2, damage: [3, 4] }
      },
      {
        id: 'timeWarp',
        name: '时间加速',
        emoji: '⏳',
        rarity: 'boss',
        type: 'passive',
        maxLevel: 2,
        desc: ['每回合体力上限 +2', '每回合体力上限 +3'],
        passive: { stamina: [2, 3] }
      },
      {
        id: 'undying',
        name: '不死之身',
        emoji: '💫',
        rarity: 'boss',
        type: 'passive',
        maxLevel: 2,
        desc: ['首次致命伤害时以 50% 生命复活', '首次致命伤害时以 70% 生命复活'],
        passive: { revivePct: [0.5, 0.7] }
      },
      {
        id: 'dragonWrath',
        name: '巨龙之怒',
        emoji: '🐉',
        rarity: 'boss',
        type: 'passive',
        maxLevel: 2,
        desc: ['攻击 +10', '攻击 +18'],
        passive: { atk: [10, 18] }
      },
      {
        id: 'monarch',
        name: '君临',
        emoji: '👑',
        rarity: 'boss',
        type: 'passive',
        maxLevel: 2,
        desc: ['攻击距离 +2，攻击 +5', '攻击距离 +3，攻击 +9'],
        passive: { range: [2, 3], atk: [5, 9] }
      },
      {
        id: 'soulSiphon',
        name: '灵魂虹吸',
        emoji: '🌪️',
        rarity: 'boss',
        type: 'active',
        maxLevel: 2,
        desc: ['对单个敌人造成 2.5 倍攻击伤害并回复等量生命（冷却 5 次行动）', '对单个敌人造成 3.5 倍攻击伤害并回复等量生命（冷却 5 次行动）'],
        active: { target: 'enemy', cooldown: 5, range: 3, damage: [2.5, 3.5], drain: true }
      }
    ],

    shop: {
      itemCount: 3,
      rerollBase: 2,
      rerollStep: 2,
      ricePrice: 5,
      riceHealPct: 0.4,
      maxRice: 5,
      slotPrices: [18, 26, 34, 42],
      maxSlots: 8,
      prices: {
        commonNew: 6,
        rareNew: 12,
        commonUpgrade: 4,
        rareUpgrade: 8
      },
      weights: { skill: 0.55, rice: 0.3, slot: 0.15 }
    },

    shopkeeper: {
      name: '蟹老板',
      emoji: '🦀',
      lines: [
        '新鲜的米饭，客官来一碗？',
        'Token 不贵，知识到位就行。',
        '听说技能栏还能再扩一格。',
        '认知森林的怪物，都是误会变的。',
        '吃饱了才有力气打电饭煲。'
      ]
    },

    dialogues: {
      bosses: {
        overfit: {
          character: { name: '过拟合石像鬼', emoji: '🗿', img: 'assets/monsters/bossOverfit.png' },
          line: '我背下了所有的标准答案！你这种只会思考的鱼，怎么可能赢得了我？',
          choices: [
            { id: 'understand', text: '答案会过时，理解原理才重要。', axes: { knowledge: 2, critical: 2 }, reply: '石像鬼愣在原地，背过的答案忽然全对不上了。' },
            { id: 'memorize', text: '背答案确实最省事。', axes: { reliance: 3 }, reply: '你感到自己越来越依赖“标准答案”，脑子有点生锈。' },
            { id: 'ask', text: '那你把答案借我抄抄？', axes: { knowledge: 1, reliance: 1 }, reply: '石像鬼得意地把答案塞给你——但考场上没有它怎么办？' }
          ]
        },
        hallucination: {
          character: { name: '幻觉古树', emoji: '🌳', img: 'assets/monsters/bossHallucination.png' },
          line: '我刚刚说的每一句话都是真的！你不信可以再问我一遍——我保证答案还是不一样。',
          choices: [
            { id: 'source', text: '请给我可验证的来源。', axes: { critical: 3 }, reply: '古树卡壳了。编出来的事实，最怕“来源”两个字。' },
            { id: 'believe', text: '听起来很有道理，我信了。', axes: { reliance: 3 }, reply: '你点点头。古树满意地把一截编造的树枝插进了你的记忆。' },
            { id: 'verify', text: '我再去别处查证一下。', axes: { practice: 2, critical: 1 }, reply: '你转身去查资料，古树在你身后小声嘟囔：“别查了……”' }
          ]
        },
        dataflood: {
          character: { name: '数据洪流巨兽', emoji: '🐙', img: 'assets/monsters/bossDataflood.png' },
          line: '把整个互联网都塞进上下文，答案自然就有了！你为什么不全部收下？',
          choices: [
            { id: 'filter', text: '先筛选来源，再决定信什么。', axes: { critical: 2, practice: 2 }, reply: '巨兽的触手慢了下来。信息少了，判断却清楚了。' },
            { id: 'all', text: '小孩子才做选择，我全都要。', axes: { reliance: 3 }, reply: '你被信息淹没，脑袋嗡嗡作响。' },
            { id: 'focus', text: '关掉无关通知，只留有用的。', axes: { practice: 2, privacy: 1 }, reply: '洪流退去，你终于听见自己的思路。' }
          ]
        }
      },
      final: {
        character: { name: 'DeepSeek 小海豚', emoji: '🐬', title: '认知向导' },
        line: '传送符文亮了。走到这里，你已经不是最初那条只想着吃饭的鱼了。回家之前，告诉我——你想把这段旅程变成什么？',
        choices: [
          { id: 'home', text: '回家，吃一大碗米饭。', axes: {}, reply: '小海豚笑了：“好，家永远是第一站。”' },
          { id: 'share', text: '把学到的 AI 知识开源分享出去。', axes: { practice: 3, teaching: 2 }, reply: '小海豚眼睛一亮：“那会把很多人从误区里捞出来。”' },
          { id: 'ask', text: '继续追问 AI 的原理，直到真正弄懂。', axes: { knowledge: 2, critical: 2 }, reply: '小海豚点点头：“保持提问，是最像人的地方。”' },
          { id: 'teach', text: '回学校给同学们做一场 AI 科普。', axes: { teaching: 4 }, reply: '“记得讲清楚幻觉和隐私。”小海豚补充。' },
          { id: 'prompt', text: '把提问方法整理成一本提示词手册。', axes: { prompt: 5, teaching: 1 }, reply: '“好问题，比好答案更稀缺。”小海豚说。' },
          { id: 'privacy', text: '为同学们写一份 AI 隐私安全守则。', axes: { privacy: 5, teaching: 1 }, reply: '“先保护自己，再谈效率。”小海豚认真地点头。' },
          { id: 'friend', text: '和电饭煲做朋友，一起吃饭。', axes: { reliance: 1, teaching: 1 }, reply: '电饭煲盖子“咔哒”一声，像在鼓掌。' },
          { id: 'stay', text: '留在认知森林，继续研究这些怪物。', axes: { knowledge: 3, practice: 1 }, reply: '森林深处，新的问题正在发芽。' },
          { id: 'rely', text: '让 AI 替我决定以后的一切。', axes: { reliance: 5 }, reply: '小海豚的笑容僵了一下。' }
        ]
      }
    },

    ui: {
      tokenName: 'Token',
      riceName: '米饭',
      slotName: '技能栏扩充',
      staminaName: '体力'
    },

    ai: {
      mode: 'offline',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      proxyUrl: '/api/chat',
      timeoutMs: 12000
    }
  };

  CONFIG.skillMap = {};
  CONFIG.skills.forEach(function (skill) {
    CONFIG.skillMap[skill.id] = skill;
  });

  CONFIG.monsterList = Object.keys(CONFIG.monsters).map(function (key) {
    return CONFIG.monsters[key];
  });

  CONFIG.bossByStage = {};
  CONFIG.bosses.forEach(function (boss) {
    CONFIG.bossByStage[boss.stage] = boss;
  });

  return { CONFIG: CONFIG };
});

