import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findClaims } from "../src/claims.js";

// Fixture A carries a labelled header above the "---" line; the email is what follows it.
const fixtureA = readFileSync(new URL("../fixtures/audit-email-a.txt", import.meta.url), "utf8")
  .split(/^---$/m)[1];

test("fixture A: one row per numbered problem, then the scare claims, in the email's order", () => {
  const types = findClaims(fixtureA).map((c) => c.type);
  assert.deepEqual(types, [
    "viewport", "description", "version",
    "rankings", "competitors", "security", "https", "heavy_page", "broken_links", "title",
  ]);
});

test("fixture A: quotes come from the email itself", () => {
  const claims = findClaims(fixtureA);
  assert.match(claims[0].quote, /^no mobile viewport tag/);
  assert.match(claims[1].quote, /^no meta description/);
  for (const c of claims) assert.ok(c.quote.length <= 141, c.quote);
});

test("price, greeting, signature, address, opt-out and disclosure lines are not claims", () => {
  const noise = [
    "Hi Dana's Plumbing team,",
    "I can fix all of it for a fixed $150, paid only after it works on your side.",
    "Reply 'yes' or ask me anything, and I will send the exact list and the plan.",
    "1332 N Vail Ave, Arlington Heights, IL 60004",
    "If you would rather not hear from me again, reply 'stop' and I will not write again.",
    "Unsubscribe from these emails about your slow website.",
    "Best regards,",
  ].join("\n");
  assert.deepEqual(findClaims(noise), []);
});

test("the same claim twice becomes one row, first quote kept", () => {
  const claims = findClaims("Your site has no meta description.\nAlso, the meta description is missing!");
  assert.equal(claims.length, 1);
  assert.equal(claims[0].quote, "Your site has no meta description.");
});

test("losing customers to competitors is a claim nobody can check from outside", () => {
  const [claim] = findClaims("You're losing customers to competitors every week.");
  assert.equal(claim.type, "competitors");
});

test("an email with no site claims yields nothing", () => {
  assert.deepEqual(findClaims("Hello! We build great websites. Can we talk this week?"), []);
});

test("'X and no Y' in one sentence is two claims", () => {
  const types = findClaims("Your site has broken links and no page title.").map((c) => c.type);
  assert.deepEqual(types, ["broken_links", "title"]);
});

test("'your site is down' and 'no H1' are claims, and 'download' is not", () => {
  const types = (s) => findClaims(s).map((c) => c.type);
  assert.deepEqual(types("Your website is down. Your homepage has no H1."), ["down", "heading"]);
  assert.deepEqual(types("Your site keeps going offline and won't load on my laptop."), ["down"]);
  assert.deepEqual(types("Download our free guide today."), []);
});
