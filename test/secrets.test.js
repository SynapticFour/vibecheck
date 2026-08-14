import { test } from "node:test";
import assert from "node:assert/strict";
import { runSecretsCheck } from "../src/checks/secrets.js";
import { commitAll, createTempDir, initGitRepo, writeFiles } from "./helpers.js";

const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
const GITHUB_TOKEN = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";

test("secrets: finds a secret in the working tree", () => {
  const dir = createTempDir();
  initGitRepo(dir);
  writeFiles(dir, {
    "config.js": `export const accessKey = "${AWS_KEY}";\n`,
  });
  commitAll(dir, "add config");

  const result = runSecretsCheck(dir);
  assert.ok(result.count >= 1, `expected at least 1 secret, got ${result.count}`);
  assert.ok(
    result.findings.some((f) => f.source !== "git history"),
    "expected a working-tree finding",
  );
});

test("secrets: finds a key that was committed then deleted", () => {
  const dir = createTempDir();
  initGitRepo(dir);
  writeFiles(dir, {
    "secrets.js": `export const token = "${GITHUB_TOKEN}";\n`,
  });
  commitAll(dir, "accidentally commit token");
  writeFiles(dir, {
    "secrets.js": `export const token = process.env.GITHUB_TOKEN;\n`,
  });
  commitAll(dir, "remove token from working tree");

  const result = runSecretsCheck(dir);
  assert.ok(result.count >= 1, `expected history secret, got ${result.count}`);
  assert.ok(
    result.findings.some((f) => f.source === "git history"),
    `expected a git-history finding, got ${JSON.stringify(result.findings)}`,
  );
});
