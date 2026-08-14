import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createTempDir, writeFiles } from "./helpers.js";

const root = dirname(fileURLToPath(import.meta.url));
const scan = join(root, "..", "bin", "scan.js");

test("scan: does not print a placeholder report URL when unset", () => {
  const dir = createTempDir();
  writeFiles(dir, { "index.js": "export const x = 1;\n" });
  const env = { ...process.env };
  delete env.VIBECHECK_REPORT_URL;
  const out = execFileSync(process.execPath, [scan, dir], { encoding: "utf8", env });
  assert.doesNotMatch(out, /example\.com/);
  assert.match(out, /no report URL configured/);
  assert.doesNotMatch(out, /fix roadmap/);
});

test("scan: prints the call-to-action only when a real URL is set", () => {
  const dir = createTempDir();
  writeFiles(dir, { "index.js": "export const x = 1;\n" });
  const env = { ...process.env, VIBECHECK_REPORT_URL: "https://reports.example.org/vibe" };
  const out = execFileSync(process.execPath, [scan, dir], { encoding: "utf8", env });
  assert.match(out, /fix roadmap/);
  assert.match(out, /https:\/\/reports\.example\.org\/vibe/);
  assert.doesNotMatch(out, /no report URL configured/);
});
