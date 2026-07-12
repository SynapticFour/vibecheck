#!/usr/bin/env node
// vibecheck — local-first health scan for AI-generated codebases.
// Nothing here makes a network call. The scan runs entirely on your machine;
// see README for why that's a structural guarantee, not a policy promise.
import { runSecretsCheck } from "../src/checks/secrets.js";
import { runDuplicatesCheck } from "../src/checks/duplicates.js";
import { runChurnCheck } from "../src/checks/churn.js";
import { runTestPresenceCheck } from "../src/checks/tests.js";
import { computeScore } from "../src/score.js";

const REPORT_URL = process.env.VIBECHECK_REPORT_URL || "https://example.com/report"; // TODO: set your real URL

const target = process.argv[2] || ".";

function bar(score) {
  const filled = Math.round(score / 5);
  return "█".repeat(filled) + "░".repeat(20 - filled);
}

function grade(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

async function main() {
  console.log(`\nvibecheck — scanning ${target}\n(everything below runs locally; nothing is sent anywhere)\n`);

  const secrets = runSecretsCheck(target);
  const duplicates = await runDuplicatesCheck(target);
  const churn = runChurnCheck(target);
  const tests = runTestPresenceCheck(target);

  const { score, deductions } = computeScore({ secrets, duplicates, churn, tests });

  console.log(`Score: ${score}/100  [${grade(score)}]  ${bar(score)}\n`);

  if (deductions.length === 0) {
    console.log("No issues found across the checks run here. (This is a narrow scan — see README for what it does and doesn't cover.)\n");
  } else {
    console.log("How this score was calculated (starts at 100):");
    for (const d of deductions) console.log(`  ${d}`);
    console.log("");
  }

  if (secrets.count > 0) {
    console.log(`⚠ Potential secrets (${secrets.count}):`);
    for (const f of secrets.findings.slice(0, 5)) {
      console.log(`  - ${f.name} in ${f.source}  (${f.preview})`);
    }
    if (secrets.count > 5) console.log(`  ...and ${secrets.count - 5} more`);
    console.log(`  → If real, rotate these immediately regardless of anything else in this report.\n`);
  }

  if (duplicates.totalDuplicateLines > 0) {
    console.log(`⚠ Duplicate code: ~${duplicates.totalDuplicateLines} lines across ${duplicates.cloneCount} clone group(s)`);
    for (const c of duplicates.topOffenders || []) {
      console.log(`  - ${c.fileA} <-> ${c.fileB}  (${c.lines} lines)`);
    }
    console.log("");
  }

  if (churn.total > 0 && churn.ratio > 0.3) {
    console.log(`⚠ Commit churn: ${churn.fixCommits} of the last ${churn.total} commits look like fixes (${Math.round(churn.ratio * 100)}%)\n`);
  }

  if (!tests.hasTests) {
    console.log(`⚠ No test suite detected\n`);
  } else if (!tests.hasCI) {
    console.log(`⚠ Tests exist, but no CI configuration found to actually run them\n`);
  }

  if (secrets.errors?.length) {
    for (const e of secrets.errors) console.log(`(note: ${e.error})`);
  }

  console.log("---");
  console.log(`Want a prioritized fix roadmap, or a second pair of eyes on whether this is worth rescuing?`);
  console.log(`  → ${REPORT_URL}\n`);
}

main().catch((e) => {
  console.error("vibecheck hit an unexpected error:", e.message);
  process.exit(1);
});
