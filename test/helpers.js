import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

export function createTempDir(prefix = "vibecheck-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function writeFiles(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

const gitEnv = {
  GIT_AUTHOR_NAME: "Vibecheck Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Vibecheck Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
  HUSKY: "0",
};

export function git(cwd, args) {
  return execSync(`git ${args}`, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...gitEnv },
  });
}

export function initGitRepo(root) {
  git(root, "init -b main --template=");
  git(root, 'config user.name "Vibecheck Test"');
  git(root, "config user.email test@example.com");
  git(root, "config commit.gpgsign false");
}

export function commitAll(root, message) {
  git(root, "add -A");
  git(root, `commit --no-gpg-sign -m ${JSON.stringify(message)}`);
}

export const PROCESS_USER = `function processUser(user) {
  if (!user) return null;
  const name = user.name.trim();
  const email = user.email.toLowerCase();
  return { name, email, active: true, created: Date.now() };
}
`;

export const PROCESS_CUSTOMER = `function processCustomer(customer) {
  if (!customer) return null;
  const name = customer.name.trim();
  const email = customer.email.toLowerCase();
  return { name, email, active: true, created: Date.now() };
}
`;

// Long enough to clear jscpd's minTokens: 50 / minLines: 5 gates.
export const LITERAL_FN = `function normalizeRecord(record) {
  if (!record) return null;
  const name = String(record.name || "").trim().toLowerCase();
  const email = String(record.email || "").trim().toLowerCase();
  const tags = Array.isArray(record.tags) ? record.tags.map((t) => String(t).trim()) : [];
  const created = record.created ? new Date(record.created).toISOString() : new Date().toISOString();
  const active = record.active !== false;
  const score = Number(record.score) || 0;
  const notes = String(record.notes || "").slice(0, 500);
  return { name, email, tags, created, active, score, notes, source: "import" };
}
`;

export const UNRELATED_A = `function sumValues(list) {
  let total = 0;
  for (const item of list) {
    total += Number(item) || 0;
  }
  return total;
}
`;

export const UNRELATED_B = `function greetPerson(person) {
  if (!person) return "";
  const greeting = "hello";
  return greeting + " " + person;
}
`;
