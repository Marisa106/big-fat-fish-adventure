/* WebAudio 合成音效（无音频文件） */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const STORAGE_KEY = 'bq.muted';

  let ctx = null;
  let muted = false;
  try {
    muted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (err) {
    muted = false;
  }

  function ensureContext() {
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(function () {});
      }
      return ctx;
    }
    const Ctor = root.AudioContext || root.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  function tone(opts) {
    const audio = ensureContext();
    if (!audio) return;
    const now = audio.currentTime + (opts.delay || 0);
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, now);
    if (opts.to) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), now + opts.duration);
    }
    const peak = Math.max(0.0001, opts.gain == null ? 0.05 : opts.gain);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + opts.duration + 0.03);
  }

  function noise(duration, gainValue, delay) {
    const audio = ensureContext();
    if (!audio) return;
    const length = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    gain.gain.value = gainValue == null ? 0.05 : gainValue;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(audio.destination);
    source.start(audio.currentTime + (delay || 0));
  }

  /* 每只怪物在 config 里都带一个 voice（基频 + 波形），四种动作共用同一音色 */
  function voiceOf(opts) {
    const voice = (opts && opts.voice) || {};
    const base = Number(voice.base);
    return {
      base: isFinite(base) ? Math.max(50, Math.min(1600, base)) : 320,
      type: voice.type || 'square'
    };
  }

  const sounds = {
    click: function () {
      tone({ freq: 520, to: 660, duration: 0.08, type: 'triangle', gain: 0.035 });
    },
    move: function () {
      tone({ freq: 300, to: 380, duration: 0.09, type: 'sine', gain: 0.03 });
    },
    attack: function () {
      tone({ freq: 240, to: 90, duration: 0.14, type: 'sawtooth', gain: 0.045 });
      noise(0.1, 0.05);
    },
    hit: function () {
      tone({ freq: 150, to: 60, duration: 0.16, type: 'square', gain: 0.05 });
      noise(0.14, 0.06);
    },
    coin: function () {
      tone({ freq: 880, duration: 0.09, type: 'triangle', gain: 0.04 });
      tone({ freq: 1320, duration: 0.12, type: 'triangle', gain: 0.035, delay: 0.07 });
    },
    heal: function () {
      tone({ freq: 520, to: 780, duration: 0.28, type: 'sine', gain: 0.04 });
      tone({ freq: 780, to: 1040, duration: 0.24, type: 'sine', gain: 0.03, delay: 0.1 });
    },
    freeze: function () {
      tone({ freq: 1100, to: 620, duration: 0.3, type: 'triangle', gain: 0.03 });
    },
    boss: function () {
      tone({ freq: 70, to: 48, duration: 0.9, type: 'sawtooth', gain: 0.07 });
      tone({ freq: 110, to: 70, duration: 0.8, type: 'square', gain: 0.04, delay: 0.1 });
      noise(0.5, 0.06);
    },
    phase: function () {
      tone({ freq: 180, to: 90, duration: 0.4, type: 'sawtooth', gain: 0.05 });
      tone({ freq: 300, to: 520, duration: 0.3, type: 'triangle', gain: 0.04, delay: 0.15 });
    },
    buy: function () {
      tone({ freq: 660, duration: 0.08, type: 'triangle', gain: 0.04 });
      tone({ freq: 990, duration: 0.1, type: 'triangle', gain: 0.04, delay: 0.08 });
    },
    level: function () {
      tone({ freq: 520, duration: 0.12, type: 'triangle', gain: 0.045 });
      tone({ freq: 780, duration: 0.12, type: 'triangle', gain: 0.045, delay: 0.1 });
      tone({ freq: 1040, duration: 0.2, type: 'triangle', gain: 0.04, delay: 0.2 });
    },
    beam: function () {
      tone({ freq: 220, to: 1760, duration: 1.4, type: 'sine', gain: 0.05 });
      tone({ freq: 330, to: 1320, duration: 1.4, type: 'triangle', gain: 0.03, delay: 0.15 });
      noise(0.8, 0.03);
    },
    chime: function () {
      tone({ freq: 660, duration: 0.2, type: 'sine', gain: 0.05 });
      tone({ freq: 880, duration: 0.24, type: 'sine', gain: 0.045, delay: 0.16 });
      tone({ freq: 1100, duration: 0.36, type: 'sine', gain: 0.04, delay: 0.32 });
    },
    lose: function () {
      tone({ freq: 220, to: 110, duration: 0.6, type: 'sawtooth', gain: 0.05 });
      tone({ freq: 160, to: 70, duration: 0.8, type: 'sine', gain: 0.05, delay: 0.3 });
    },

    /* ---- 怪物：出现 / 移动 / 攻击 / 阵亡（按 voice 变调） ---- */
    monsterSpawn: function (opts) {
      const v = voiceOf(opts);
      const boss = !!(opts && opts.boss);
      tone({
        freq: v.base * 0.55,
        to: v.base * (boss ? 0.85 : 1.3),
        duration: boss ? 0.4 : 0.17,
        type: v.type,
        gain: boss ? 0.06 : 0.028
      });
      tone({
        freq: v.base * 1.7,
        to: v.base * 2.3,
        duration: 0.11,
        type: 'sine',
        gain: boss ? 0.025 : 0.016,
        delay: 0.06
      });
      noise(boss ? 0.3 : 0.08, boss ? 0.04 : 0.014, 0.02);
    },
    monsterMove: function (opts) {
      const v = voiceOf(opts);
      tone({
        freq: v.base * 0.52,
        to: v.base * 0.4,
        duration: 0.06,
        type: 'triangle',
        gain: 0.012
      });
    },
    monsterAttack: function (opts) {
      const v = voiceOf(opts);
      tone({
        freq: v.base * 1.18,
        to: v.base * 0.4,
        duration: 0.14,
        type: v.type,
        gain: 0.035
      });
      tone({
        freq: v.base * 0.6,
        to: v.base * 0.28,
        duration: 0.2,
        type: 'sawtooth',
        gain: 0.02,
        delay: 0.03
      });
      noise(0.09, 0.028, 0.01);
    },
    stun: function () {
      tone({ freq: 520, to: 130, duration: 0.45, type: 'sawtooth', gain: 0.045 });
      tone({ freq: 260, to: 80, duration: 0.5, type: 'triangle', gain: 0.03, delay: 0.05 });
      noise(0.18, 0.03, 0.02);
    },
    stunBreak: function () {
      tone({ freq: 180, to: 420, duration: 0.16, type: 'triangle', gain: 0.035 });
      tone({ freq: 620, duration: 0.12, type: 'sine', gain: 0.025, delay: 0.1 });
    },
    monsterDeath: function (opts) {
      const v = voiceOf(opts);
      tone({
        freq: v.base * 1.25,
        to: v.base * 0.22,
        duration: 0.42,
        type: v.type,
        gain: 0.045
      });
      tone({
        freq: v.base * 0.7,
        to: v.base * 0.18,
        duration: 0.5,
        type: 'sine',
        gain: 0.03,
        delay: 0.06
      });
      noise(0.3, 0.03, 0.04);
    }
  };

  function play(name, opts) {
    if (muted) return;
    const fn = sounds[name];
    if (!fn) return;
    try {
      fn(opts || {});
    } catch (err) {
      /* 音频失败不影响游戏 */
    }
  }

  function isMuted() {
    return muted;
  }

  function setMuted(next) {
    muted = !!next;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch (err) {
      /* ignore */
    }
    if (!muted) play('click');
    return muted;
  }

  BQ.Audio = {
    play: play,
    unlock: ensureContext,
    isMuted: isMuted,
    setMuted: setMuted,
    available: function () {
      return Object.keys(sounds);
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
