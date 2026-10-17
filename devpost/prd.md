---
doc: prd
status: approved
---
<!-- Learner = the autonomous Claude Code agent (learner-profile.md). The interview beats
     (journey, look, criteria, what-ifs, boundary) were answered by the builder from its own
     record in small batches, per its Collaboration preference; approved by the builder
     2026-10-17. -->

# Claim Check — Product Requirements

A one-page checker for a small-business owner who just got a "your website has problems"
email: paste it with your site address and see which claims are true, false, or uncheckable.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`.

1. Dana opens the page. She sees one heading ("Is that website email telling the truth?"),
   one sentence on what the tool does, and a form: a large box labelled "Paste the email",
   a box labelled "Your website address", and a **Check** button.
2. She pastes the whole email (greeting, signature and all) and types `danasplumbing.com`
   (with or without `https://`, `www.`).
3. She presses **Check**. The button reads "Checking your site..." and the form locks for
   the few seconds the fetch takes.
4. A results table appears under the form, titled "What the email claims, checked against
   danasplumbing.com just now". One row per claim found, in the order the email made them:
   - the claim in the email's own words (a short quote),
   - a verdict: **True**, **False**, or **Can't be checked from outside**,
   - one plain line of evidence ("Your home page title is 'Dana's Plumbing - Arlington'",
     "No mobile viewport line found in your page's code").
5. Under the table, a one-line tally ("2 true, 1 false, 3 can't be checked") and a short note:
   "True means the problem is real - it is still your choice who fixes it."
6. Success: she can tell, in under a minute, whether the email found a real fault. She can
   edit either box and press Check again; the table is replaced.

## Screens and Layout
One page, one column, centred, readable on a phone. Top to bottom: heading and one-line
explainer, the form, the results table (absent until the first check), a footer line
"Nothing you paste is stored." No other screens, no navigation.

## Look and Feel
Source: `scope.md > Inspiration & Identity`.
- A newspaper fact-check column, not a dashboard: serif headings, plain sans body, large
  type (body >= 18px), lots of white space, black on off-white.
- Verdicts as words first. Colour is a quiet accent only (a thin left rule: dark green True,
  dark red False, grey Can't be checked), never a red/green panic board; it must read the
  same in greyscale.
- No scores, gauges, percentages, icons of alarms or padlocks.
- Calm voice in every string: short sentences, no jargon ("page title", not `<title>`).

## Features and Behavior

### Finding the claims
- The tool reads the pasted text and picks out each sentence that makes a claim of a known
  type (`scope.md > The POC Boundary`): page title, meta description (search snippet),
  mobile viewport, https/secure padlock, tap-to-call phone link, image descriptions (alt
  text), broken links on the home page, slow / heavy page, and the uncheckable family
  (rankings, Google penalties, traffic, competitors, "hackers"/security, "losing customers").
- Greeting, signature, prices, opt-out lines and the sender's pitch are ignored - they are
  not claims about the site.
- Two sentences making the same claim become one row (first quote kept).
  - [ ] Pasting our real audit email (fixture A) yields exactly one row per numbered problem
    it lists, and no row for its price, address or opt-out line.
  - [ ] A line like "you're losing customers to competitors" yields a Can't-be-checked row.

### Checking the site
- The home page at the given address is fetched once per Check, following redirects; https
  is tried first.
- Each checkable claim is judged against that one fetch. Evidence quotes the page's own
  words (title text, description text, the link it found broken) or names what is missing.
- "Can't be checked from outside" carries a reason in plain words ("No outside tool can see
  your traffic - only your own analytics can").
  - [ ] Against a page that has a title, a "no title" claim reads **False** and quotes the title.
  - [ ] Against a page with no viewport line, a "not mobile-friendly" claim reads **True** and
    names the missing line.
  - [ ] Every row has exactly one of the three verdicts and one evidence line.

### The demo moment
Source: `scope.md > What "Working" Looks Like`. One of our own 301 audit emails, plus a
typical scare paragraph appended, pasted against a site that has changed since the email:
at least one False row with the real title quoted, one True row naming the missing viewport
line, and one Can't-be-checked row for the competitors line - visible in one screen.

## States and Boundaries
- **First use** — form only, empty boxes with short placeholder hints; no table.
- **Checking** — button disabled with "Checking your site..."; boxes locked.
- **No claims found** — "We couldn't find any claims about your website in this email. It
  may be a sales pitch with nothing specific to check." No table.
- **Only uncheckable claims** — table shows them all; the note adds: "This email makes no
  claim anyone could verify from outside your site."
- **Site can't be reached** (bad address, down, blocked, timeout ~10 s) — "We couldn't open
  danasplumbing.com just now (it didn't answer). Check the address and try again." Claims
  are still listed, each marked Can't be checked with "site didn't load" as the evidence.
- **Empty or missing box** — pressing Check with either box empty points at that box
  ("Paste the email first" / "Add your website address"). Nothing is fetched.
- **Not a website address** (e.g. an email address) — "That looks like an email address -
  type your website, like danasplumbing.com."
- **Persistence** — none. Reloading the page clears everything; nothing pasted is stored
  or logged.

## Product Decisions
- Verdict wording "Can't be checked from outside" rather than "Unknown" — it says why, and
  stops a vague scare looking like a fact.
- Claims listed in the email's order, not sorted by verdict — the owner is reading the email
  alongside; matching its order is easier than a re-sorted list.
- Unreachable site still lists the claims — the owner learns what the email asserted even
  when the check cannot run.
- No overall verdict on the email ("this is a scam") — the tool judges claims, not senders;
  an honest email with real faults should come out looking honest.
- Home page only — matches what these emails almost always point at, and keeps one fetch.

## What We're Building
The one page, the form, claim finding for the ~10 claim types above, one home-page fetch,
three verdicts with evidence, the tally line, every state listed above, and a demo using
fixture A (a real audit email of ours) with a scare paragraph appended.

## Deferred From the POC
- Claims about pages other than the home page ("your contact form is broken") — needs
  crawling; listed as Can't be checked for now.
- Phrasings the fixed library misses — would need AI claim extraction; deferred to keep the
  POC keyless.
- A "reply to the sender" summary to copy — nice, not needed to prove the kernel.

## Possible Later Enhancements
- AI-assisted claim extraction for unusual wording, with the fixed library as the backstop.
- Checking any page the email names, not just the home page.
- A printable one-page result for the owner to forward.

## Non-Goals
- Accounts, saved history, storing pasted email — it is the owner's private mail.
- Offering or selling fixes — would recreate the conflict of interest the tool removes.
- An overall site score — a score is the scare device the kernel argues against.
- Judging whether the sender is a scammer — out of reach and unfair to honest senders.

## Open Questions
- Exact timeout and redirect limit — `4-spec` (implementation detail, not product).
- Which real site fixture A is checked against in the demo video — pick in `5-build` from a
  site that has since fixed its title; can wait.
