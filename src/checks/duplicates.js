// Duplicate-code detection via jscpd — the most literal signal of
// "the AI wrote this same block four times with slightly different names."
import { detectClones } from "jscpd";

export async function runDuplicatesCheck(repoPath) {
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
    return { error: e.message, duplicatePercent: 0, clones: [] };
  }

  if (!clones.length) {
    return { duplicatePercent: 0, clones: [] };
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
  };
}
