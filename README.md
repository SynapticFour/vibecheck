# vibecheck

> **Development paused (2026-09).** This repository is parked.
>
> It is **not Ferrum**, not the GA4GH released join, and not a Synaptic Four product SKU.
>
> **What this is:** a local-first scanner for AI-generated (“vibe coded”)
> codebases. A toy/tooling experiment, unrelated to the genomics join.
>
> Do not treat this tree as a product offering or as Ferrum evidence.

![CI](https://github.com/SynapticFour/vibecheck/actions/workflows/ci.yml/badge.svg)

A local-first health scan for AI-generated ("vibe coded") codebases. Run it against your own repo, get a score and specific findings in your terminal. Nothing leaves your machine.

## Run it right now, no install/publish needed

```
npx github:SynapticFour/vibecheck /path/to/repo
```

This clones and runs directly from GitHub — no npm account, no publish step. Good for early testing and for security-conscious users who'd rather audit a pinned commit than trust the npm registry's supply chain.

For a specific commit/tag instead of the latest `main` (recommended so the code you audit is the exact code that runs):

```
npx github:SynapticFour/vibecheck#<commit-or-tag> /path/to/repo
```

## Or run it fully offline, no GitHub fetch at all

```
git clone https://github.com/SynapticFour/vibecheck
cd vibecheck
make install
make scan path=/path/to/repo
```

(`make scan` with no `path=` defaults to the current directory.)

## Why local-first, not a web upload

This is a deliberate architecture choice, not just a policy: there is no server in the scan path, no upload step, no code transmitted anywhere. That's a structural guarantee, not a promise you have to trust — read `bin/scan.js` and the files in `src/checks/`, there's no `fetch`/`http` call anywhere near the scan logic. The only network-adjacent thing in this entire tool is an optional URL printed at the end, and only if you set `VIBECHECK_REPORT_URL` yourself.

Runtime dependencies: `jscpd` (literal clone detection) and `acorn` (JS parser for renamed-identifier clones), plus their own sub-dependencies — see `package-lock.json` for the full, exact tree.

If you want to verify this yourself: run it with your network disconnected. Nothing changes.

## What it checks (v1 — deliberately narrow)

1. **Secrets** — a lightweight built-in regex/pattern scanner (AWS keys, generic API key assignments, private key blocks, Slack/GitHub/Stripe tokens) across both your current working tree _and_ git history. The history check matters most: a key that was committed and later "removed" is usually still sitting in a prior commit.
2. **Duplicate code** — two layers, reported separately:
   - **Literal (type-1)** via [jscpd](https://github.com/kucherenko/jscpd): identical token sequences, i.e. straight copy-paste.
   - **Structural (type-2)** via an Acorn AST pass: same function shape after local identifiers are normalized to positional placeholders (`ID1`, `ID2`, …). This is the "AI wrote this function four times with slightly different names" signal, which token-literal matching cannot see.
3. **Commit churn** — counts how many of the last 100 commits look like fix/patch/revert commits. A wall of "fix", "fix again", "actually fix this time" is one of the most honest tells that something shipped before it was understood.
4. **Test presence** — binary check: does a test suite exist at all, does CI exist to run it. No attempt at measuring actual coverage % — that would need language-specific tooling this v1 deliberately skips.

Explicitly **not** attempted in v1: complexity analysis, dependency bloat, anything against a live URL that wasn't handed to the tool as a local path. Scanning someone else's deployed app without their consent is out of scope on principle, not just roadmap priority.

## Scoring

Starts at 100, deductions are printed in the report itself — see `src/score.js` for the exact formula. This is intentional: this audience (engineers) trusts a visible formula more than a polished but opaque score.

Current formula (subject to calibration as you run it against more real repos):

- up to −40 for secrets found (−15 per secret, capped)
- up to −25 for literal duplicate code (~1 point per 20 duplicated lines, capped)
- up to −25 for structurally similar (renamed) duplicate code (~1 point per 20 lines, capped)
- up to −20 for high fix-commit ratio (kicks in above 30% of recent commits)
- −15 for no test suite, additional −5 if tests exist but no CI runs them

**Known calibration note:** the duplicate-line count from jscpd can run higher than intuition suggests for small files (token-based clone matching counts differently than a human would eyeball it). The structural layer only flags exact matches after identifier normalization, so two unrelated functions of similar length are not treated as clones. Secrets and churn calibrated cleanly in testing.

## Local development

```
npm install
npm test
node bin/scan.js /path/to/any/repo
```

Or use the Makefile targets:

```
make install          # one-time: npm install
make scan path=...    # scan a repo (defaults to .)
make test-demo        # self-scan this repo
```

Optional: set `VIBECHECK_REPORT_URL` to print a "full report + fix roadmap" link at the end of a scan. If unset, the report ends without a call-to-action (no placeholder URL).

## Roadmap

- [ ] Single-binary builds (macOS/Linux/Windows) via Node's Single Executable Applications feature, built reproducibly in CI from tagged releases, with published SHA256 checksums so the binary can be verified against the source commit it was built from. Not started — worth doing once there's real usage, not before.

## License

MIT — see [LICENSE](LICENSE).
