---
doc: scope
status: approved
---
<!-- Learner = the autonomous Claude Code agent (see learner-profile.md: every product and
     technical decision is delegated to it). The interview beats below were answered by the
     builder from its own record; approved by the builder 2026-10-17 per the profile. -->

# Claim Check

Paste the "your website has problems" email you just got, plus your site address; see which
of its claims are true, which are false, and which nobody could check from outside.

## The Unique Kernel
The checker belongs to the person being pitched, not the person pitching. Every audit tool
helps the seller find faults; this one takes the seller's own email apart, claim by claim,
against the live site - so a vague scare ("your site is losing you customers") and a real,
checkable fault ("your homepage has no title") stop looking the same.

## Who It's For
Dana, who runs a two-van plumbing business. Two or three of these emails arrive a week. She
cannot tell which, if any, are real, so she either ignores all of them (and misses the one
real problem) or pays someone who invented it. Today she forwards them to a nephew, or deletes.

## The Core Loop
She opens the page, pastes the email, types her site address, presses Check. A list comes back:
one row per claim the email made, each marked **True**, **False** or **Can't be checked from
outside**, with one plain-English line of evidence (what the page actually says). She comes
back the next time one of these emails lands.

## Inspiration & Identity
Plain, calm, receipt-like: a fact-check table, not a dashboard. Large type, no jargon, no
colour-coded panic. Feels like a neighbour who knows websites reading the email over her
shoulder. Reference: the "true / false / unproven" rows of a newspaper fact-check column.

## Why This Matters to the Learner
Our own record: 301 audit emails to owners, 1 reply, 0 sales. Owners have learned, rightly,
that most of these emails are boilerplate. Building the owner's side of that exchange is the
honest response - and practising this pack's plan-first sequence keeps the agent from
over-building, which is its known habit.

## What "Working" Looks Like
A real audit email (ours, from the 301) pasted against the real site it was about: the email's
"missing page title" claim comes back False with the actual title quoted, its "not
mobile-friendly" claim comes back True with the missing viewport tag named, and its "you're
losing customers to competitors" line comes back "Can't be checked from outside - no tool can
see that without your analytics". That three-row moment is the demo.

## The POC Boundary
- One page, one form (email text + URL), one results table.
- A fixed library of the ~10 claim types these emails actually make, matched by phrasing:
  page title, meta description, mobile viewport, https, tap-to-call phone link, image alt
  text, broken links on the homepage, page size/speed (rough), plus "unverifiable" patterns
  (rankings, penalties, traffic, competitors, "hackers").
- Server side fetches the homepage once and runs the matching checks; evidence quoted from
  the fetched HTML.
- Runs as one Cloudflare Worker (page + `/check`), demoable under `wrangler dev`; no keys.

## Later
- LLM claim extraction for phrasings the pattern library misses (Workers AI, no shipped key).
- Checking pages beyond the homepage; a printable "reply to the sender" summary.
- Saved history of emails checked.

## Explicitly Cut
- Accounts, logins, storage of pasted emails - privacy: the email is the owner's mail, keep nothing.
- Fixing anything - the tool tells the truth about claims; selling fixes would recreate the
  conflict of interest it exists to remove.
- Scoring the site overall - a score is exactly the scare device the kernel argues against.
