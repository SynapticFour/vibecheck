import { test } from "node:test";
import assert from "node:assert/strict";
import { runTestPresenceCheck } from "../src/checks/tests.js";
import { createTempDir, writeFiles } from "./helpers.js";

test("tests: repo with tests and CI", () => {
  const dir = createTempDir();
  writeFiles(dir, {
    "src/index.js": "export const x = 1;\n",
    "test/index.test.js": "export const t = 1;\n",
    ".github/workflows/ci.yml": "name: CI\non: push\njobs: {}\n",
  });
  const result = runTestPresenceCheck(dir);
  assert.equal(result.hasTests, true);
  assert.equal(result.hasCI, true);
});

test("tests: repo with tests but no CI", () => {
  const dir = createTempDir();
  writeFiles(dir, {
    "src/index.js": "export const x = 1;\n",
    "app.spec.js": "export const t = 1;\n",
  });
  const result = runTestPresenceCheck(dir);
  assert.equal(result.hasTests, true);
  assert.equal(result.hasCI, false);
});

test("tests: repo with neither tests nor CI", () => {
  const dir = createTempDir();
  writeFiles(dir, {
    "src/index.js": "export const x = 1;\n",
  });
  const result = runTestPresenceCheck(dir);
  assert.equal(result.hasTests, false);
  assert.equal(result.hasCI, false);
});
