# vibecheck

A local-first health scan for AI-generated ("vibe coded") codebases. Run it against your own repo, get a score and specific findings in your terminal, nothing leaves your machine.

```
npx vibecheck .          # scan current directory
npx vibecheck /path/to/repo
```

(Not published to npm yet — see "Publishing" below. Until then, run locally: `node bin/scan.js /path/to/repo`.)

## Why local-first, not a web upload

This is a deliberate architecture choice, not just a policy: there is no server in the scan path, no upload step, no code transmitted anywhere. That's a structural guarantee, not a promise you have to trust — read `bin/scan.js` and the four files in `src/checks/`, there's no `fetch`/`http` call anywhere near the scan logic. The only network-adjacent thing in this entire tool is a URL printed at the end, which you have to choose to open yourself.

If you want to verify this yourself: run it with your network disconnected. Nothing changes.

## What it checks (v1 — deliberately narrow)

1. **Secrets** — a lightweight built-in regex/pattern scanner (AWS keys, generic API key assignments, private key blocks, Slack/GitHub/Stripe tokens) across both your current working tree *and* git history. The history check matters most: a key that was committed and later "removed" is usually still sitting in a prior commit.
2. **Duplicate code** — via [jscpd](https://github.com/kucherenko/jscpd), the "AI wrote this function four times with slightly different names" signal.
3. **Commit churn** — counts how many of the last 100 commits look like fix/patch/revert commits. A wall of "fix", "fix again", "actually fix this time" is one of the most honest tells that something shipped before it was understood.
4. **Test presence** — binary check: does a test suite exist at all, does CI exist to run it. No attempt at measuring actual coverage % — that would need language-specific tooling this v1 deliberately skips.

Explicitly **not** attempted in v1: complexity analysis, dependency bloat, anything against a live URL that wasn't handed to the tool as a local path. Scanning someone else's deployed app without their consent is out of scope on principle, not just roadmap priority.

## Scoring

Starts at 100, deductions are printed in the report itself — see `src/score.js` for the exact formula. This is intentional: this audience (engineers) trusts a visible formula more than a polished but opaque score. Don't hide this behind a paywall even in future versions.

Current formula (subject to calibration as you run it against more real repos):
- up to −40 for secrets found (−15 per secret, capped)
- up to −25 for duplicate code (~1 point per 20 duplicated lines, capped)
- up to −20 for high fix-commit ratio (kicks in above 30% of recent commits)
- −15 for no test suite, additional −5 if tests exist but no CI runs them

**Known calibration gap from initial testing:** the duplicate-line count from jscpd can run higher than intuition suggests for small files (a 3-file, ~7-line-each duplicate test showed 418 "duplicate lines" — jscpd's token-based clone matching counts differently than a human would eyeball it). Worth running against 5-10 real repos before trusting the duplicate deduction weight; the secrets and churn checks calibrated cleanly in testing and are more trustworthy as-is.

## The funnel

At the end of every scan, the report prints one line pointing to a URL (`VIBECHECK_REPORT_URL` env var, currently a placeholder in `bin/scan.js` — **set this before shipping**) for "the full report + fix roadmap." Nothing is sent automatically — visiting that link is the explicit opt-in. What that page collects should be a small summary (score + finding counts), never code or secret values.

Suggested next step: route submissions from that page into the same SQLite ledger `lead-radar` already uses, as a new `source: "scanner-inbound"` — these are your highest-intent leads (self-selected), worth keeping in the same place you already check every morning rather than building a second system.

## Publishing to npm (so `npx vibecheck` works for real)

1. Pick a final name (check availability: `npm view <name>` should 404) — `vibecheck` is a placeholder, likely taken or too generic; a name in the "Slopfix" register probably serves you better for recognition in this niche.
2. `npm login`, then `npm publish` from this directory.
3. Set `VIBECHECK_REPORT_URL` to your real landing page before publishing.
4. Open-source the repo (public GitHub) before or at publish time — per the trust discussion, this is the single highest-leverage credibility move for this specific tool, more than any wording on a privacy page.

## Local development

```
npm install
node bin/scan.js /path/to/any/repo
```
