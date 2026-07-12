// Lightweight secrets scanner — no external binary (gitleaks etc.) required,
// which keeps `npx vibecheck` a zero-install, single-command experience.
// This is intentionally a "good enough to be alarming" v1, not exhaustive —
// swapping in gitleaks later is a natural upgrade path if this proves too noisy/weak.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// (name, regex) pairs for common high-confidence secret shapes.
const PATTERNS = [
  ["AWS Access Key", /AKIA[0-9A-Z]{16}/g],
  ["AWS Secret Key (heuristic)", /aws(.{0,20})?['"][0-9a-zA-Z/+]{40}['"]/gi],
  [
    "Generic API key assignment",
    /(api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9_-]{16,}['"]/gi,
  ],
  ["Private key block", /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ["Slack token", /xox[baprs]-[0-9a-zA-Z-]{10,}/g],
  ["GitHub token", /gh[pousr]_[0-9a-zA-Z]{36,}/g],
  ["Stripe key", /sk_live_[0-9a-zA-Z]{16,}/g],
  [
    "Generic bearer/JWT-looking secret",
    /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
  ],
];

function scanText(text, source, findings) {
  for (const [name, re] of PATTERNS) {
    const matches = text.match(re);
    if (matches) {
      for (const m of matches) {
        findings.push({ name, source, preview: redact(m) });
      }
    }
  }
}

function redact(value) {
  if (value.length <= 8) return "*".repeat(value.length);
  return value.slice(0, 4) + "*".repeat(Math.max(4, value.length - 8)) + value.slice(-4);
}

export function runSecretsCheck(repoPath) {
  const findings = [];

  // 1. Current working tree (tracked files only, respects .gitignore).
  let files = [];
  try {
    files = execSync("git ls-files", { cwd: repoPath, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    findings.push({ error: "not a git repository — skipped working-tree scan" });
  }

  for (const f of files.slice(0, 5000)) {
    try {
      const text = readFileSync(`${repoPath}/${f}`, "utf8");
      scanText(text, f, findings);
    } catch {
      // binary or unreadable file — skip silently
    }
  }

  // 2. Git history — this is where AI-assisted commits most often leak a key
  //    that was later "fixed" by deleting it, without realizing history keeps it.
  try {
    const log = execSync('git log -p --all -- . 2>/dev/null | grep -E "^\\+" | grep -v "^+++"', {
      cwd: repoPath,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 50,
    });
    scanText(log, "git history", findings);
  } catch {
    // no history, or grep found nothing — fine
  }

  const errors = findings.filter((f) => f.error);
  const secrets = findings.filter((f) => !f.error);

  // Dedupe by (name, preview) so the same key found in 40 commits doesn't
  // count 40 times.
  const seen = new Set();
  const unique = secrets.filter((s) => {
    const key = `${s.name}::${s.preview}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { findings: unique, errors, count: unique.length };
}
