/* 背景音乐：循环播放 MP3，首次交互后开始，可独立于音效开关 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const STORAGE_KEY = 'bq.music.muted';
  const SOURCE = 'assets/audio/bgm.mp3';
  const VOLUME = 0.32;

  let el = null;
  let muted = false;
  let started = false;
  let bound = false;

  try {
    muted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (err) {
    muted = false;
  }

  function audioEl() {
    if (el) return el;
    const doc = root.document;
    if (!doc) return null;
    el = doc.getElementById('bgm');
    if (!el) {
      el = doc.createElement('audio');
      el.id = 'bgm';
      el.src = SOURCE;
      el.preload = 'auto';
      (doc.body || doc.documentElement).appendChild(el);
    }
    el.loop = true;
    el.volume = VOLUME;
    return el;
  }

  function play() {
    if (muted) return;
    const audio = audioEl();
    if (!audio) return;
    audio.volume = VOLUME;
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(function () {
        /* 浏览器未授予播放权限时保持静默，下一次交互会再试 */
      });
    }
  }

  function start() {
    started = true;
    if (!muted) play();
  }

  function pause() {
    const audio = audioEl();
    if (!audio) return;
    try {
      audio.pause();
    } catch (err) {
      /* 忽略 */
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
    if (muted) {
      pause();
    } else {
      started = true;
      play();
    }
    return muted;
  }

  function toggle() {
    return setMuted(!muted);
  }

  /* CG 成片有独立音轨：播放期间暂停 BGM，结束后接回 */
  function suspend() {
    pause();
  }

  function resume() {
    if (started && !muted) play();
  }

  function onGesture() {
    start();
    const doc = root.document;
    if (!doc) return;
    doc.removeEventListener('pointerdown', onGesture, true);
    doc.removeEventListener('keydown', onGesture, true);
    doc.removeEventListener('click', onGesture, true);
  }

  function bindAutoplay() {
    if (bound) return;
    bound = true;
    const doc = root.document;
    if (!doc) return;
    doc.addEventListener('pointerdown', onGesture, true);
    doc.addEventListener('keydown', onGesture, true);
    doc.addEventListener('click', onGesture, true);
  }

  BQ.Bgm = {
    start: start,
    pause: pause,
    suspend: suspend,
    resume: resume,
    toggle: toggle,
    isMuted: isMuted,
    setMuted: setMuted,
    bindAutoplay: bindAutoplay,
    volume: VOLUME
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
