/* 输入：棋盘点击/悬停、键盘快捷键 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const Dom = BQ.Dom;

  let handlers = {};
  let boardEl = null;
  let lastHoverKey = '';

  function tileFromEvent(event) {
    const target = event.target;
    if (!target) return null;
    const tile = target.closest ? target.closest('.tile') : null;
    if (!tile) return null;
    return { x: Number(tile.dataset.x), y: Number(tile.dataset.y), el: tile };
  }

  function init(opts) {
    handlers = opts || {};
    boardEl = Dom.$('#board');
    if (!boardEl) return;

    boardEl.addEventListener('click', function (event) {
      const tile = tileFromEvent(event);
      if (!tile) return;
      if (handlers.onTile) handlers.onTile(tile.x, tile.y);
    });

    boardEl.addEventListener('mousemove', function (event) {
      const tile = tileFromEvent(event);
      const key = tile ? tile.x + ',' + tile.y : '';
      if (key === lastHoverKey) return;
      lastHoverKey = key;
      if (handlers.onHover) handlers.onHover(tile ? { x: tile.x, y: tile.y } : null);
    });

    boardEl.addEventListener('mouseleave', function () {
      lastHoverKey = '';
      if (handlers.onHover) handlers.onHover(null);
    });

    document.addEventListener('keydown', function (event) {
      if (event.defaultPrevented) return;
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (BQ.Modals && BQ.Modals.isOpen()) {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (handlers.onModalEscape) handlers.onModalEscape();
        }
        return;
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (handlers.onRest) handlers.onRest();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (handlers.onEscape) handlers.onEscape();
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        event.preventDefault();
        if (handlers.onMoveDirection) handlers.onMoveDirection(0, -1);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        event.preventDefault();
        if (handlers.onMoveDirection) handlers.onMoveDirection(0, 1);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        if (handlers.onMoveDirection) handlers.onMoveDirection(-1, 0);
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        if (handlers.onMoveDirection) handlers.onMoveDirection(1, 0);
        return;
      }
      if (/^[1-8]$/.test(event.key)) {
        event.preventDefault();
        if (handlers.onNumber) handlers.onNumber(Number(event.key));
      }
    });
  }

  BQ.Input = {
    init: init
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
