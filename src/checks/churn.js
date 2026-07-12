// Commit-churn check — a wall of "fix" / "fix again" / "actually fix" commits
// in a short window is one of the most honest, low-effort tells that something
// was shipped before it was understood. Pure `git log`, no dependencies.
import { execSync } from "node:child_process";

const FIX_PATTERN = /\b(fix|fixed|fixes|fixing|bug|bugfix|hotfix|patch|revert|oops|typo|attempt)\b/i;
const WINDOW = 100; // most recent N commits considered

export function runChurnCheck(repoPath) {
  let lines;
  try {
    lines = execSync(`git log -n ${WINDOW} --pretty=format:"%s"`, {
      cwd: repoPath,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  } catch {
    return { error: "not a git repository or no commit history", total: 0, fixCommits: 0, ratio: 0 };
  }

  const total = lines.length;
  const fixCommits = lines.filter((l) => FIX_PATTERN.test(l)).length;
  const ratio = total > 0 ? fixCommits / total : 0;

  return { total, fixCommits, ratio };
}
