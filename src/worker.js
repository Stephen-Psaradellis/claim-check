import { findClaims } from "./claims.js";
import { CLAIM_TYPES } from "./claim-types.js";
import { PAGE } from "./page.js";
import { fetchSite, normaliseSite } from "./fetch-site.js";
import { judge } from "./judge.js";

const MAX_EMAIL = 20000;
const REASONS = Object.fromEntries(CLAIM_TYPES.map((t) => [t.type, t.reason]));
const LABELS = Object.fromEntries(CLAIM_TYPES.map((t) => [t.type, t.label]));

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function check({ email, site }, fetchImpl = fetch) {
  const claims = findClaims(email);
  const shown = normaliseSite(site) || site;
  if (!claims.length) {
    return { site: shown, fetched: null, rows: [], tally: { true: 0, false: 0, unverifiable: 0 },
      notes: ["We couldn't find any claims about your website in this email. It may be a sales pitch with nothing specific to check."] };
  }
  // Fetch only when some claim can be checked from the page at all.
  const needsSite = claims.some((c) => !REASONS[c.type]);
  const fetched = needsSite ? await fetchSite(site, fetchImpl) : null;
  const rows = [];
  for (const c of claims) {
    rows.push({ ...c, label: LABELS[c.type], ...(await judge(c, fetched, fetchImpl)) });
  }
  const tally = { true: 0, false: 0, unverifiable: 0 };
  for (const r of rows) tally[r.verdict]++;
  const notes = [];
  if (fetched && !fetched.ok) {
    notes.push(`We couldn't open ${shown} just now (${fetched.reason}). Check the address and try again.`);
  }
  if (tally.unverifiable === rows.length && (!fetched || fetched.ok)) {
    notes.push("This email makes no claim anyone could verify from outside your site.");
  }
  if (tally.true) notes.push("True means the problem the email describes is really on your page - worth fixing, whoever you ask.");
  const { html, ...fetchedMeta } = fetched || {};
  return { site: shown, fetched: fetched ? fetchedMeta : null, rows, tally, notes };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (url.pathname === "/check" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { body = null; }
      // The email is never logged or stored; it lives only for this request.
      if (!body || typeof body.email !== "string" || typeof body.site !== "string") {
        return json({ error: "Send the email text and your website address." }, 400);
      }
      if (body.email.length > MAX_EMAIL) {
        return json({ error: "That email is too long to check - paste just the message." }, 400);
      }
      if (!body.email.trim() || !body.site.trim()) {
        return json({ error: "Paste the email and add your website address." }, 400);
      }
      if (body.site.includes("@")) {
        return json({ error: "That looks like an email address - type your website, like danasplumbing.com." }, 400);
      }
      if (!normaliseSite(body.site)) {
        return json({ error: "That doesn't look like a website address - type it like danasplumbing.com." }, 400);
      }
      return json(await check({ email: body.email, site: body.site.trim() }));
    }
    return new Response("Not found", { status: 404 });
  },
};
