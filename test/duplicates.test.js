import { test } from "node:test";
import assert from "node:assert/strict";
import { runDuplicatesCheck } from "../src/checks/duplicates.js";
import {
  LITERAL_FN,
  PROCESS_CUSTOMER,
  PROCESS_USER,
  UNRELATED_A,
  UNRELATED_B,
  createTempDir,
  writeFiles,
} from "./helpers.js";

test("duplicates: flags literal copy-paste via jscpd", async () => {
  const dir = createTempDir();
  writeFiles(dir, {
    "a.js": LITERAL_FN,
    "b.js": LITERAL_FN,
  });

  const result = await runDuplicatesCheck(dir);
  assert.ok(result.cloneCount >= 1, `expected literal clones, got ${result.cloneCount}`);
  assert.ok(result.totalDuplicateLines > 0);
});

test("duplicates: flags renamed-identifier (type-2) clones", async () => {
  const dir = createTempDir();
  writeFiles(dir, {
    "a.js": PROCESS_USER,
    "b.js": PROCESS_CUSTOMER,
  });

  const result = await runDuplicatesCheck(dir);
  assert.equal(result.cloneCount, 0, "jscpd should not see renamed identifiers");
  assert.equal(result.structuralCloneCount, 1);
  assert.equal(result.totalStructuralDuplicateLines, 6);
  assert.equal(result.structuralOffenders[0].nameA, "processUser");
  assert.equal(result.structuralOffenders[0].nameB, "processCustomer");
});

test("duplicates: does not flag unrelated functions of similar length", async () => {
  const dir = createTempDir();
  writeFiles(dir, {
    "a.js": UNRELATED_A,
    "b.js": UNRELATED_B,
  });

  const result = await runDuplicatesCheck(dir);
  assert.equal(result.cloneCount, 0);
  assert.equal(result.structuralCloneCount, 0);
  assert.equal(result.totalStructuralDuplicateLines, 0);
});
