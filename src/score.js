// Deliberately simple, deliberately transparent scoring. The formula is
// printed in the report itself — this audience distrusts opaque scores, and
// a visible formula is more credible than a polished but unexplained number.
export function computeScore({ secrets, duplicates, churn, tests }) {
  let score = 100;
  const deductions = [];

  if (secrets.count > 0) {
    const d = Math.min(40, secrets.count * 15);
    score -= d;
    deductions.push(`-${d} for ${secrets.count} potential secret(s) found in code or git history`);
  }

  const dupLines = duplicates.totalDuplicateLines || 0;
  if (dupLines > 0) {
    // ~1 point per 20 duplicate lines, capped — a rough but honest proxy.
    const d = Math.min(25, Math.round(dupLines / 20));
    score -= d;
    deductions.push(`-${d} for ~${dupLines} duplicated lines across ${duplicates.cloneCount} clone group(s)`);
  }

  if (churn.total > 0 && churn.ratio > 0.3) {
    const d = Math.min(20, Math.round((churn.ratio - 0.3) * 100));
    score -= d;
    deductions.push(
      `-${d} for high fix-commit ratio (${churn.fixCommits}/${churn.total} of last ${churn.total} commits look like fixes)`
    );
  }

  if (!tests.hasTests) {
    score -= 15;
    deductions.push(`-15 for no test suite detected`);
  }
  if (tests.hasTests && !tests.hasCI) {
    score -= 5;
    deductions.push(`-5 for tests exist but no CI configuration found to run them`);
  }

  score = Math.max(0, Math.min(100, score));
  return { score, deductions };
}
