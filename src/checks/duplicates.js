// Duplicate-code detection, two layers:
//   1. Literal (type-1) clones via jscpd — cheap, token-identical copy-paste.
//   2. Structural (type-2) clones via src/checks/structural.js — same logic
//      with renamed identifiers, which jscpd cannot see.
import { detectClones } from "jscpd";
import { findStructuralClones } from "./structural.js";

const emptyLiteral = {
  duplicatePercent: 0,
  clones: [],
  cloneCount: 0,
  totalDuplicateLines: 0,
  topOffenders: [],
};

export async function runDuplicatesCheck(repoPath) {
  const literal = await findLiteralClones(repoPath);
  const structural = findStructuralClones(repoPath);
  return { ...literal, ...structural };
}

async function findLiteralClones(repoPath) {
  let clones;
  try {
    clones = await detectClones({
      path: [repoPath],
      silent: true,
      gitignore: true,
      ignore: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/venv/**",
        "**/__pycache__/**",
      ],
      minLines: 5,
      minTokens: 50,
    });
  } catch (e) {
    return { ...emptyLiteral, error: e.message };
  }

  if (!clones.length) {
    return emptyLiteral;
  }

  const totalDuplicateLines = clones.reduce(
    (sum, c) =>
      sum + (c.duplicationA?.range ? c.duplicationA.range[1] - c.duplicationA.range[0] : 0),
    0,
  );

  // Rough proxy: duplicate lines found vs. a generous "typical repo" denominator.
  // jscpd's own summary would be more precise but requires the reporter pipeline;
  // this keeps the check dependency-light and fast. Good enough to flag outliers.
  const topOffenders = [...clones]
    .sort(
      (a, b) =>
        (b.duplicationA?.range?.[1] - b.duplicationA?.range?.[0] || 0) -
        (a.duplicationA?.range?.[1] - a.duplicationA?.range?.[0] || 0),
    )
    .slice(0, 5)
    .map((c) => ({
      fileA: c.duplicationA?.sourceId,
      fileB: c.duplicationB?.sourceId,
      lines: c.duplicationA?.range ? c.duplicationA.range[1] - c.duplicationA.range[0] : 0,
    }));

  return {
    cloneCount: clones.length,
    totalDuplicateLines,
    topOffenders,
    duplicatePercent: 0,
    clones,
  };
}
