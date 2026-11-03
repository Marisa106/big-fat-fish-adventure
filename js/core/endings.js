/* 12 种结局与判定规则 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({ Config: require('./config.js'), Questions: require('./questions.js') });
  } else {
    root.BQ = root.BQ || {};
    root.BQ.Endings = factory(root.BQ);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BQ) {
  'use strict';

  const CONFIG = BQ.Config.CONFIG;
  const Questions = BQ.Questions;

  const ENDINGS = [
    {
      id: 'rice',
      title: '开饭啦',
      subtitle: '最朴素的归途',
      kind: 'normal',
      emoji: '🐟🍚',
      theme: 'home',
      description: '你没有成为什么大人物，只是安安静静地回到了家。桌上那碗米饭还冒着热气。',
      lines: ['传送符文把你送回了家。', '米饭很香，日子很慢。', '理解 AI，也可以只是为了更好地生活。']
    },
    {
      id: 'openSource',
      title: '开源的鱼',
      subtitle: '把知识分享出去',
      kind: 'good',
      emoji: '💻🐟',
      theme: 'open',
      description: '你把自己在认知森林里学到的东西整理成开源笔记。很快，更多小鱼顺着你的代码游了进来。',
      lines: ['你把 AI 学习笔记开源了。', '有人提了第一个 issue。', '知识因为分享，变得更重了——也更轻了。']
    },
    {
      id: 'promptMaster',
      title: '提示词魔法师',
      subtitle: '把问题问清楚',
      kind: 'good',
      emoji: '🪄',
      theme: 'prompt',
      description: '你学会了如何把模糊的需求拆成清晰的指令。你的提示词工坊门口排起了长队。',
      lines: ['“请给出步骤和依据。”', '一句话，让模型从敷衍变得认真。', '会提问，是一种被低估的能力。']
    },
    {
      id: 'truthHunter',
      title: '幻觉猎手',
      subtitle: '不轻信，也不全盘否定',
      kind: 'good',
      emoji: '🔍',
      theme: 'truth',
      description: '你专门捕捉那些一本正经的胡说八道。每拆穿一个幻觉，森林就亮一分。',
      lines: ['“请给出来源。”', '“这句话和另外两个来源矛盾。”', '你不再害怕 AI 出错，因为你会验证。']
    },
    {
      id: 'privacyGuard',
      title: '数据守门员',
      subtitle: '隐私不是小事',
      kind: 'good',
      emoji: '🛡️',
      theme: 'privacy',
      description: '你在森林入口立了一块牌子：先脱敏，再提问。隐私幽灵绕着牌子转了三圈，灰溜溜地走了。',
      lines: ['你把聊天记录里的名字涂黑了。', '你关掉了不必要的权限。', '真正可靠的 AI 使用方式，从保护自己开始。']
    },
    {
      id: 'bestPartner',
      title: '最佳搭档',
      subtitle: '人机协作，而不是人机替代',
      kind: 'good',
      emoji: '🤝',
      theme: 'partner',
      description: '你和 AI 分工明确：它负责搜索和草稿，你负责判断和决定。你们配合得像一对老搭档。',
      lines: ['你负责提问，AI 负责初稿。', '你负责判断，AI 负责执行。', '工具不会取代你，除非你放弃思考。']
    },
    {
      id: 'popularizer',
      title: '知识搬运工',
      subtitle: '把 AI 讲给更多人听',
      kind: 'good',
      emoji: '🎤',
      theme: 'teach',
      description: '你回到学校，开了一场 AI 科普讲座。你没有讲玄乎的术语，只讲了怎么提问、怎么验证、怎么保护隐私。',
      lines: ['“AI 不是神，也不是魔鬼。”', '“它只是一个很会预测下一个词的模型。”', '台下有人举起了手——你知道，种子种下了。']
    },
    {
      id: 'dependent',
      title: '被 AI 养废的鱼',
      subtitle: '把方向盘交了出去',
      kind: 'bad',
      emoji: '📺',
      theme: 'dependent',
      description: '你越来越依赖 AI 替你做决定。直到某一天，你发现自己已经想不起怎么独立思考了。',
      lines: ['“帮我決定吧。”', '“帮我写吧。”', '“帮我……活吧？”']
    },
    {
      id: 'powerOff',
      title: '算力耗尽',
      subtitle: '断电之后',
      kind: 'bad',
      emoji: '🔌',
      theme: 'off',
      description: '你一路莽撞，没能建立对 AI 的基本理解。认知森林的灯一盏盏熄灭，你停在了原地。',
      lines: ['屏幕暗了下去。', '没有网络，没有算力。', '有些问题，得靠自己先想明白。']
    },
    {
      id: 'cookerFriend',
      title: '和电饭煲做朋友',
      subtitle: '敌人的敌人是饭友',
      kind: 'special',
      emoji: '🍲🐟',
      theme: 'friend',
      description: '你没有把电饭煲当成敌人。你们一起煮了一锅饭，森林里第一次飘起了饭香。',
      lines: ['“要加个蛋吗？”', '“好。”', '有些对抗，可以变成一顿饭。']
    },
    {
      id: 'trueEnd',
      title: '真正理解 AI',
      subtitle: '知道它是什么，也知道它不是什么',
      kind: 'true',
      emoji: '🌌',
      theme: 'true',
      description: '你不再把 AI 当神，也不把它当洪水猛兽。你知道它能做什么、不能做什么，也知道自己该做什么。',
      lines: ['你理解了 token、幻觉、检索和对齐。', '你理解了 AI 的边界，也理解了自己的边界。', '于是你推开门，走进了更大的世界。']
    },
    {
      id: 'parrot',
      title: '标准答案复读机',
      subtitle: '背下来了，但没懂',
      kind: 'bad',
      emoji: '📚',
      theme: 'parrot',
      description: '你记住了所有正确选项，却从没想过为什么。离开森林后，你成了一台会背答案的复读机。',
      lines: ['“这题选 B。”', '“为什么？”', '“……标准答案选 B。”']
    }
  ];

  /* 每个结局的 CG 素材：still 是 16:9 剧照，thumb 是图鉴缩略图，video 是成片 */
  const MEDIA = {
    rice: {
      still: 'assets/endings/rice.webp',
      thumb: 'assets/endings/thumbs/rice.webp',
      video: 'assets/endings/rice-ending.mp4'
    },
    openSource: {
      still: 'assets/endings/openSource.webp',
      thumb: 'assets/endings/thumbs/openSource.webp',
      video: 'assets/endings/openSource.mp4'
    },
    promptMaster: {
      still: 'assets/endings/promptMaster.webp',
      thumb: 'assets/endings/thumbs/promptMaster.webp',
      video: 'assets/endings/promptMaster.mp4'
    },
    truthHunter: {
      still: 'assets/endings/truthHunter.webp',
      thumb: 'assets/endings/thumbs/truthHunter.webp',
      video: 'assets/endings/truthHunter.mp4'
    },
    privacyGuard: {
      still: 'assets/endings/privacyGuard.webp',
      thumb: 'assets/endings/thumbs/privacyGuard.webp'
    },
    bestPartner: {
      still: 'assets/endings/bestPartner.webp',
      thumb: 'assets/endings/thumbs/bestPartner.webp'
    },
    popularizer: {
      still: 'assets/endings/popularizer.webp',
      thumb: 'assets/endings/thumbs/popularizer.webp'
    },
    dependent: {
      still: 'assets/endings/dependent.webp',
      thumb: 'assets/endings/thumbs/dependent.webp'
    },
    powerOff: {
      still: 'assets/endings/powerOff.webp',
      thumb: 'assets/endings/thumbs/powerOff.webp'
    },
    cookerFriend: {
      still: 'assets/endings/cookerFriend.webp',
      thumb: 'assets/endings/thumbs/cookerFriend.webp'
    },
    trueEnd: {
      still: 'assets/endings/trueEnd.webp',
      thumb: 'assets/endings/thumbs/trueEnd.webp'
    },
    parrot: {
      still: 'assets/endings/parrot.webp',
      thumb: 'assets/endings/thumbs/parrot.webp'
    }
  };

  ENDINGS.forEach(function (ending) {
    ending.media = MEDIA[ending.id] || null;
  });

  function getEnding(id) {
    return ENDINGS.find(function (ending) {
      return ending.id === id;
    }) || null;
  }

  function mediaOf(id) {
    const ending = getEnding(id);
    return (ending && ending.media) || null;
  }

  function axesPercent(state) {
    return Questions.axesPercent(state);
  }

  function resolveEnding(state) {
    const a = axesPercent(state);
    const reliance = a.reliance;
    const knowledge = a.knowledge;
    const critical = a.critical;
    const practice = a.practice;
    const privacy = a.privacy;
    const prompt = a.prompt;
    const teaching = a.teaching;
    const choice = state.finalChoice || null;

    if (choice === 'home') return 'rice';
    if (choice === 'friend') return 'cookerFriend';

    if (choice === 'share') {
      return practice >= 35 ? 'openSource' : 'bestPartner';
    }
    if (choice === 'teach') return 'popularizer';
    if (choice === 'prompt') return 'promptMaster';
    if (choice === 'privacy') return 'privacyGuard';
    if (choice === 'ask') {
      if (knowledge >= 70 && critical >= 60) return 'trueEnd';
      if (critical >= 50) return 'truthHunter';
      return 'bestPartner';
    }
    if (choice === 'stay') {
      if (knowledge >= 70 && practice >= 55 && reliance <= 40) return 'trueEnd';
      if (knowledge < 25 && critical < 25) return 'powerOff';
      if (reliance >= 55 && critical < 40) return 'dependent';
      if (knowledge >= 50 && critical < 45) return 'parrot';
      return 'openSource';
    }
    if (choice === 'rely') return 'dependent';

    if (reliance >= 60 && critical < 40) return 'dependent';
    if (knowledge < 25 && critical < 25) return 'powerOff';
    if (reliance >= 55 && knowledge >= 50 && critical < 45) return 'parrot';
    if (prompt >= 45) return 'promptMaster';
    if (privacy >= 45) return 'privacyGuard';
    if (critical >= 55) return 'truthHunter';
    if (teaching >= 45) return 'popularizer';
    if (practice >= 50) return 'openSource';
    return 'rice';
  }

  function endingTitle(id) {
    const ending = getEnding(id);
    return ending ? ending.title : '未知结局';
  }

  return {
    ENDINGS: ENDINGS,
    MEDIA: MEDIA,
    getEnding: getEnding,
    mediaOf: mediaOf,
    resolveEnding: resolveEnding,
    endingTitle: endingTitle,
    axesPercent: axesPercent
  };
});
