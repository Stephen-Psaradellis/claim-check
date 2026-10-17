---
doc: spec
status: approved
---
<!-- Learner = the autonomous Claude Code agent (learner-profile.md: every product and
     technical decision is delegated to it). The interview beats (preferences, where it runs,
     architecture per PRD heading, simplify) were answered by the builder from its own record
     in one small batch, per its Collaboration preference; approved by the builder 2026-10-17. -->

# Claim Check — Technical Spec

## How This Works, In Plain Language
Claim Check is one small program that lives on Cloudflare's network (a "Worker"). It does
two jobs. When you open its address it hands your browser the page: a heading, two boxes and
a Check button. When you press Check, the page sends the email text and your site address
back to the same program, which does three things in order:

1. **Finds the claims.** It splits the email into sentences and compares each one against a
   short, fixed list of the ways these emails phrase their claims ("no page title", "not
   mobile-friendly", "losing customers to competitors"...). Anything that matches becomes a
   row; greetings, prices and signatures match nothing, so they drop out.
2. **Looks at your site once.** It downloads your home page, exactly as a visitor's browser
   would, and reads the page's own code.
3. **Judges each claim** against that one download: True, False, or Can't be checked from
   outside, with one line quoting what the page actually says.

The answer goes back to the page, which draws the table. Nothing is saved anywhere - the
email exists only for the second the check takes.

Why this shape: one program, one file of rules, no database, no accounts and no AI key means
there is one thing to run, one thing to record for the video, and nothing private to leak.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. Dana opens the address -> the Worker answers `GET /` with the page (HTML, CSS and a
   little script, all in one response).
2. She pastes the email and types `danasplumbing.com` -> the page's script checks both boxes
   are filled and the address is not an email address (`prd.md > States and Boundaries`);
   if not, it shows the pointer message and sends nothing.
3. She presses **Check** -> the script locks the form ("Checking your site...") and sends
   `POST /check` with `{ email, site }` as JSON.
4. The Worker runs **Claim finder** on the email -> an ordered list of claims, duplicates
   merged.
5. The Worker runs **Site fetcher** on the address -> the home page's HTML, its final address
   after redirects, its size and how long it took - or "didn't load" with a reason.
6. The Worker runs **Claim judge** on each claim against that fetch -> verdict + evidence.
   Broken-link claims make up to 10 quick extra requests (HEAD) for links on the page.
7. The Worker answers with `{ site, fetched, rows, tally, notes }` -> the script unlocks the
   form and draws the table, the tally line and the note. Pressing Check again replaces it.

## Stack
- **JavaScript (ES modules), no framework, no build step.** The builder writes plain JS and
  Workers daily; a framework would add nothing to a one-page form.
- **Cloudflare Workers** runtime, run locally with **Wrangler 4** (`npx wrangler@4 dev`).
  Docs: https://developers.cloudflare.com/workers/ , https://developers.cloudflare.com/workers/wrangler/
- **HTML parsing by regular expressions over the fetched text**, not a DOM library: the
  checks read a handful of tags (`title`, `meta`, `a`, `img`), which regexes handle for a
  POC and which keeps zero dependencies. Tradeoff accepted: odd markup (a title split by a
  comment) can be misread; the evidence line quotes what was read, so a misread is visible.
- **Tests: Node's built-in test runner** (`node --test`, Node 20+). Docs:
  https://nodejs.org/api/test.html
- Nothing unverified: the builder has run this exact toolchain in this repo.

## Where It Runs and How Someone Tries It
- Needs Node 20+ and nothing else; no API keys, no account for local use.
- Start: `cd products/learn-ai-basics && npx wrangler@4 dev` -> open http://localhost:8787
- Tests: `node --test` in the same folder.
- Demo recording (`6-ship`): the local page in a browser, pasting `fixtures/audit-email-a.txt`
  (fixture A) against the site chosen in `5-build`.
- Optional deploy (decided: yes, after the build works, because a judge can then try it):
  `npx wrangler@4 deploy` to `claim-check.<account>.workers.dev`. The video and the public
  GitHub repo stay the submission; the link is a bonus.

## Look and Feel
From `prd.md > Look and Feel`, as CSS in the page:
- Background `#faf8f3` (off-white), text `#1a1a1a`. Max width 680px, centred, generous
  margins; body 18px+ system sans (`system-ui`), headings in a serif stack
  (`Georgia, "Times New Roman", serif`). No web fonts (works offline, nothing to load).
- Results as a real `<table>`: claim quote in italics, verdict as a bold word, evidence in
  plain text. Each row has a 4px left rule: `#1f5f3a` True, `#8a1c1c` False, `#888` Can't be
  checked. Verdict words carry the meaning; colour only repeats it (greyscale-safe).
- No icons, scores, percentages or gauges. Copy in short calm sentences, no tag names.
- On a phone (< 600px) the table becomes stacked cards: quote, verdict, evidence.

## Components

### Worker router (`src/worker.js`)
Answers `GET /` with the page and `POST /check` with JSON; anything else is 404. Validates
the body (both fields strings, email <= 20,000 chars) and returns 400 with a plain message
otherwise. Never logs or stores the body.
PRD ref: `prd.md > The Core Journey`, `prd.md > States and Boundaries` (Persistence).

### Page (`src/page.js`)
Exports the page as one HTML string (inline CSS + inline script). The script owns the
client-side states: empty boxes, email-address-as-site, Checking (form locked), and drawing
the result, the "no claims" message, the "only uncheckable" note and the "couldn't open"
message. Text is inserted with `textContent`, never as HTML (the email is untrusted).
PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`, `prd.md > States and Boundaries`.

### Claim finder (`src/claims.js`)
`findClaims(emailText) -> [{ type, quote }]`. Splits into sentences (also on line breaks and
list markers, since audit emails use numbered lists), drops lines that look like greeting,
signature, price (`$`), unsubscribe/opt-out or postal address, then tests each sentence
against `CLAIM_TYPES` in order; first match wins for that sentence. Keeps the first quote per
type (merging duplicates) and the email's order. Quote trimmed to ~140 chars.
PRD ref: `prd.md > Finding the claims`.

### Claim library (`src/claim-types.js`)
The fixed list, one entry per type: `{ type, patterns: [RegExp], check }`. Types:
`title`, `description`, `viewport`, `https`, `phone_link`, `alt_text`, `broken_links`,
`heavy_page`, and the uncheckable family `rankings`, `penalty`, `traffic`, `competitors`,
`security`, `losing_customers`, each with its plain-words reason. This file is the only place
phrasings live, so adding one is a one-line change.
PRD ref: `prd.md > Finding the claims`, `prd.md > Product Decisions`.

### Site fetcher (`src/fetch-site.js`)
`fetchSite(site) -> { ok, url, finalUrl, html, bytes, ms, reason }`. Normalises the address
(adds `https://`, strips paths to the home page), GETs with a browser-like User-Agent,
follows redirects by hand (`redirect: "manual"`, limit 5, so the final address is known),
10 s timeout via `AbortSignal.timeout`. If https fails to connect, tries
`http://` once and records that for the `https` claim. Reads at most 2 MB of body.
PRD ref: `prd.md > Checking the site`.

### Claim judge (`src/judge.js`)
`judge(claim, site) -> { verdict, evidence }`, using the claim type's `check`. Rules:
- `title`: False if a non-empty `<title>` exists (quote it), True if absent/empty.
- `description`: False if `meta name=description` has content (quote first ~100 chars), else True.
- `viewport`: False if `meta name=viewport` present (quote content), else True ("No mobile
  viewport line found in your page's code").
- `https`: False if the final address is https and loaded; True if only http loaded or
  https redirected to http.
- `phone_link`: False if any `href="tel:` exists (quote the number), else True.
- `alt_text`: count `<img>` without a non-empty `alt`; True if any ("4 of 9 images have no
  description"), False if none, Can't be checked if the page has no images.
- `broken_links`: HEAD (GET fallback on 405) up to 10 same-site links, 5 s each, in
  parallel; True if any return 4xx/5xx (name the first), False if all load. "Checked 10 of
  37 links" stated when capped.
- `heavy_page`: True if HTML > 1 MB or the fetch took > 5 s, False under both, evidence
  gives the measured size and time; said plainly to be a rough check of the page's code only.
- Uncheckable types: always Can't be checked, evidence = the type's reason.
- Any claim when the site didn't load: Can't be checked, "site didn't load".
PRD ref: `prd.md > Checking the site`, `prd.md > The demo moment`.

### Result shaper (inside `src/worker.js`)
Builds `{ site, fetched, rows, tally, notes }`: tally counts per verdict, and the notes
(the standing "True means the problem is real" line, the "no claim anyone could verify"
line when every row is uncheckable, the "couldn't open" line when the fetch failed).
PRD ref: `prd.md > The Core Journey` steps 4-5, `prd.md > States and Boundaries`.

## Data Model
No stored data. Two shapes in flight, both discarded when the request ends:
- Request: `{ email: string, site: string }`.
- Response: `{ site: "danasplumbing.com", fetched: { ok, finalUrl, ms, bytes, reason },
  rows: [{ type, quote, verdict: "true"|"false"|"unverifiable", evidence }],
  tally: { true, false, unverifiable }, notes: [string] }`.
Leaving and coming back: a reload shows the empty form; nothing is remembered (by design).

## File Structure
```
learn-ai-basics/
├── src/
│   ├── worker.js         # router + result shaper; GET / and POST /check
│   ├── page.js           # the one page: HTML, CSS, client script, as a string
│   ├── claims.js         # findClaims: sentence split, noise filter, match, dedupe
│   ├── claim-types.js    # the fixed claim library: patterns, check, uncheckable reasons
│   ├── fetch-site.js     # fetchSite: normalise, https-first, redirects, timeout, size cap
│   └── judge.js          # judge: one verdict + evidence per claim
├── test/
│   ├── claims.test.js    # fixture A rows, noise ignored, dedupe, competitors -> uncheckable
│   ├── judge.test.js     # verdict rules against small saved HTML strings
│   └── worker.test.js    # /check end to end with a stubbed fetch; every state
├── fixtures/
│   ├── audit-email-a.txt # one of our real audit emails + an appended scare paragraph (labelled)
│   └── pages/*.html      # small sample home pages for judge tests (labelled sample data)
├── wrangler.toml         # name = "claim-check", main = "src/worker.js"
├── package.json          # "type": "module", scripts: dev, test
├── LICENSE               # MIT
├── README.md             # what it is, how to run, AI disclosure
├── devpost/              # Devpost learning workspace (this file, prd, scope, checklist)
└── agent/ .claude/       # the installed skill pack (not app code)
```

## External Services and Dependencies
- **Cloudflare Workers / Wrangler** - local dev needs no account; deploy needs the builder's
  existing Cloudflare login (already used by `products/sitecheck`). Free plan: 100k
  requests/day, 50 subrequests per request (we use at most 11). Docs above.
- **The owner's own website** - `GET <home page>` plus up to 10 `HEAD` on its links. No key,
  no third-party API.
- Nothing else: no AI model, no database, no analytics.

## Important Failure Modes
- **The site blocks or times out the fetch** (bot walls, slow hosts) -> "We couldn't open
  danasplumbing.com just now (it didn't answer)...", every claim listed as Can't be checked
  with "site didn't load". Owner still sees what the email asserted.
- **An email phrases a claim the library doesn't know** -> no row for it. If nothing matched:
  the "no claims found" message. Accepted POC limit (`prd.md > Deferred From the POC`); the
  library grows from real emails, one pattern at a time.
- **Pages built entirely by JavaScript** (title set by script) -> the downloaded code may lack
  a title the browser shows. Evidence quotes exactly what the code contained, so a wrong True
  is checkable by the owner; noted in the README as a known limit.

## What Was Simplified and Why
- **Regex reading of a few tags** instead of a full HTML parser - zero dependencies for five
  tag types. The fuller version would bundle an HTML parser (e.g. HTMLRewriter streaming).
- **Fixed phrasing library** instead of AI extraction - keeps it keyless and every row
  explainable. The fuller version adds a Workers AI pass with the library as backstop.
- **Home page only, 10 links capped** instead of crawling - one fetch, one demo, inside the
  free plan's subrequest limit.
- **"Heavy page" = size and time of the code download** instead of a real speed test - honest
  as a rough check; a real one needs a browser (Lighthouse), out of scope.

## Decisions and Open Issues
Decisions (the learner's, per its delegation):
- One Worker serving page + `/check`; local `wrangler dev` for the video; deploy afterwards.
- No framework, no dependencies, Node test runner.
- Timeout 10 s, redirect limit 5, body cap 2 MB, 10 link checks (closes the PRD open
  question on timeout and redirect limit).
- New code written in this folder during the hackathon period. The builder's older
  `products/sitecheck` scanner is not copied in - the rules ask for a new project - though
  its lessons (browser-like User-Agent, HEAD-then-GET for links) inform this one.

Learner uncertainty: **where the line between "the email is sentence-split wrong" and "the
library missed a phrasing" falls** - fixture A uses a numbered list with claims spread over
two lines. Agreed small investigation in `5-build`: the first test runs fixture A through
`findClaims` and the expected rows (one per numbered problem, none for price/address/opt-out)
are written before the splitter, so the split rule is fitted to a real email, not guessed.

Still open:
- Which real site fixture A is checked against in the video (`prd.md > Open Questions`) -
  pick in `5-build` from a site that has since fixed its title.
