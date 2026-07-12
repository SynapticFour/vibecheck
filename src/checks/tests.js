// Test-presence check — deliberately binary, no nuance attempted. Does a test
// setup exist at all, does CI exist to run it. That's already meaningful
// signal without pretending to measure actual coverage %.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const TEST_CONFIG_FILES = [
  "jest.config.js",
  "jest.config.ts",
  "jest.config.mjs",
  "jest.config.cjs",
  "vitest.config.js",
  "vitest.config.ts",
  "pytest.ini",
  "pyproject.toml",
  "setup.cfg",
  "phpunit.xml",
  "phpunit.xml.dist",
  "karma.conf.js",
];
const TEST_DIR_NAMES = ["test", "tests", "__tests__", "spec", "specs"];
const CI_PATHS = [
  ".github/workflows",
  ".gitlab-ci.yml",
  ".circleci/config.yml",
  "azure-pipelines.yml",
];

function hasTestFiles(dir, depth = 0) {
  if (depth > 4) return false;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", "build", "venv", "__pycache__"].includes(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (TEST_DIR_NAMES.includes(entry.toLowerCase())) return true;
      if (hasTestFiles(full, depth + 1)) return true;
    } else if (
      /\.(test|spec)\.(js|ts|jsx|tsx|py|rb|go)$/.test(entry) ||
      /^test_.*\.py$/.test(entry)
    ) {
      return true;
    }
  }
  return false;
}

export function runTestPresenceCheck(repoPath) {
  const hasConfigFile = TEST_CONFIG_FILES.some((f) => existsSync(join(repoPath, f)));
  const hasTests = hasConfigFile || hasTestFiles(repoPath);
  const hasCI = CI_PATHS.some((p) => existsSync(join(repoPath, p)));

  return { hasTests, hasCI };
}
