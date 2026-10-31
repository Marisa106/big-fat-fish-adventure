'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Rng = require('../js/core/rng.js');

test('same seed produces identical sequences', function () {
  const a = Rng.create(2026);
  const b = Rng.create(2026);
  for (let i = 0; i < 50; i += 1) {
    assert.equal(a.next(), b.next());
  }
});

test('different seeds diverge', function () {
  const a = Rng.create(1);
  const b = Rng.create(2);
  assert.notEqual(a.next(), b.next());
});

test('int stays within inclusive bounds', function () {
  const rng = Rng.create(7);
  for (let i = 0; i < 1000; i += 1) {
    const value = rng.int(3, 9);
    assert.ok(value >= 3 && value <= 9);
    assert.equal(Number.isInteger(value), true);
  }
});

test('pick returns an element of the list', function () {
  const rng = Rng.create(11);
  const list = ['a', 'b', 'c'];
  for (let i = 0; i < 100; i += 1) {
    assert.ok(list.indexOf(rng.pick(list)) >= 0);
  }
  assert.equal(rng.pick([]), undefined);
});

test('shuffle keeps every element exactly once', function () {
  const rng = Rng.create(99);
  const source = [1, 2, 3, 4, 5, 6, 7, 8];
  const shuffled = rng.shuffle(source);
  assert.equal(shuffled.length, source.length);
  assert.deepEqual(shuffled.slice().sort(function (a, b) { return a - b; }), source);
  assert.deepEqual(source, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('weighted respects zero weights and returns a single option', function () {
  const rng = Rng.create(5);
  assert.equal(rng.weighted([['only', 5]]), 'only');
  assert.equal(rng.weighted([['zero', 0], ['real', 1]]), 'real');
  assert.equal(rng.weighted([]), undefined);
});

test('hashSeed is stable for strings and numbers', function () {
  assert.equal(Rng.hashSeed('大肥鱼'), Rng.hashSeed('大肥鱼'));
  assert.equal(Rng.hashSeed(123), 123);
  assert.equal(Rng.hashSeed(0), 1);
  assert.equal(Rng.hashSeed('123'), Rng.hashSeed('123'));
});
