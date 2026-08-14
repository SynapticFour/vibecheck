import { test } from "node:test";
import assert from "node:assert/strict";
import { runChurnCheck } from "../src/checks/churn.js";
import { commitAll, createTempDir, initGitRepo, writeFiles } from "./helpers.js";

test("churn: high fix-ratio repo", () => {
  const dir = createTempDir();
  initGitRepo(dir);
  writeFiles(dir, { "readme.txt": "v1\n" });
  commitAll(dir, "initial commit");
  for (let i = 0; i < 6; i++) {
    writeFiles(dir, { "readme.txt": `v${i + 2}\n` });
    commitAll(dir, `fix bug ${i + 1}`);
  }

  const result = runChurnCheck(dir);
  assert.equal(result.total, 7);
  assert.equal(result.fixCommits, 6);
  assert.ok(result.ratio > 0.3);
});

test("churn: low fix-ratio repo", () => {
  const dir = createTempDir();
  initGitRepo(dir);
  writeFiles(dir, { "readme.txt": "v1\n" });
  commitAll(dir, "initial commit");
  writeFiles(dir, { "readme.txt": "v2\n" });
  commitAll(dir, "add feature");
  writeFiles(dir, { "readme.txt": "v3\n" });
  commitAll(dir, "document API");
  writeFiles(dir, { "readme.txt": "v4\n" });
  commitAll(dir, "refactor parser");
  writeFiles(dir, { "readme.txt": "v5\n" });
  commitAll(dir, "fix typo in docs");

  const result = runChurnCheck(dir);
  assert.equal(result.total, 5);
  assert.equal(result.fixCommits, 1);
  assert.ok(result.ratio < 0.3);
});

test("churn: non-git directory is a soft error", () => {
  const dir = createTempDir();
  const result = runChurnCheck(dir);
  assert.equal(result.total, 0);
  assert.equal(result.ratio, 0);
  assert.ok(result.error);
});
