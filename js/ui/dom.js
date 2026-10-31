/* DOM 小工具 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});

  function $(selector, parent) {
    return (parent || document).querySelector(selector);
  }

  function $$(selector, parent) {
    return Array.prototype.slice.call((parent || document).querySelectorAll(selector));
  }

  function clear(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function appendChildren(el, children) {
    if (children == null) return;
    if (Array.isArray(children)) {
      children.forEach(function (child) {
        appendChildren(el, child);
      });
      return;
    }
    if (children instanceof Node) {
      el.appendChild(children);
      return;
    }
    el.appendChild(document.createTextNode(String(children)));
  }

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value == null || value === false) return;
        if (key === 'class') {
          el.className = value;
        } else if (key === 'text') {
          el.textContent = value;
        } else if (key === 'style') {
          el.style.cssText = value;
        } else if (key === 'dataset') {
          Object.keys(value).forEach(function (dataKey) {
            el.dataset[dataKey] = value[dataKey];
          });
        } else if (key.indexOf('on:') === 0) {
          if (typeof value === 'function') {
            el.addEventListener(key.slice(3), value);
          }
        } else if (key === 'html') {
          el.innerHTML = value;
        } else if (key in el && key !== 'list' && key !== 'form') {
          try {
            el[key] = value;
          } catch (err) {
            el.setAttribute(key, value);
          }
        } else {
          el.setAttribute(key, value);
        }
      });
    }
    appendChildren(el, children);
    return el;
  }

  function pad2(num) {
    return num < 10 ? '0' + num : String(num);
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return pad2(minutes) + ':' + pad2(seconds);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  BQ.Dom = {
    $: $,
    $$: $$,
    h: h,
    clear: clear,
    clamp: clamp,
    formatDuration: formatDuration
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
