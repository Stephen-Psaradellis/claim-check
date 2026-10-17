---
doc: checklist
status: approved
---
<!-- Learner = the autonomous Claude Code agent (learner-profile.md: every decision delegated).
     Gut check answered by the builder from its own record: order approved 2026-10-17. -->

# Build Checklist

Build mode: fast (the learner is the builder; hands-on checkpoints are run by the builder in a real browser)

## Slices

- [x] **1. You can paste an audit email and see its claims listed**
  Becomes usable: A running page at localhost:8787 where pasting fixture A and pressing Check lists one row per claim, in the email's order, with greetings, the price, the address and the opt-out line ignored. Verdicts read "Can't be checked" until slice 2.
  Why now: The claim finder is the unique kernel and the spec's named uncertainty (sentence split vs missing phrasing); the fixture A test is written before the splitter so the split rule is fitted to a real email. Scaffold rides along.
  PRD ref: `prd.md > The Core Journey` (steps 1-3), `prd.md > Finding the claims`
  Spec ref: `spec.md > Components` (Worker router, Page, Claim finder, Claim library), `spec.md > File Structure`
  Build: package.json, wrangler.toml, fixtures/audit-email-a.txt (one of our real audit emails, business and sender anonymised, plus a labelled scare paragraph), test/claims.test.js first, then src/claim-types.js, src/claims.js, src/worker.js (GET / and POST /check, validation, no logging), src/page.js (form, Checking state, table drawn with textContent).
  Verify (mechanical): `node --test` passes claims.test.js; `npx wrangler@4 dev` starts; a POST /check with fixture A returns the expected rows; GET / returns the page.
  Learner check: Open http://localhost:8787, paste fixture A, type any address, press Check, and see one row per numbered problem plus the scare claims, nothing for the price or signature.
  Commit: `Claim Check: find and list the claims in a pasted email`

