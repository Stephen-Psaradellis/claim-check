import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { check } from "../src/worker.js";

// /check end to end with a stubbed fetch: no network, every state the page can show.
const emailA = readFileSync(new URL("../fixtures/audit-email-a.txt", import.meta.url), "utf8");
const HOME = `<html><head><title>Dana's Plumbing</title></head><body>
<a href="/services">Services</a> <a href="/contact#form">Contact</a> <a href="/old-page">Old</a>
<a href="https://www.danasplumbing.com/about">About</a> <a href="https://facebook.com/x">FB</a>
<a href="mailto:dana@example.com">Mail</a> <a href="tel:5551234">Call</a> <a href="#top">Top</a>
</body></html>`;

// A pretend internet: the home page, then a status per path for the link checks.
function stubNet({ home = HOME, paths = {}, down = false, headStatus } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || "GET" });
    if (down) throw new TypeError("fetch failed");
    const u = new URL(url);
    if (u.pathname === "/") return new Response(home, { status: 200, headers: { "content-type": "text/html" } });
    const status = paths[u.pathname] ?? 200;
    if ((opts.method || "GET") === "HEAD" && headStatus) return new Response(null, { status: headStatus });
    return new Response(opts.method === "HEAD" ? null : "ok", { status });
  };
  return { fetchImpl, calls };
}

const post = (body) => worker.fetch(new Request("http://x/check", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

test("an empty box points at that box and fetches nothing", async () => {
  for (const body of [{ email: "", site: "dana.com" }, { email: "x", site: "  " }, { email: 1, site: "a" }]) {
    const res = await post(body);
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /email|website/i);
  }
});

test("an email address typed as the site gets the 'that looks like an email' message", async () => {
  const res = await post({ email: emailA, site: "dana@danasplumbing.com" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error,
    "That looks like an email address - type your website, like danasplumbing.com.");
  const bad = await post({ email: emailA, site: "not a site" });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /doesn't look like a website address/);
});

test("a greeting-only email finds no claims and fetches nothing", async () => {
  const net = stubNet();
  const out = await check({ email: "Hi Dana,\n\nHope you're well!\n\nBest,\nSam", site: "danasplumbing.com" }, net.fetchImpl);
  assert.deepEqual(out.rows, []);
  assert.match(out.notes[0], /couldn't find any claims/);
  assert.equal(net.calls.length, 0);
});

test("an email of only scare claims lists them all, says so, and fetches nothing", async () => {
  const net = stubNet();
  const out = await check({ email: "Your competitors are beating you. Hackers target sites like yours.",
    site: "danasplumbing.com" }, net.fetchImpl);
  assert.equal(out.rows.length, 2);
  assert.ok(out.rows.every((r) => r.verdict === "unverifiable"));
  assert.ok(out.notes.includes("This email makes no claim anyone could verify from outside your site."));
  assert.equal(net.calls.length, 0);
});

test("a site that won't open still lists every claim as can't be checked", async () => {
  const out = await check({ email: emailA, site: "nosuchplace.example" }, stubNet({ down: true }).fetchImpl);
  assert.ok(out.rows.length > 3);
  assert.ok(out.rows.every((r) => r.verdict === "unverifiable"));
  assert.ok(out.rows.some((r) => r.evidence === "Site didn't load, so this couldn't be checked."));
  assert.match(out.notes[0], /^We couldn't open nosuchplace\.example just now \(it didn't answer\)/);
  assert.ok(!out.notes.some((n) => /no claim anyone could verify/.test(n)));
});

const links = (net) => check({ email: "Your site has broken links.", site: "danasplumbing.com" }, net.fetchImpl)
  .then((o) => o.rows[0]);

test("broken links: a 404 on a same-site link is true and named", async () => {
  const row = await links(stubNet({ paths: { "/old-page": 404 } }));
  assert.equal(row.verdict, "true");
  assert.match(row.evidence, /danasplumbing\.com\/old-page/);
  assert.match(row.evidence, /404/);
  assert.match(row.evidence, /1 of 4/);
});

test("broken links: same-site links only, each once, and all loading is false", async () => {
  const net = stubNet();
  const row = await links(net);
  assert.equal(row.verdict, "false");
  assert.match(row.evidence, /All 4 links/);
  const checked = net.calls.filter((c) => c.method === "HEAD").map((c) => new URL(c.url).pathname).sort();
  assert.deepEqual(checked, ["/about", "/contact", "/old-page", "/services"]);
});

test("broken links: a server that refuses HEAD is asked again with GET", async () => {
  const net = stubNet({ headStatus: 405, paths: { "/services": 500 } });
  const row = await links(net);
  assert.equal(row.verdict, "true");
  assert.match(row.evidence, /services/);
  assert.ok(net.calls.some((c) => c.method === "GET" && c.url.endsWith("/services")));
});

test("broken links: more than 10 links are capped and the cap is stated", async () => {
  const many = "<title>x</title>" + Array.from({ length: 37 }, (_, i) => `<a href="/p${i}">p</a>`).join("");
  const net = stubNet({ home: many });
  const row = await links(net);
  assert.equal(row.verdict, "false");
  assert.match(row.evidence, /Checked 10 of 37 links/);
  assert.equal(net.calls.filter((c) => c.method === "HEAD").length, 10);
});

test("broken links: a home page with no links to other pages can't be checked", async () => {
  const row = await links(stubNet({ home: "<title>x</title><a href='https://facebook.com/x'>fb</a>" }));
  assert.equal(row.verdict, "unverifiable");
});

test("the page is served and its results are drawn with textContent, never innerHTML", async () => {
  const res = await worker.fetch(new Request("http://x/"));
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!/innerHTML/.test(html));
  assert.match(html, /@media \(max-width: 600px\)/);
  assert.match(html, /data-label/);
});
