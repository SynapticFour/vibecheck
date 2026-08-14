# Internal notes

Not part of the public pitch. Product/GTM scratchpad for maintainers — do not treat this as user documentation.

**Maintenance budget:** fenced satellite — monthly CI/audit hygiene only (Synaptic Four org fencing).

## Funnel

At the end of a scan, the report prints a call-to-action **only if** `VIBECHECK_REPORT_URL` is set. If it isn't, the CLI prints a muted "no report URL configured" note instead of a placeholder link.

Nothing is sent automatically — visiting that link is the explicit opt-in. What that page collects should be a small summary (score + finding counts), never code or secret values.

Suggested next step: route submissions from that page into the same SQLite ledger `lead-radar` already uses, as a new `source: "scanner-inbound"` — these are the highest-intent leads (self-selected), worth keeping in the same place that's already checked every morning rather than building a second system.

## Publishing to npm (so `npx vibecheck` works for real)

1. Pick a final name (check availability: `npm view <name>` should 404) — `vibecheck` is a placeholder, likely taken or too generic; a name in the "Slopfix" register probably serves better for recognition in this niche.
2. `npm login`, then `npm publish` from this directory.
3. Set `VIBECHECK_REPORT_URL` to the real landing page before publishing (or document it as an optional env var and leave it unset in the published package).
4. Open-source the repo (public GitHub) before or at publish time — this is the single highest-leverage credibility move for this specific tool, more than any wording on a privacy page.

## Naming

`vibecheck` is the working name. Check the npm registry and GitHub before treating it as final.