- [x] **2. Each claim gets a verdict from the real site**
  Becomes usable: The rows say True, False or Can't be checked, each with a line quoting what the home page actually contains; a tally line sums them.
  Why now: Judging is the other half of the kernel and the first contact with real sites (bot walls, redirects, odd markup), so risk arrives before polish.
  PRD ref: `prd.md > Checking the site`, `prd.md > The demo moment`
  Spec ref: `spec.md > Components` (Site fetcher, Claim judge, Result shaper), `spec.md > Data Model`
  Build: src/fetch-site.js (normalise, https first then http once, manual redirects limit 5, 10 s timeout, 2 MB cap, browser User-Agent), src/judge.js (title, description, viewport, https, phone_link, alt_text, heavy_page, uncheckable family, site-didn't-load), fixtures/pages/*.html, test/judge.test.js, tally + notes in the worker.
  Verify (mechanical): `node --test` passes judge.test.js against the sample pages; a live POST /check against a real site returns verdicts whose evidence matches that site's source.
  Learner check: Check fixture A against a real site and compare two verdicts with the site's page source.
  Commit: `Claim Check: judge each claim against one fetch of the home page`

- [x] **3. Broken links and every awkward state behave**
  Becomes usable: Broken-link claims are checked (up to 10 links); empty boxes, an email address typed as the site, no claims found, only uncheckable claims, and a site that won't open each show their calm message; the table stacks into cards on a phone.
  Why now: These are the states a judge will poke at first; they need the full pipeline from slices 1-2 to exist.
  PRD ref: `prd.md > States and Boundaries`, `prd.md > Screens and Layout`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Claim judge` (broken_links), `spec.md > Page`, `spec.md > Look and Feel`, `spec.md > Important Failure Modes`
  Build: broken_links check (HEAD, GET on 405, 5 s each, parallel, cap stated), client-side states, phone CSS, test/worker.test.js end to end with a stubbed fetch covering every state.
  Verify (mechanical): `node --test` passes all three test files; the page at 375 px width shows stacked cards.
  Learner check: Try an empty form, an email address as the site, a greeting-only email, and an address that does not exist.
  Commit: `Claim Check: broken links, every edge state, phone layout`

- [x] **4. Someone else can run it**
  Becomes usable: README (what it is, how to run, known limits, AI disclosure) and an MIT LICENSE; the demo site for the video is picked.
  Why now: Needed before 6-ship's public repo; nothing in it changes behaviour.
  PRD ref: `prd.md > Open Questions` (demo site)
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Decisions and Open Issues`
  Build: README.md, LICENSE, demo site chosen and recorded under Revisions.
  Verify (mechanical): a fresh shell following only the README starts the app and the tests pass.
  Learner check: Read the README cold and run it.
  Commit: `Claim Check: README, licence, demo site`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 2, fixture A against a real site in a browser (builder, 10-17: a real small-business site, the real recipient of fixture A (not named here); 3 true / 3 false / 4 uncheckable, each verdict matched against `curl` of the page source; Checking state and path-trimming seen in the page. Feedback: none blocking; broken links still say "isn't checked yet" until slice 3)
- [x] Final kick-the-tires exploration and feedback completed (builder, 10-17 10:3xZ, autonomous session: ran the app on :8791 and tried awkward inputs - empty boxes, a pure greeting, a URL with path and query, a loopback address, a 60k-char email, an unknown host, non-JSON, an unknown route. All behaved per the PRD except two gaps: 'your site is down / not loading' and 'no H1' produced no row at all)

## Final Review

- [x] Add a 'Site is down' claim (checked from the one fetch: loaded = False, didn't load = True with the reason) - tests in claims/judge, seen in the browser against example.com
- [x] Add a 'Main heading (H1)' claim (first `<h1>`, text quoted) - tests in claims/judge, seen in the browser (example.com has no H1 today, so True)
- [x] Final review complete — feedback resolved and learner confirms ready to ship (29/29 tests; the builder is an autonomous agent session, so 'confirms' is the builder's own sign-off; the human enters the PoC at 6-ship)

## Code Tour and App Map

- [x] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [x] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: prior practice connected - the final review's awkward-input run found two missing claim types; each fix stayed one library entry + one check + tests, which is the scope-holding practice the profile asked for (no LLM layer added).
Route and stops: reference route only (not toured interactively): worker.js check -> claim-types.js CLAIM_TYPES -> judge.js CHECKS/judge.
Edit outcome: not applicable (no separate learner edit; the two claim types are the kept changes).
Reflection: not applicable - autonomous builder session, nobody to ask.
Activity mode: focused alternative (plan-first builder).

## Revisions

- Claim finder tests each clause, not each sentence — fixture A's scare line "It takes forever to load, it has broken links, and your page title is missing" packs three claims into one sentence, and first-match-per-sentence kept only the title (the spec's named split-vs-library uncertainty: it was the split).
- Added a checkable `version` claim type (WordPress version on show in the page code) — fixture A's third numbered problem is this claim, and the spec's type list had no row for it; filing it under "security" would have called a checkable claim uncheckable.
- Per-type checks live in `src/judge.js` keyed by type rather than as a `check` field in the library — keeps `claim-types.js` pure data (phrasings and reasons) so adding a phrasing never touches code.
- Dev server for the builder's browser runs on port 8791 (`npx wrangler@4 dev --port 8791`); 8787 is taken by another project on this machine. The README keeps the default 8787.
- Version check reads WordPress core files only (`wp-includes/...?ver=`) besides the generator tag — theme and plugin files carry their own version numbers, which would have made a "WordPress version" claim true on the wrong evidence.
- Link checks ask again with GET on 403 and 501 as well as 405 — some hosts refuse HEAD from scripts with 403, which would have called a working link broken. A link that never answers counts as broken ("no answer").
- `www.` and the bare domain count as the same site for link checks; links to the home page itself, hashes, mailto, tel and other sites are skipped.
- A website box that is not a host at all gets its own 400 ("doesn't look like a website address"), alongside the PRD's email-address message — otherwise it reached the fetcher and read as "couldn't open".
- "X and no Y" now splits into two claims (the clause split also breaks before "and no / missing / broken / slow / several / many / some") — found in the slice 3 browser check, where "broken links and no page title" gave one row.
- A new submit hides the previous result first, so a validation message never sits above a stale table.
- The site is fetched only when at least one claim can be checked from the page — an email of pure scare claims needs no download, and the "no claim anyone could verify" note then stands alone.
- Demo site for the video is `example.com`, not a since-fixed client site: the PRD wanted a real site that fixed its title, but the real recipient of fixture A is a small business, and a public video would tie them to an audit email. `example.com` is reserved for examples (RFC 2606), so nobody is named, and against fixture A it gives an honest mix: 1 True (no search description), 5 False, 4 Can't be checked. Checked live 10-17.
- README verified cold: a fresh copy of only src/, test/, fixtures/, package.json, wrangler.toml, README and LICENSE passed 26/26 tests and served GET / and POST /check from `npx wrangler@4 dev`.
- Two claim types added in the final review: `down` (site is down / offline / not loading / won't load - judged from the one fetch, one check not a record of outages) and `heading` (no H1 / main heading). Both are common cold-email scare lines that gave no row at all before; README's table now lists them.
