/* 弹窗：规则、回合结算、商店、技能奖励、替换、胜负 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const Dom = BQ.Dom;
  const h = Dom.h;
  const CONFIG = BQ.Config.CONFIG;

  let currentClose = null;

  function openModal(content, opts) {
    const options = opts || {};
    const rootEl = Dom.$('#modal-root');
    Dom.clear(rootEl);
    rootEl.classList.remove('hidden');
    document.body.classList.add('modal-open');
    const modal = h('div', {
      class: 'modal' + (options.narrow ? ' narrow' : '') + (options.className ? ' ' + options.className : ''),
      role: 'dialog',
      'aria-modal': 'true'
    }, content);
    rootEl.appendChild(modal);
    currentClose = options.onClose || null;

    if (options.dismissible) {
      rootEl.onclick = function (event) {
        if (event.target === rootEl) closeModal();
      };
    } else {
      rootEl.onclick = null;
    }
    return modal;
  }

  function closeModal() {
    const rootEl = Dom.$('#modal-root');
    if (!rootEl) return;
    rootEl.classList.add('hidden');
    Dom.clear(rootEl);
    rootEl.onclick = null;
    document.body.classList.remove('modal-open');
    const cb = currentClose;
    currentClose = null;
    if (cb) cb();
  }

  function isOpen() {
    const rootEl = Dom.$('#modal-root');
    return rootEl && !rootEl.classList.contains('hidden');
  }

  function toast(text) {
    const rootEl = Dom.$('#toast-root');
    if (!rootEl) return;
    const el = h('div', { class: 'toast', text: text });
    rootEl.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2200);
  }

  function wallet(state) {
    return h('div', { class: 'wallet' }, [
      h('span', { class: 'token-icon', text: 'T' }),
      h('span', { text: state.player.tokens + ' Token' })
    ]);
  }

  function skillCard(def, level, kind, price, desc, extraClass, onPick, disabled) {
    const el = h('button', {
      class: 'choice-card' + (extraClass ? ' ' + extraClass : ''),
      type: 'button',
      disabled: !!disabled,
      onclick: function () {
        if (!disabled) onPick();
      }
    }, [
      h('div', { class: 'card-emoji', text: def.emoji }),
      h('h4', { text: def.name }),
      h('div', { class: 'card-kind rarity-' + (def.rarity || 'common') }, [
        kind === 'new' ? '新技能' : '升级 · Lv' + (level + 1) + ' / ' + def.maxLevel
      ]),
      h('div', { class: 'card-desc', text: desc }),
      price != null ? h('div', { class: 'card-price' }, [
        h('span', { class: 'token-icon', text: 'T' }),
        h('span', { text: String(price) })
      ]) : null
    ]);
    return el;
  }

  function priceLabel(price) {
    return h('div', { class: 'card-price' }, [
      h('span', { class: 'token-icon', text: 'T' }),
      h('span', { text: String(price) })
    ]);
  }

  /* ---------- 回合结算面板 ---------- */
  function rewardPanel(state, handlers) {
    const weapon = state.player.weapon;
    const wdef = CONFIG.weapons[weapon.id];
    const stats = state.player.stats;
    const maxed = weapon.level >= wdef.maxLevel;
    const cost = maxed ? 0 : CONFIG.combat.weaponCostBase + CONFIG.combat.weaponCostPerLevel * (weapon.level - 1);
    const canUpgrade = !maxed && state.player.tokens >= cost;

    const upgradeBlock = h('div', { class: 'weapon-upgrade' }, [
      h('div', { class: 'wu-emoji', text: wdef.emoji }),
      h('div', { class: 'wu-main' }, [
        h('div', { class: 'wu-name', text: wdef.name + ' · Lv ' + weapon.level + ' / ' + wdef.maxLevel }),
        h('div', { class: 'wu-desc', text: '攻击 ' + stats.atk + ' · 射程 ' + stats.range + (stats.splash > 0 ? ' · 溅射 ' + Math.round(stats.splash * 100) + '%' : '') }),
        maxed
          ? h('div', { class: 'wu-desc', text: '武器已经强化到极限。' })
          : h('div', { class: 'wu-next', text: '升级后：攻击 +' + wdef.atkPerLevel + (wdef.hpBonusEvery && (weapon.level + 1) % wdef.hpBonusEvery === 0 ? '，最大生命 +' + wdef.hpBonus : '') + '（需 ' + cost + ' Token）' })
      ]),
      h('button', {
        class: 'btn btn-primary',
        type: 'button',
        disabled: !canUpgrade,
        text: maxed ? '已满级' : '升级武器',
        onclick: function () {
          if (handlers.onUpgrade) handlers.onUpgrade();
        }
      })
    ]);

    const shop = state.shop;
    const shopItems = shop ? shop.items : [];
    const lineIndex = (state.stage + (shop ? shop.rerolls : 0)) % CONFIG.shopkeeper.lines.length;

    const shopGrid = h('div', { class: 'choice-grid' });
    shopItems.forEach(function (item, index) {
      const reason = BQ.Shop.itemBlockReason(state, index);
      let card;
      if (item.type === 'rice') {
        const full = state.player.rice >= CONFIG.shop.maxRice;
        card = h('button', {
          class: 'choice-card' + (item.sold || reason ? ' disabled' : ''),
          type: 'button',
          disabled: item.sold,
          onclick: function () {
            if (!item.sold) handlers.onBuy(index);
          }
        }, [
          h('div', { class: 'card-emoji', text: '🍚' }),
          h('h4', { text: '米饭' }),
          h('div', { class: 'card-kind' }, ['恢复道具']),
          h('div', { class: 'card-desc', text: '吃掉后回复 ' + Math.round(CONFIG.shop.riceHealPct * 100) + '% 最大生命。可存 ' + state.player.rice + ' / ' + CONFIG.shop.maxRice + ' 碗。' }),
          priceLabel(item.price),
          item.sold ? h('span', { class: 'sold-tag', text: '售罄' }) : null,
          reason && !item.sold ? h('div', { class: 'modal-note', text: reason }) : null
        ]);
        if (full) card.classList.add('disabled');
        if (item.sold) card.disabled = true;
      } else if (item.type === 'slot') {
        card = h('button', {
          class: 'choice-card',
          type: 'button',
          disabled: !!item.sold,
          onclick: function () {
            if (!item.sold) handlers.onBuy(index);
          }
        }, [
          h('div', { class: 'card-emoji', text: '🧩' }),
          h('h4', { text: '技能栏扩充' }),
          h('div', { class: 'card-kind' }, ['永久强化']),
          h('div', { class: 'card-desc', text: '技能栏 +1 格（当前 ' + state.player.slots + ' / ' + CONFIG.shop.maxSlots + '）。' }),
          priceLabel(item.price),
          item.sold ? h('span', { class: 'sold-tag', text: '售罄' }) : null,
          reason && !item.sold ? h('div', { class: 'modal-note', text: reason }) : null
        ]);
        if (reason) card.classList.add('disabled');
      } else {
        const def = CONFIG.skillMap[item.skillId];
        const owned = BQ.Skills.findSkill(state, item.skillId);
        const level = owned ? owned.level : 0;
        const desc = item.kind === 'upgrade'
          ? '当前：' + def.desc[level - 1] + '  →  ' + def.desc[level]
          : def.desc[0];
        card = h('button', {
          class: 'choice-card',
          type: 'button',
          disabled: !!item.sold,
          onclick: function () {
            if (!item.sold) handlers.onBuy(index);
          }
        }, [
          h('div', { class: 'card-emoji', text: def.emoji }),
          h('h4', { text: def.name }),
          h('div', { class: 'card-kind rarity-' + def.rarity }, [item.kind === 'new' ? '新技能' : '升级 · Lv' + (level + 1) + ' / ' + def.maxLevel]),
          h('div', { class: 'card-desc', text: desc }),
          priceLabel(item.price),
          item.sold ? h('span', { class: 'sold-tag', text: '售罄' }) : null,
          reason && !item.sold ? h('div', { class: 'modal-note', text: reason }) : null
        ]);
        if (reason) card.classList.add('disabled');
      }
      shopGrid.appendChild(card);
    });

    const rerollCost = BQ.Shop.rerollCost(state);
    const canReroll = state.player.tokens >= rerollCost;

    const content = [
      h('div', { class: 'modal-head' }, [
        h('div', {}, [
          h('h2', { class: 'modal-title', text: '回合结算 · 第 ' + state.stage + ' 关' }),
          h('p', { class: 'modal-sub', text: '休整一下。升级武器、和蟹老板换点好东西，再继续深入遗迹。' })
        ]),
        wallet(state)
      ]),
      h('div', { class: 'modal-section' }, [
        h('div', { class: 'section-title' }, [
          h('h3', { text: '武器强化' }),
          h('span', { class: 'hint', text: '每回合结算时可升级一次' })
        ]),
        upgradeBlock
      ]),
      h('div', { class: 'modal-section' }, [
        h('div', { class: 'shop-top' }, [
          h('div', { class: 'section-title', style: 'margin:0' }, [
            h('h3', { text: '蟹老板的商店' }),
            h('span', { class: 'hint', text: '每回合随机进货' })
          ]),
          h('button', {
            class: 'btn btn-small',
            type: 'button',
            disabled: !canReroll,
            text: '刷新 ' + rerollCost + ' Token',
            onclick: function () {
              if (canReroll) handlers.onReroll();
            }
          })
        ]),
        h('div', { class: 'shopkeeper' }, [
          h('span', { class: 'crab', text: CONFIG.shopkeeper.emoji }),
          h('span', {}, [
            h('b', { text: CONFIG.shopkeeper.name + '：' }),
            h('span', { text: CONFIG.shopkeeper.lines[lineIndex] })
          ])
        ]),
        shopGrid
      ]),
      h('div', { class: 'modal-actions' }, [
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: '下一回合 →',
          onclick: function () {
            if (handlers.onNext) handlers.onNext();
          }
        })
      ]),
      h('p', { class: 'modal-note', text: '米饭可在战斗中随时食用；技能栏满时购买新技能，会先选择要替换的旧技能。' })
    ];

    openModal(content, { wide: true });
  }

  /* ---------- 技能奖励 ---------- */
  function skillChoice(state, title, subtitle, choices, handlers) {
    const cards = h('div', { class: 'choice-grid' });
    choices.forEach(function (choice, index) {
      if (choice.type === 'token') {
        cards.appendChild(
          h('button', {
            class: 'choice-card',
            type: 'button',
            onclick: function () {
              handlers.onPick(choice);
            }
          }, [
            h('div', { class: 'card-emoji', text: '🪙' }),
            h('h4', { text: 'Token 奖励' }),
            h('div', { class: 'card-kind', text: '技能池已枯竭' }),
            h('div', { class: 'card-desc', text: '获得 ' + choice.amount + ' Token。' })
          ])
        );
        return;
      }
      const def = CONFIG.skillMap[choice.skillId];
      const owned = BQ.Skills.findSkill(state, choice.skillId);
      const level = owned ? owned.level : 0;
      const desc = choice.kind === 'upgrade'
        ? '当前：' + def.desc[level - 1] + '\n升级：' + def.desc[level]
        : def.desc[0];
      const card = h('button', {
        class: 'choice-card',
        type: 'button',
        onclick: function () {
          handlers.onPick(choice);
        }
      }, [
        h('div', { class: 'card-emoji', text: def.emoji }),
        h('h4', { text: def.name }),
        h('div', { class: 'card-kind rarity-' + def.rarity }, [
          choice.kind === 'upgrade' ? '升级 · Lv' + (level + 1) + ' / ' + def.maxLevel : '新技能'
        ]),
        h('div', { class: 'card-desc', text: desc })
      ]);
      cards.appendChild(card);
    });

    const content = [
      h('div', { class: 'modal-head' }, [
        h('div', {}, [
          h('h2', { class: 'modal-title', text: title }),
          h('p', { class: 'modal-sub', text: subtitle || '' })
        ]),
        h('div', { class: 'wallet' }, [
          h('span', { class: 'token-icon', text: 'T' }),
          h('span', { text: state.player.tokens + ' Token · 技能栏 ' + state.player.skills.length + '/' + state.player.slots })
        ])
      ]),
      cards,
      handlers.onCancel
        ? h('div', { class: 'modal-actions' }, [
          h('button', {
            class: 'btn',
            type: 'button',
            text: '跳过（+' + CONFIG.campaign.skillFallbackTokens + ' Token）',
            onclick: function () {
              handlers.onCancel();
            }
          })
        ])
        : null
    ];
    openModal(content, {});
  }

  /* ---------- Boss 奖励 ---------- */
  function bossReward(state, reward, handlers) {
    const cards = h('div', { class: 'choice-grid' });
    reward.choices.forEach(function (choice) {
      if (choice.type === 'token') {
        cards.appendChild(
          h('button', {
            class: 'choice-card',
            type: 'button',
            onclick: function () { handlers.onPick(choice); }
          }, [
            h('div', { class: 'card-emoji', text: '🪙' }),
            h('h4', { text: 'Token 宝箱' }),
            h('div', { class: 'card-kind', text: 'Boss 奖励' }),
            h('div', { class: 'card-desc', text: '获得 ' + choice.amount + ' Token。' })
          ])
        );
        return;
      }
      const def = CONFIG.skillMap[choice.skillId];
      const owned = BQ.Skills.findSkill(state, choice.skillId);
      const level = owned ? owned.level : 0;
      const desc = choice.kind === 'upgrade'
        ? '当前：' + def.desc[level - 1] + '  →  ' + def.desc[level]
        : def.desc[0];
      cards.appendChild(
        h('button', {
          class: 'choice-card',
          type: 'button',
          onclick: function () { handlers.onPick(choice); }
        }, [
          h('div', { class: 'card-emoji', text: def.emoji }),
          h('h4', { text: def.name }),
          h('div', { class: 'card-kind rarity-' + def.rarity }, [
            choice.kind === 'upgrade' ? 'Boss 技能升级 · Lv' + (level + 1) : 'Boss 强力技能'
          ]),
          h('div', { class: 'card-desc', text: desc })
        ])
      );
    });

    const content = [
      h('div', { class: 'modal-head' }, [
        h('div', {}, [
          h('h2', { class: 'modal-title', text: 'Boss 被击败了！' }),
          h('p', { class: 'modal-sub', text: reward.bossName + ' 倒下了，掉落了 ' + reward.tokens + ' Token，并回复了部分生命。' })
        ])
      ]),
      cards,
      h('p', { class: 'modal-note', text: '选择一项强力技能带走。技能栏会更挤——值得。' })
    ];
    openModal(content, {});
  }

  /* ---------- 技能替换 ---------- */
  function swapPicker(state, newSkillId, opts) {
    const options = opts || {};
    const newDef = CONFIG.skillMap[newSkillId];
    const rows = h('div', { class: 'swap-list' });
    state.player.skills.forEach(function (owned) {
      const def = CONFIG.skillMap[owned.id];
      rows.appendChild(
        h('button', {
          class: 'swap-row',
          type: 'button',
          onclick: function () {
            options.onPick(owned.id);
          }
        }, [
          h('span', { class: 'swap-emoji', text: def.emoji }),
          h('span', { style: 'min-width:0' }, [
            h('div', { class: 'swap-name', text: def.name }),
            h('div', { class: 'swap-desc', text: def.desc[owned.level - 1] })
          ]),
          h('span', { class: 'swap-lv', text: 'Lv' + owned.level })
        ])
      );
    });

    const content = [
      h('div', { class: 'modal-head' }, [
        h('div', {}, [
          h('h2', { class: 'modal-title', text: '技能栏已满' }),
          h('p', { class: 'modal-sub', text: '学习「' + newDef.name + '」需要腾出一格。选择一个要遗忘的技能（等级会丢失）。' })
        ])
      ]),
      h('div', { class: 'choice-grid', style: 'grid-template-columns:1fr;margin-bottom:14px' }, [
        h('div', { class: 'choice-card disabled', style: 'cursor:default' }, [
          h('div', { class: 'card-emoji', text: newDef.emoji }),
          h('h4', { text: newDef.name }),
          h('div', { class: 'card-kind rarity-' + newDef.rarity, text: '即将学习 · Lv1' }),
          h('div', { class: 'card-desc', text: newDef.desc[0] })
        ])
      ]),
      rows,
      options.onCancel
        ? h('div', { class: 'modal-actions' }, [
          h('button', {
            class: 'btn',
            type: 'button',
            text: '再想想',
            onclick: function () { options.onCancel(); }
          })
        ])
        : null
    ];
    openModal(content, { narrow: true });
  }

  /* ---------- 规则 ---------- */
  function rules() {
    const blocks = [
      ['目标', '大肥鱼被困在 AI 认知森林。打穿 40 关，处理 AI 误解病例、击败终焉电饭煲、拾取传送符文，走向属于你的结局。共 12 种结局。'],
      ['移动与体力', '每次只能移动一格，移动消耗 1 点体力；普通攻击也消耗 1 点体力；主动技能不消耗体力。体力不足时可以点「休息」恢复 3 点体力——但怪物会趁机逼近。每回合开始时体力回满。'],
      ['怪物与回合', '每回合开始时刷新一批怪物，随关卡推进每波最多 6 只。怪物的生命与攻击也会随关卡提高。你每次行动后，怪物都会沿最短路径逼近并攻击。击败当前回合全部怪物后自动进入结算。'],
      ['AI 误解诊疗', '从第 4 关开始，每 4 关收到一个 AI 使用病例。先诊断问题，再选择检查方式，最后开出处方。配置 DeepSeek API 后会点评处方，否则使用本地评分。病例结论会写进「认知档案」。'],
      ['职业技能', '战士铁甲鱼：高生命、近战高伤；魔法师灵光鱼：生命略低、基础伤害更高，远程且法杖可溅射。回合结算时可花 Token 升级职业武器，最高 Lv20。'],
      ['技能栏', '初始 4 格，最多 8 格。每 5 关三选一获得新技能或升级；技能栏满时需遗忘一个旧技能。商店可购买「技能栏扩充」。'],
      ['Token 与商店', '击杀怪物掉落蓝色 Token；Boss 掉落大额 Token。每回合结束后商店随机刷新，可兑换技能、米饭（回血）与技能栏扩充。'],
      ['Boss 与对话', '第 10 / 20 / 30 关是误解 Boss，击败后可对话并选择强力技能；第 40 关是终焉电饭煲，半血与 20% 血会进入新阶段。Boss 的范围技/冲撞附带控制：被命中后下一个行动无效，点击「挣扎」跳过该回合。'],
      ['结局', 'Boss 对话、病例诊疗与终局对话会共同决定结局。认知档案包含 AI 理解、批判性思维、动手实践、隐私安全、提示词、科普传播和 AI 依赖七个维度。'],
      ['API 设置', '标题页或游戏内 ⚙ 可以配置 DeepSeek API。推荐运行 node tools/server.mjs 并使用「本地代理」；没有 Key 时选择「离线」，内置判分会保证游戏可通关。'],
      ['操作', '点击相邻格子移动、点击射程内怪物攻击；方向键/WASD 也能移动。Space 休息（被控制时改为「挣扎」），1–8 选择技能，Esc 取消，Enter 确认。']
    ];
    const grid = h('div', { class: 'rules-grid' });
    blocks.forEach(function (block) {
      grid.appendChild(
        h('article', { class: 'rule-card' }, [
          h('h2', { text: block[0] }),
          h('p', { text: block[1] })
        ])
      );
    });
    const content = [
      h('div', { class: 'rules-inside' }, [
        h('header', { class: 'rules-head' }, [
          h('div', {}, [
            h('h2', { class: 'rules-title', text: '玩法说明' }),
            h('p', { class: 'rules-sub', text: '大肥鱼的一小步，是肥鱼家族的一大步。' })
          ]),
          h('button', {
            class: 'rules-close',
            type: 'button',
            text: '×',
            'aria-label': '关闭玩法说明',
            onclick: function () { closeModal(); }
          })
        ]),
        grid,
        h('footer', { class: 'rules-footer' }, [
          h('button', {
            class: 'rules-done',
            type: 'button',
            text: '知道了',
            onclick: function () { closeModal(); }
          })
        ])
      ])
    ];
    openModal(content, { dismissible: true, className: 'rules-modal' });
  }

  /* ---------- 重新开始确认 ---------- */
  function confirmRestart(onConfirm) {
    const content = [
      h('div', { class: 'modal-head' }, [
        h('div', {}, [
          h('h2', { class: 'modal-title', text: '重新开始？' }),
          h('p', { class: 'modal-sub', text: '当前进度会丢失，确定要回到标题吗？' })
        ])
      ]),
      h('div', { class: 'modal-actions' }, [
        h('button', {
          class: 'btn',
          type: 'button',
          text: '继续冒险',
          onclick: function () { closeModal(); }
        }),
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: '重新开始',
          onclick: function () {
            closeModal();
            onConfirm();
          }
        })
      ])
    ];
    openModal(content, { narrow: true, dismissible: true });
  }

  /* ---------- 统计与胜负 ---------- */
  function statGrid(state) {
    const elapsed = Date.now() - state.stats.startedAt;
    const weapon = state.player.weapon;
    const wdef = CONFIG.weapons[weapon.id];
    const items = [
      ['到达关卡', state.stats.stageReached || state.stage],
      ['击杀', state.stats.kills],
      ['累计 Token', state.stats.tokensEarned],
      ['武器', wdef.name + ' Lv' + weapon.level],
      ['技能', state.player.skills.length + ' 个'],
      ['吃掉米饭', state.stats.riceEaten + ' 碗'],
      ['用时', Dom.formatDuration(elapsed)]
    ];
    const grid = h('div', { class: 'result-stats' });
    items.forEach(function (item) {
      grid.appendChild(
        h('div', { class: 'result-stat' }, [
          h('span', { text: item[0] }),
          h('b', { text: String(item[1]) })
        ])
      );
    });
    return grid;
  }

  function defeat(state, handlers) {
    const content = [
      h('div', { class: 'modal-head' }, [
        h('div', {}, [
          h('h2', { class: 'modal-title', text: '大肥鱼倒下了……' }),
          h('p', { class: 'modal-sub', text: '认知森林的误解太多了。再试一次，这次记得先想清楚。' })
        ]),
        h('div', { class: 'victory-emoji', text: '🐳💫' })
      ]),
      statGrid(state),
      h('div', { class: 'modal-actions' }, [
        h('button', {
          class: 'btn',
          type: 'button',
          text: '返回标题',
          onclick: function () { if (handlers.onTitle) handlers.onTitle(); }
        }),
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: '再来一次',
          onclick: function () { if (handlers.onRestart) handlers.onRestart(); }
        })
      ])
    ];
    openModal(content, {});
  }

  function victory(state, handlers) {
    const content = [
      h('div', { class: 'modal-head' }, [
        h('div', {}, [
          h('h2', { class: 'modal-title', text: '通关！大肥鱼回家了' }),
          h('p', { class: 'modal-sub', text: '一道白光闪过，古代森林遗迹留在了身后。桌上那碗米饭还冒着热气。' })
        ]),
        h('div', { class: 'victory-emoji', text: '🐟🍚' })
      ]),
      statGrid(state),
      handlers.bestText
        ? h('p', { class: 'modal-note', text: handlers.bestText })
        : null,
      h('div', { class: 'modal-actions' }, [
        h('button', {
          class: 'btn',
          type: 'button',
          text: '返回标题',
          onclick: function () { if (handlers.onTitle) handlers.onTitle(); }
        }),
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: '再来一次',
          onclick: function () { if (handlers.onRestart) handlers.onRestart(); }
        })
      ])
    ];
    openModal(content, {});
  }

  /* ---------- AI 误解诊疗 ---------- */
  function caseFile(state, level, caseData, handlers) {
    let step = 1;
    let diagnosisId = null;
    let checkIds = [];
    let prescriptionId = null;
    const maxChecks = caseData.maxChecks || 2;

    const stepEls = ['诊断', '检查', '处方'].map(function (label, index) {
      return h('div', { class: 'case-step' + (index === 0 ? ' active' : '') }, [
        h('b', { text: String(index + 1) }),
        h('span', { text: label })
      ]);
    });
    const steps = h('div', { class: 'case-steps' }, stepEls);

    const header = h('div', { class: 'modal-head case-head' }, [
      h('div', {}, [
        h('div', {
          class: 'question-kicker',
          text: '第 ' + level + ' 关 · AI 误解诊疗 · 病例 ' + String(caseData.id).replace(/^c/, '')
        }),
        h('h2', { class: 'modal-title case-title', text: caseData.title }),
        h('p', { class: 'modal-sub', text: '先诊断，再检查，最后开出处方。' })
      ]),
      h('div', { class: 'question-badge', text: caseData.topic || 'AI 病例' })
    ]);

    const scenario = h('div', { class: 'case-scenario' }, [
      h('div', { class: 'case-scenario-head' }, [
        h('span', { class: 'case-tag', text: '病例档案' })
      ]),
      h('p', { class: 'case-scenario-text', text: caseData.scenario })
    ]);

    const diagnosisButtons = {};
    const diagnosisWrap = h('div', { class: 'case-options' });
    caseData.diagnoses.forEach(function (option, index) {
      const btn = h('button', { class: 'case-option', type: 'button' }, [
        h('span', { class: 'case-letter', text: String.fromCharCode(65 + index) }),
        h('span', { class: 'case-option-text', text: option.text })
      ]);
      btn.addEventListener('click', function () {
        diagnosisId = option.id;
        update();
      });
      diagnosisButtons[option.id] = btn;
      diagnosisWrap.appendChild(btn);
    });

    const checkButtons = {};
    const checkHint = h('span', { class: 'hint', text: '最多选 ' + maxChecks + ' 项' });
    const checkWrap = h('div', { class: 'case-options case-checks' });
    caseData.checks.forEach(function (option) {
      const btn = h('button', { class: 'case-option case-check', type: 'button' }, [
        h('span', { class: 'case-check-box', text: '✓' }),
        h('span', { class: 'case-option-text', text: option.text })
      ]);
      btn.addEventListener('click', function () {
        const at = checkIds.indexOf(option.id);
        if (at >= 0) {
          checkIds.splice(at, 1);
        } else if (checkIds.length < maxChecks) {
          checkIds.push(option.id);
        }
        update();
      });
      checkButtons[option.id] = btn;
      checkWrap.appendChild(btn);
    });

    const prescriptionButtons = {};
    const prescriptionWrap = h('div', { class: 'case-options' });
    caseData.prescriptions.forEach(function (option, index) {
      const btn = h('button', { class: 'case-option', type: 'button' }, [
        h('span', { class: 'case-letter', text: String.fromCharCode(65 + index) }),
        h('span', { class: 'case-option-text', text: option.text })
      ]);
      btn.addEventListener('click', function () {
        prescriptionId = option.id;
        update();
      });
      prescriptionButtons[option.id] = btn;
      prescriptionWrap.appendChild(btn);
    });
    const textarea = h('textarea', {
      class: 'question-input case-input',
      rows: '3',
      placeholder: '补充你的处方：先做什么、怎么验证、如何兜底……（可选）',
      maxlength: '500'
    });

    const panelDiagnosis = h('div', { class: 'case-panel' }, [
      h('div', { class: 'case-section-head' }, [
        h('h3', { text: '第 1 步 · 诊断' }),
        h('span', { class: 'hint', text: '这个病例的核心问题是什么？' })
      ]),
      diagnosisWrap
    ]);
    const panelChecks = h('div', { class: 'case-panel hidden' }, [
      h('div', { class: 'case-section-head' }, [
        h('h3', { text: '第 2 步 · 检查' }),
        checkHint
      ]),
      checkWrap
    ]);
    const panelPrescription = h('div', { class: 'case-panel hidden' }, [
      h('div', { class: 'case-section-head' }, [
        h('h3', { text: '第 3 步 · 处方' }),
        h('span', { class: 'hint', text: '怎么解决，才能避免再次发生？' })
      ]),
      prescriptionWrap,
      h('div', { class: 'case-section-head case-subhead' }, [
        h('h3', { text: '用自己的话补充（可选）' }),
        h('span', { class: 'hint', text: '具体到执行步骤会加分' })
      ]),
      textarea
    ]);

    const back = h('button', { class: 'btn', type: 'button', text: '上一步' });
    const next = h('button', { class: 'btn btn-primary', type: 'button', text: '下一步：检查' });
    const footer = h('div', { class: 'case-footer' }, [
      h('span', { class: 'case-footer-hint', text: '诊断 35 分 · 检查 30 分 · 处方 35 分' }),
      h('div', { class: 'case-footer-actions' }, [back, next])
    ]);

    back.addEventListener('click', function () {
      if (step > 1) {
        step -= 1;
        update(true);
      }
    });
    next.addEventListener('click', function () {
      if (next.disabled) return;
      if (step < 3) {
        step += 1;
        update(true);
        return;
      }
      next.disabled = true;
      back.disabled = true;
      const answer = {
        diagnosisId: diagnosisId,
        checkIds: checkIds.slice(),
        prescriptionId: prescriptionId,
        text: textarea.value.trim()
      };
      if (handlers.onSubmit) handlers.onSubmit(answer);
    });

    function update(resetScroll) {
      stepEls.forEach(function (el, index) {
        el.classList.toggle('active', index + 1 === step);
        el.classList.toggle('done', index + 1 < step);
      });
      panelDiagnosis.classList.toggle('hidden', step !== 1);
      panelChecks.classList.toggle('hidden', step !== 2);
      panelPrescription.classList.toggle('hidden', step !== 3);
      back.classList.toggle('hidden', step === 1);
      Object.keys(diagnosisButtons).forEach(function (id) {
        diagnosisButtons[id].classList.toggle('selected', id === diagnosisId);
      });
      Object.keys(checkButtons).forEach(function (id) {
        const selected = checkIds.indexOf(id) >= 0;
        checkButtons[id].classList.toggle('selected', selected);
        checkButtons[id].disabled = !selected && checkIds.length >= maxChecks;
      });
      Object.keys(prescriptionButtons).forEach(function (id) {
        prescriptionButtons[id].classList.toggle('selected', id === prescriptionId);
      });
      checkHint.textContent = '已选 ' + checkIds.length + ' / ' + maxChecks + ' 项';
      if (step === 1) {
        next.textContent = '下一步：检查';
        next.disabled = !diagnosisId;
      } else if (step === 2) {
        next.textContent = '下一步：处方';
        next.disabled = checkIds.length === 0;
      } else {
        next.textContent = '提交处方';
        next.disabled = !prescriptionId;
      }
      if (resetScroll) modal.scrollTop = 0;
    }

    const content = [
      header,
      scenario,
      steps,
      panelDiagnosis,
      panelChecks,
      panelPrescription,
      footer,
      h('p', { class: 'modal-note', text: '病例结论会写进认知档案；处方由 DeepSeek 点评，离线时使用本地评分。' })
    ];
    const modal = openModal(content, { className: 'case-modal' });
    update(true);
  }

  function judging() {
    const content = [
      h('div', { class: 'judging-card' }, [
        h('div', { class: 'judging-emoji', text: '🐬' }),
        h('h2', { class: 'modal-title', text: 'DeepSeek 正在阅读处方…' }),
        h('p', { class: 'modal-sub', text: '它在看你的诊断、检查和处方是否真的能解决问题。' }),
        h('div', { class: 'judging-dots' }, [
          h('span', {}), h('span', {}), h('span', {})
        ])
      ])
    ];
    openModal(content, { narrow: true });
  }

  function caseFeedback(state, caseData, record, handlers) {
    const parts = record.parts || { diagnosis: 0, checks: 0, prescription: 0 };
    const sourceLabel = record.source === 'deepseek' ? 'DeepSeek 点评' : '本地评分';
    const gain = Object.keys(record.axes || {}).filter(function (key) {
      return record.axes[key] > 0;
    });

    function verdictRow(label, value, note) {
      const safe = Math.max(0, Math.min(100, Number(value) || 0));
      return h('div', { class: 'case-verdict-row' }, [
        h('span', { class: 'case-verdict-label', text: label }),
        h('div', { class: 'case-verdict-track' }, [
          h('i', { style: 'width:' + safe + '%' })
        ]),
        h('b', { class: 'case-verdict-score', text: safe + ' / 100' }),
        h('span', { class: 'case-verdict-note', text: note })
      ]);
    }

    const content = [
      h('div', { class: 'modal-head' }, [
        h('div', {}, [
          h('h2', { class: 'modal-title', text: '诊疗结果 · ' + record.score + ' 分' }),
          h('p', {
            class: 'modal-sub',
            text: sourceLabel + ' · 病例 ' + String(record.caseId || '').replace(/^c/, '') + ' · 第 ' + record.level + ' 关'
          })
        ]),
        h('div', {
          class: 'score-ring' + (record.score >= 70 ? ' good' : record.score >= 40 ? ' mid' : ' bad'),
          text: String(record.score)
        })
      ]),
      h('div', { class: 'case-verdict' }, [
        verdictRow('诊断', parts.diagnosis, record.diagnosisCorrect ? '判断正确' : '判断有偏差'),
        verdictRow('检查', parts.checks, record.checkIds.length + ' 项检查'),
        verdictRow('处方', parts.prescription, record.source === 'deepseek' ? 'AI 点评' : '本地评分')
      ]),
      h('div', { class: 'feedback-box' }, [
        h('div', { class: 'feedback-label', text: '诊疗意见' }),
        h('p', { text: record.feedback || '继续思考，处方没有唯一形式。' })
      ]),
      gain.length
        ? h('div', { class: 'axis-gain' }, gain.map(function (key) {
          return h('span', { class: 'axis-chip' }, [
            h('b', { text: CONFIG.axes[key] || key }),
            h('span', { text: '+' + record.axes[key] })
          ]);
        }))
        : null,
      h('div', { class: 'feedback-explain' }, [
        h('div', { class: 'feedback-label', text: '病例要点' }),
        h('p', { text: caseData.explain })
      ]),
      h('div', { class: 'modal-actions' }, [
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: '继续冒险',
          onclick: function () {
            if (handlers.onContinue) handlers.onContinue();
          }
        })
      ])
    ];
    openModal(content, { narrow: true });
  }

  /* ---------- 角色对话 ---------- */
  function characterAvatar(character, className) {
    if (character.img) {
      return h('div', { class: className + ' has-img' }, [
        h('img', { class: 'character-img', src: character.img, alt: character.name || '' })
      ]);
    }
    return h('div', { class: className, text: character.emoji });
  }

  function bossDialogue(dialogue, handlers) {
    const character = dialogue.character || { name: '???', emoji: '❓' };
    const choices = h('div', { class: 'dialogue-choices' });
    dialogue.choices.forEach(function (choice) {
      choices.appendChild(
        h('button', {
          class: 'dialogue-choice',
          type: 'button',
          onclick: function () {
            if (handlers.onPick) handlers.onPick(choice.id);
          }
        }, [
          h('span', { class: 'dialogue-choice-text', text: choice.text }),
          h('span', { class: 'dialogue-choice-arrow', text: '→' })
        ])
      );
    });
    const content = [
      h('div', { class: 'dialogue-card' }, [
        characterAvatar(character, 'dialogue-avatar'),
        h('div', { class: 'dialogue-body' }, [
          h('div', { class: 'dialogue-name', text: character.name }),
          h('p', { class: 'dialogue-line', text: dialogue.line })
        ])
      ]),
      choices,
      h('p', { class: 'modal-note', text: '你的回答会影响认知档案，并最终影响结局。' })
    ];
    openModal(content, { narrow: true });
  }

  function dialogueReply(character, reply, handlers) {
    const content = [
      h('div', { class: 'dialogue-card' }, [
        characterAvatar(character, 'dialogue-avatar'),
        h('div', { class: 'dialogue-body' }, [
          h('div', { class: 'dialogue-name', text: character.name }),
          h('p', { class: 'dialogue-line', text: reply })
        ])
      ]),
      h('div', { class: 'modal-actions' }, [
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: '继续',
          onclick: function () {
            if (handlers.onContinue) handlers.onContinue();
          }
        })
      ])
    ];
    openModal(content, { narrow: true });
  }

  function finalDialogue(dialogue, handlers) {
    const character = dialogue.character || { name: 'DeepSeek', emoji: '🐬' };
    const choices = h('div', { class: 'final-choices' });
    dialogue.choices.forEach(function (choice) {
      choices.appendChild(
        h('button', {
          class: 'final-choice',
          type: 'button',
          onclick: function () {
            if (handlers.onPick) handlers.onPick(choice.id);
          }
        }, [
          h('span', { class: 'final-choice-text', text: choice.text })
        ])
      );
    });
    const content = [
      h('div', { class: 'final-dialogue' }, [
        characterAvatar(character, 'final-avatar'),
        h('div', { class: 'final-body' }, [
          h('div', { class: 'dialogue-name', text: character.name + (character.title ? ' · ' + character.title : '') }),
          h('p', { class: 'final-line', text: dialogue.line })
        ])
      ]),
      h('div', { class: 'modal-note', text: '选择一条归途。认知档案会与你的选择一起决定最终结局。' }),
      choices
    ];
    openModal(content, {});
  }

  /* ---------- API 设置 ---------- */
  function apiSettings(current, handlers) {
    const settings = current || {};
    const mode = h('select', { class: 'input' }, [
      h('option', { value: 'offline', text: '离线 · 本地规则评分（无需网络）' }),
      h('option', { value: 'proxy', text: '本地代理 · 推荐（服务器保存 Key）' }),
      h('option', { value: 'direct', text: '浏览器直连 · 仅本地调试' })
    ]);
    mode.value = settings.mode || 'offline';
    const baseUrl = h('input', { class: 'input', type: 'text', value: settings.baseUrl || 'https://api.deepseek.com', placeholder: 'https://api.deepseek.com' });
    const model = h('input', { class: 'input', type: 'text', value: settings.model || 'deepseek-chat', placeholder: 'deepseek-chat' });
    const proxyUrl = h('input', { class: 'input', type: 'text', value: settings.proxyUrl || '/api/chat', placeholder: '/api/chat' });
    const key = h('input', { class: 'input', type: 'password', value: settings.key || '', placeholder: 'sk-...（仅直连模式需要）' });
    const result = h('p', { class: 'api-result', text: '' });

    function collect() {
      return {
        mode: mode.value,
        baseUrl: baseUrl.value.trim(),
        model: model.value.trim() || 'deepseek-chat',
        proxyUrl: proxyUrl.value.trim() || '/api/chat',
        key: key.value.trim()
      };
    }

    async function runTest() {
      result.textContent = '测试中…';
      result.className = 'api-result';
      if (!handlers.onTest) return;
      const res = await handlers.onTest(collect());
      if (res && res.ok) {
        result.textContent = '连接成功：' + (res.text || 'OK');
        result.className = 'api-result ok';
      } else {
        result.textContent = '连接失败：' + (res && res.error ? res.error : '未知错误');
        result.className = 'api-result fail';
      }
    }

    const content = [
      h('div', { class: 'modal-head' }, [
        h('div', {}, [
          h('h2', { class: 'modal-title', text: 'DeepSeek API 设置' }),
          h('p', { class: 'modal-sub', text: '用于 AI 诊疗点评与对话。没有 Key 也能玩，系统会自动使用本地评分。' })
        ]),
        h('button', {
          class: 'modal-close',
          type: 'button',
          text: '×',
          onclick: function () {
            closeModal();
            if (handlers.onClose) handlers.onClose();
          }
        })
      ]),
      h('div', { class: 'api-form' }, [
        h('label', {}, [h('span', { text: '接入方式' }), mode]),
        h('label', {}, [h('span', { text: 'Base URL' }), baseUrl]),
        h('label', {}, [h('span', { text: '模型' }), model]),
        h('label', {}, [h('span', { text: '代理地址' }), proxyUrl]),
        h('label', {}, [h('span', { text: 'API Key（直连时使用）' }), key]),
        result
      ]),
      h('div', { class: 'api-help' }, [
        h('p', { text: '推荐方式：在项目目录运行 `node tools/server.mjs`，并设置环境变量 DEEPSEEK_API_KEY，然后选择「本地代理」。' }),
        h('p', { text: '直连模式会把 Key 保存在浏览器 localStorage 中，仅建议在本机调试时使用。' }),
        h('p', { text: '离线模式：使用内置 AI 知识评分规则，保证没有网络也能完整通关并触发结局。' })
      ]),
      h('div', { class: 'modal-actions' }, [
        h('button', { class: 'btn', type: 'button', text: '测试连接', onclick: runTest }),
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: '保存设置',
          onclick: function () {
            if (handlers.onSave) handlers.onSave(collect());
            closeModal();
          }
        })
      ])
    ];
    openModal(content, { narrow: true, dismissible: true });
  }

  BQ.Modals = {
    openModal: openModal,
    closeModal: closeModal,
    isOpen: isOpen,
    toast: toast,
    caseFile: caseFile,
    caseFeedback: caseFeedback,
    judging: judging,
    bossDialogue: bossDialogue,
    dialogueReply: dialogueReply,
    finalDialogue: finalDialogue,
    apiSettings: apiSettings,
    rewardPanel: rewardPanel,
    skillChoice: skillChoice,
    bossReward: bossReward,
    swapPicker: swapPicker,
    rules: rules,
    confirmRestart: confirmRestart,
    confirmDevUnlock: confirmDevUnlock,
    defeat: defeat,
    victory: victory
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

