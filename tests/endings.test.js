'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_helpers.js');
const Endings = H.Endings;
const Questions = H.Questions;

function makeState(axes, choice) {
  const state = H.makeRun();
  state.axes = Object.assign(Questions.emptyAxes(), axes || {});
  state.finalChoice = choice || null;
  return state;
}

test('there are twelve distinct endings including the rice ending', function () {
  assert.equal(Endings.ENDINGS.length, 12);
  const ids = Endings.ENDINGS.map(function (ending) { return ending.id; });
  assert.equal(new Set(ids).size, 12);
  assert.ok(ids.indexOf('rice') >= 0);
  assert.ok(ids.indexOf('trueEnd') >= 0);
  Endings.ENDINGS.forEach(function (ending) {
    assert.ok(ending.title.length > 0);
    assert.ok(ending.description.length > 0);
    assert.ok(ending.lines.length >= 2);
  });
});

test('home choice always returns the rice ending', function () {
  const state = makeState({ knowledge: 20, critical: 20, practice: 20, privacy: 20, prompt: 20, teaching: 20, reliance: 20 }, 'home');
  assert.equal(Endings.resolveEnding(state), 'rice');
});

test('friend choice returns the rice-cooker friendship ending', function () {
  assert.equal(Endings.resolveEnding(makeState({}, 'friend')), 'cookerFriend');
});

test('share with practice opens the open-source ending', function () {
  const state = makeState({ practice: 15 }, 'share');
  assert.equal(Endings.resolveEnding(state), 'openSource');
});

test('teach with teaching returns the popularizer ending', function () {
  assert.equal(Endings.resolveEnding(makeState({ teaching: 15 }, 'teach')), 'popularizer');
});

test('ask with knowledge and critical reaches the true ending', function () {
  assert.equal(Endings.resolveEnding(makeState({ knowledge: 20, critical: 18 }, 'ask')), 'trueEnd');
});

test('ask with critical but little knowledge hunts hallucinations', function () {
  assert.equal(Endings.resolveEnding(makeState({ knowledge: 5, critical: 18 }, 'ask')), 'truthHunter');
});

test('prompt and privacy axes unlock their dedicated endings', function () {
  assert.equal(Endings.resolveEnding(makeState({ prompt: 15, knowledge: 8 })), 'promptMaster');
  assert.equal(Endings.resolveEnding(makeState({ privacy: 15, knowledge: 8 })), 'privacyGuard');
});

test('always relying on AI produces the dependent ending', function () {
  assert.equal(Endings.resolveEnding(makeState({ reliance: 20, critical: 2 }, 'rely')), 'dependent');
});

test('ignorance produces the power-off ending', function () {
  assert.equal(Endings.resolveEnding(makeState({})), 'powerOff');
});

test('staying with high knowledge but low criticism repeats answers', function () {
  assert.equal(Endings.resolveEnding(makeState({ knowledge: 15, critical: 5, reliance: 5 }, 'stay')), 'parrot');
});

test('a balanced share choice falls back to the partner ending', function () {
  assert.equal(Endings.resolveEnding(makeState({ practice: 5, knowledge: 5, critical: 5 }, 'share')), 'bestPartner');
});

test('final dialogue choices explicitly unlock prompt, privacy and teaching endings', function () {
  assert.equal(Endings.resolveEnding(makeState({}, 'prompt')), 'promptMaster');
  assert.equal(Endings.resolveEnding(makeState({}, 'privacy')), 'privacyGuard');
  assert.equal(Endings.resolveEnding(makeState({}, 'teach')), 'popularizer');
});

test('sharing with too little practice still finds a partner ending', function () {
  assert.equal(Endings.resolveEnding(makeState({ practice: 5 }, 'share')), 'bestPartner');
});

test('every ending can be reached by some state', function () {
  const reached = new Set();
  const states = [
    makeState({}, 'home'),
    makeState({}, 'friend'),
    makeState({ practice: 15 }, 'share'),
    makeState({ teaching: 15 }, 'teach'),
    makeState({ knowledge: 20, critical: 18 }, 'ask'),
    makeState({ knowledge: 5, critical: 18 }, 'ask'),
    makeState({ prompt: 15, knowledge: 8 }),
    makeState({ privacy: 15, knowledge: 8 }),
    makeState({ reliance: 20, critical: 2 }, 'rely'),
    makeState({}),
    makeState({ knowledge: 15, critical: 5, reliance: 5 }, 'stay'),
    makeState({ practice: 5, knowledge: 5, critical: 5 }, 'share')
  ];
  states.forEach(function (state) {
    reached.add(Endings.resolveEnding(state));
  });
  assert.equal(reached.size, 12);
});
