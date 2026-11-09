'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_helpers.js');
const Questions = H.Questions;

function bestAnswer(caseData) {
  return {
    diagnosisId: caseData.diagnoses.find(function (item) { return item.correct; }).id,
    checkIds: caseData.checks.filter(function (item) { return item.points >= 10; })
      .slice(0, 2).map(function (item) { return item.id; }),
    prescriptionId: caseData.prescriptions[0].id,
    text: ''
  };
}

test('ten AI cases cover every fourth level from 4 to 40', function () {
  assert.equal(Questions.CASES.length, 10);
  const levels = Questions.CASES.map(function (item) { return item.level; });
  assert.deepEqual(levels, Array.from({ length: 10 }, function (_, i) { return 4 + i * 4; }));
  Questions.CASES.forEach(function (item) {
    assert.equal(item.diagnoses.length, 3, item.id + ' 需要 3 个诊断选项');
    assert.equal(item.diagnoses.filter(function (option) { return option.correct; }).length, 1);
    assert.ok(item.checks.length >= 3, item.id + ' 至少需要 3 个检查选项');
    assert.equal(item.prescriptions.length, 3, item.id + ' 需要 3 个处方选项');
    assert.ok(item.checks.filter(function (option) { return option.points >= 10; }).length >= 2);
    assert.ok(item.explain.length > 8);
    assert.ok(item.keywords.length >= 2);
  });
});

test('a complete, correct case earns a high score and all three parts', function () {
  const caseData = Questions.caseByLevel(4);
  const judged = Questions.localJudge(caseData, bestAnswer(caseData));
  assert.equal(judged.parts.diagnosis, 100);
  assert.equal(judged.parts.checks, 100);
  assert.equal(judged.parts.prescription, 86);
  assert.equal(judged.score, 95);
  assert.ok(judged.axes.knowledge >= 2);
  assert.ok(judged.axes.critical >= 3);
  assert.equal(judged.source, 'local');
});

test('a wrong diagnosis scores lower and raises reliance', function () {
  const caseData = Questions.caseByLevel(4);
  const answer = bestAnswer(caseData);
  answer.diagnosisId = caseData.diagnoses.find(function (item) { return !item.correct; }).id;
  const judged = Questions.localJudge(caseData, answer);
  assert.equal(judged.parts.diagnosis, 0);
  assert.equal(judged.score, 60);
  assert.ok(judged.axes.reliance > 0);
});

test('irrelevant checks lower the check score', function () {
  const caseData = Questions.caseByLevel(4);
  const answer = bestAnswer(caseData);
  answer.checkIds = [caseData.checks.find(function (item) { return item.points === 0; }).id];
  const judged = Questions.localJudge(caseData, answer);
  assert.equal(judged.parts.checks, 0);
  assert.equal(judged.score, 65);
});

test('free-text prescriptions are rewarded for keywords', function () {
  const caseData = Questions.caseByLevel(4);
  const answer = bestAnswer(caseData);
  answer.text = '我会核实来源并交叉查证，确认 DOI 后再引用，避免把幻觉写进论文。';
  const judged = Questions.localJudge(caseData, answer);
  assert.ok(judged.matched.length >= 3);
  assert.equal(judged.parts.prescription, 100);
  assert.equal(judged.score, 100);
});

test('empty answers score zero', function () {
  const caseData = Questions.caseByLevel(4);
  const judged = Questions.localJudge(caseData, {});
  assert.equal(judged.score, 0);
  assert.equal(judged.parts.diagnosis, 0);
  assert.ok(judged.feedback.length > 0);
});

test('applying a case updates records, parts and axis totals', function () {
  const state = H.makeRun();
  H.begin(state, 4, { questions: true });
  assert.equal(state.phase, 'question');
  const caseData = state.pendingQuestion.caseData;
  const answer = bestAnswer(caseData);
  const result = H.P.answerQuestion(state, answer, Questions.localJudge(caseData, answer));
  assert.equal(result.ok, true);
  assert.equal(state.questionAnswers.length, 1);
  assert.equal(state.stats.questionsAnswered, 1);
  assert.equal(state.questionAnswers[0].caseId, 'c01');
  assert.equal(state.questionAnswers[0].parts.checks, 100);
  assert.ok(state.axes.knowledge > 0);
  assert.equal(state.phase, 'battle');
  assert.equal(Questions.levelHasCase(state, 4), true);
});

test('axis percentages are capped at 100', function () {
  const state = H.makeRun();
  state.axes.knowledge = 999;
  const pct = Questions.axesPercent(state);
  assert.equal(pct.knowledge, 100);
});
