import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { judge } from "../src/judge.js";
import { normaliseSite } from "../src/fetch-site.js";

const page = (name) => readFileSync(new URL(`../fixtures/pages/${name}.html`, import.meta.url), "utf8");
const loaded = (html, extra = {}) => ({ ok: true, finalUrl: "https://danasplumbing.com/", html,
  bytes: html.length, ms: 400, httpsFailed: false, ...extra });
const fixed = loaded(page("fixed"));
const neglected = loaded(page("neglected"));
const v = async (type, site) => (await judge({ type, quote: "" }, site)).verdict;

test("a page that fixed the usual problems makes those claims false, quoting the page", async () => {
  for (const type of ["title", "description", "viewport", "https", "phone_link", "alt_text", "heavy_page", "version"]) {
    assert.equal(await v(type, fixed), "false", type);
  }
  const title = await judge({ type: "title" }, fixed);
  assert.equal(title.evidence, `Your page has a title: "Dana's Plumbing | 24-hour plumber".`);
});

test("a neglected page makes the same claims true, with counts where they help", async () => {
  for (const type of ["title", "description", "viewport", "phone_link", "alt_text", "version"]) {
    assert.equal(await v(type, neglected), "true", type);
  }
  assert.match((await judge({ type: "alt_text" }, neglected)).evidence, /^2 of 3 images/);
  assert.match((await judge({ type: "version" }, neglected)).evidence, /WordPress 6\.2\.2/);
});

test("https: only-http or a redirect down to http makes the claim true", async () => {
  assert.equal(await v("https", loaded("", { httpsFailed: true, finalUrl: "http://danasplumbing.com/" })), "true");
  assert.equal(await v("https", loaded("", { finalUrl: "http://danasplumbing.com/" })), "true");
});

test("heavy page: over 1 MB or over 5 s is true, and says it is a rough check", async () => {
  assert.equal(await v("heavy_page", loaded("", { bytes: 2_000_000 })), "true");
  assert.equal(await v("heavy_page", loaded("", { ms: 6200 })), "true");
  assert.match((await judge({ type: "heavy_page" }, fixed)).evidence, /rough check/);
});

test("a page with no images can't settle an alt-text claim", async () => {
  assert.equal(await v("alt_text", loaded("<title>x</title>")), "unverifiable");
});

test("uncheckable claims stay uncheckable even when the site loaded", async () => {
  for (const type of ["rankings", "penalty", "traffic", "competitors", "security", "losing_customers"]) {
    assert.equal(await v(type, fixed), "unverifiable", type);
  }
});

test("every checkable claim is 'site didn't load' when the fetch failed", async () => {
  const r = await judge({ type: "title" }, { ok: false, reason: "it didn't answer" });
  assert.deepEqual(r, { verdict: "unverifiable", evidence: "Site didn't load, so this couldn't be checked." });
});

test("addresses are cut back to the home page; email addresses are refused", () => {
  assert.equal(normaliseSite("https://DanasPlumbing.com/contact?x=1"), "danasplumbing.com");
  assert.equal(normaliseSite("www.danasplumbing.com/"), "www.danasplumbing.com");
  assert.equal(normaliseSite("dana@danasplumbing.com"), null);
  assert.equal(normaliseSite("not a site"), null);
});

test("down: a page that loaded makes it false, one that didn't makes it true", async () => {
  assert.equal(await v("down", fixed), "false");
  assert.match((await judge({ type: "down" }, fixed)).evidence, /^Your site loaded just now/);
  const failed = { ok: false, url: "https://danasplumbing.com/", reason: "it didn't answer" };
  const down = await judge({ type: "down" }, failed);
  assert.equal(down.verdict, "true");
  assert.match(down.evidence, /it didn't answer/);
});

test("heading: an H1 makes it false with its text, none makes it true", async () => {
  const h = await judge({ type: "heading" }, loaded("<h1 class=x>Dana's <b>Plumbing</b></h1>"));
  assert.equal(h.verdict, "false");
  assert.equal(h.evidence, `Your page has a main heading: "Dana's Plumbing".`);
  assert.equal(await v("heading", loaded("<h2>Hi</h2><h10>")), "true");
});
