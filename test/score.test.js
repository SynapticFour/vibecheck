import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore } from "../src/score.js";

const clean = {
  secrets: { count: 0 },
  duplicates: {
    totalDuplicateLines: 0,
    cloneCount: 0,
    totalStructuralDuplicateLines: 0,
    structuralCloneCount: 0,
  },
  churn: { total: 10, fixCommits: 1, ratio: 0.1 },
  tests: { hasTests: true, hasCI: true },
};

test("score: clean repo is 100", () => {
  const { score, deductions } = computeScore(clean);
  assert.equal(score, 100);
  assert.deepEqual(deductions, []);
});

test("score: one secret is -15", () => {
  const { score, deductions } = computeScore({
    ...clean,
    secrets: { count: 1 },
  });
  assert.equal(score, 85);
  assert.equal(deductions.length, 1);
  assert.match(deductions[0], /^-15 /);
});

test("score: secrets cap at -40", () => {
  const { score } = computeScore({
    ...clean,
    secrets: { count: 10 },
  });
  assert.equal(score, 60);
});

test("score: fewer than 10 duplicate lines does not deduct", () => {
  const { score, deductions } = computeScore({
    ...clean,
    duplicates: {
      ...clean.duplicates,
      totalDuplicateLines: 6,
      cloneCount: 1,
      totalStructuralDuplicateLines: 6,
      structuralCloneCount: 1,
    },
  });
  assert.equal(score, 100);
  assert.deepEqual(deductions, []);
});

test("score: 20 literal duplicate lines is -1", () => {
  const { score, deductions } = computeScore({
    ...clean,
    duplicates: { ...clean.duplicates, totalDuplicateLines: 20, cloneCount: 1 },
  });
  assert.equal(score, 99);
  assert.match(deductions[0], /literal duplicated lines/);
});

test("score: literal duplicates cap at -25", () => {
  const { score } = computeScore({
    ...clean,
    duplicates: { ...clean.duplicates, totalDuplicateLines: 10_000, cloneCount: 40 },
  });
  assert.equal(score, 75);
});

test("score: 20 structurally similar lines is -1", () => {
  const { score, deductions } = computeScore({
    ...clean,
    duplicates: {
      ...clean.duplicates,
      totalStructuralDuplicateLines: 20,
      structuralCloneCount: 1,
    },
  });
  assert.equal(score, 99);
  assert.match(deductions[0], /structurally similar/);
});

test("score: structural duplicates cap at -25", () => {
  const { score } = computeScore({
    ...clean,
    duplicates: {
      ...clean.duplicates,
      totalStructuralDuplicateLines: 10_000,
      structuralCloneCount: 40,
    },
  });
  assert.equal(score, 75);
});

test("score: churn at 30% does not deduct; 40% deducts 10", () => {
  const atThreshold = computeScore({
    ...clean,
    churn: { total: 10, fixCommits: 3, ratio: 0.3 },
  });
  assert.equal(atThreshold.score, 100);

  const above = computeScore({
    ...clean,
    churn: { total: 10, fixCommits: 4, ratio: 0.4 },
  });
  assert.equal(above.score, 90);
});

test("score: no tests is -15; tests without CI is -5", () => {
  const none = computeScore({
    ...clean,
    tests: { hasTests: false, hasCI: false },
  });
  assert.equal(none.score, 85);

  const noCi = computeScore({
    ...clean,
    tests: { hasTests: true, hasCI: false },
  });
  assert.equal(noCi.score, 95);
});

test("score: combined deductions floor at 0", () => {
  const { score } = computeScore({
    secrets: { count: 10 },
    duplicates: {
      totalDuplicateLines: 10_000,
      cloneCount: 40,
      totalStructuralDuplicateLines: 10_000,
      structuralCloneCount: 40,
    },
    churn: { total: 100, fixCommits: 90, ratio: 0.9 },
    tests: { hasTests: false, hasCI: false },
  });
  assert.equal(score, 0);
});
