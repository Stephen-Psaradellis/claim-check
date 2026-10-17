# Claim Check

Small business owners get a lot of cold email that says their website is broken.
Some of it is true. A lot of it is a sales pitch that sounds alarming and cannot be
checked. Claim Check sorts it out for you.

Paste the email and type your website address. Claim Check lists every claim the
email makes, in the email's order, then looks at your home page once and gives each
claim one of three verdicts:

- **True** - your page really has this problem, with the line that shows it.
- **False** - your page does not have this problem, with the line that shows it.
- **Can't be checked** - nobody can see this from outside your site (rankings, a
  Google penalty, visitor numbers, competitors, hackers), so the email cannot
  have seen it either.

It does not store or log what you paste, and it never sends anything to anyone.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer. Nothing else: no API keys, no
account, no packages to install.

```bash
npx wrangler@4 dev
```

Then open http://localhost:8787. The first run downloads Wrangler (Cloudflare's local
Workers runner) through `npx`. If port 8787 is busy, add `--port 8791` and open that
port instead.

To try it straight away, paste the sample email in `fixtures/audit-email-a.txt` and
check it against `example.com`.

## Run the tests

```bash
node --test
```

The tests run the claim finder on the sample email, judge sample pages in
`fixtures/pages/`, and drive the whole app with a stubbed network, so they need no
internet connection.

## What it checks

| Claim in the email | How it is judged |
|---|---|
| Page title missing | the page's `<title>` |
| No main heading (H1) | the page's first `<h1>` |
| No search description | the `description` meta tag |
| Not mobile friendly | the `viewport` meta tag |
| Not secure / no padlock | whether the site loads over https |
| No tap-to-call number | `tel:` links |
| Images missing descriptions | `alt` on the page's images |
| Broken links | up to 10 links to your own pages |
| Site is down / not loading | whether the home page loads right now (one check, not past outages) |
| Slow or heavy page | the home page's size and download time |
| Old software version on show | the WordPress generator tag and core file versions |
| Rankings, penalties, traffic, competitors, hackers, losing customers | Can't be checked from outside the site |

## Known limits

- It reads your **home page only**, once. A problem on another page will not show.
- It reads the page's code as it arrives. A site that builds its page with
  JavaScript in the browser may look emptier than it is.
- Some sites block automated visitors. Claim Check then says it couldn't open the
  site rather than guessing.
- "Slow" is a rough check of size and download time from where Claim Check runs, not
  a full speed test.
- It finds claims by their wording. A claim phrased in a way it has not seen is
  left out, not guessed at; the claim list lives in `src/claim-types.js`.

## How it is built

One Cloudflare Worker with no dependencies. `GET /` serves the page and
`POST /check` returns the verdicts as JSON.

- `src/claims.js` and `src/claim-types.js` - split the email into clauses and match
  each against the claim library.
- `src/fetch-site.js` - fetch the home page (https first, 10 s timeout, at most 5
  redirects, 2 MB cap).
- `src/judge.js` - one check per claim type, each returning a verdict and the evidence.
- `src/page.js` - the page, plain HTML and CSS; results are drawn with `textContent`.
- `src/worker.js` - the router and input checks.

The design notes are in `devpost/`: `scope.md`, `prd.md`, `spec.md` and
`checklist.md`.

## Made with AI

Claim Check was written by Claude Code (Anthropic's AI coding agent), working
through the [Devpost Learn "AI Basics" skill pack](https://github.com/challengepost/learn-ai-basics)
for the Build With AI: Basics hackathon. The idea comes from our own record: we
sent a few hundred cold website-audit emails ourselves, and the honest lesson was
that owners have no quick way to tell a real problem from a scare line.

The verdicts come from fixed checks on your page's code, not from an AI model, so
the same page always gets the same answer.

## Licence

MIT - see `LICENSE`.
