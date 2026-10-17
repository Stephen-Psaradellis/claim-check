import { CLAIM_TYPES } from "./claim-types.js";

// One verdict per claim, from one download of the home page. "true" means the problem the
// email describes is really there; "false" means the page's own code says otherwise.

const REASONS = Object.fromEntries(CLAIM_TYPES.map((t) => [t.type, t.reason]));
const clip = (s, n = 100) => {
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "") + "…";
};
const decode = (s) => String(s)
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

// Tags whose name matches, with their attributes as a lower-cased map.
export function tags(html, name) {
  const out = [];
  const re = new RegExp(`<${name}\\b([^>]*)>`, "gi");
  for (const m of html.matchAll(re)) {
    const attrs = {};
    for (const a of m[1].matchAll(/([a-zA-Z:-]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
      attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? "");
    }
    out.push(attrs);
  }
  return out;
}

const meta = (html, name) => tags(html, "meta").find((m) => (m.name || "").toLowerCase() === name);
const verdict = (v, evidence) => ({ verdict: v, evidence });
const kb = (bytes) => (bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + " MB" : Math.round(bytes / 1024) + " KB");

const CHECKS = {
  title(html) {
    const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const t = m ? clip(decode(m[1])) : "";
    return t ? verdict("false", `Your page has a title: "${t}".`)
      : verdict("true", "Your page's code has no title, so search results and browser tabs have nothing to show.");
  },
  heading(html) {
    const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    if (!m) return verdict("true", "Your home page's code has no main heading (H1).");
    const t = clip(decode(m[1].replace(/<[^>]*>/g, " ")), 80);
    return verdict("false", t ? `Your page has a main heading: "${t}".` : "Your page has a main heading (H1) tag.");
  },
  description(html) {
    const d = clip((meta(html, "description") || {}).content || "");
    return d ? verdict("false", `Your page has a search description: "${d}".`)
      : verdict("true", "No search description found in your page's code; Google writes its own snippet.");
  },
  viewport(html) {
    const v = (meta(html, "viewport") || {}).content;
    return v ? verdict("false", `Your page has a mobile viewport line: "${clip(v)}".`)
      : verdict("true", "No mobile viewport line found in your page's code, so phones show a shrunken desktop page.");
  },
  https(html, site) {
    const final = site.finalUrl || "";
    if (final.startsWith("https://") && !site.httpsFailed) {
      return verdict("false", `Your site loaded securely at ${final} (https, the padlock).`);
    }
    return verdict("true", site.httpsFailed
      ? "The secure (https) address didn't load; only the plain http one did."
      : `The secure address sent visitors on to an insecure one: ${final}.`);
  },
  phone_link(html) {
    const tel = tags(html, "a").find((a) => /^tel:/i.test(a.href || ""));
    return tel ? verdict("false", `Your page has a tap-to-call link: ${clip(tel.href.replace(/^tel:/i, ""), 40)}.`)
      : verdict("true", "No tap-to-call link found on your home page; phones can't dial the number with one tap.");
  },
  alt_text(html) {
    const imgs = tags(html, "img");
    if (!imgs.length) return verdict("unverifiable", "Your home page's code has no images to describe.");
    const missing = imgs.filter((i) => !(i.alt || "").trim()).length;
    return missing ? verdict("true", `${missing} of ${imgs.length} images on your home page have no description.`)
      : verdict("false", `All ${imgs.length} images on your home page have a description.`);
  },
  heavy_page(html, site) {
    const s = (site.ms / 1000).toFixed(1);
    const size = `Your home page's code is ${kb(site.bytes)} and took ${s} s to download`;
    const heavy = site.bytes > 1024 * 1024 || site.ms > 5000;
    return verdict(heavy ? "true" : "false",
      `${size}${heavy ? " - that is heavy" : ", which is not heavy"}. A rough check of the code only, not a full speed test.`);
  },
  version(html) {
    const gen = (meta(html, "generator") || {}).content || "";
    if (/\d/.test(gen)) return verdict("true", `Your page's code announces its software and version: "${clip(gen, 60)}".`);
    const wpVer = html.match(/wp-includes\/[^"'?]+\?ver=(\d+\.\d+(?:\.\d+)?)/i);
    if (wpVer) return verdict("true", `Your page's code loads WordPress core files tagged with a version number (ver=${wpVer[1]}).`);
    return verdict("false", gen ? `Your page names its software ("${clip(gen, 60)}") but no version number.`
      : "No software version found in your page's code.");
  },
};

const MAX_LINKS = 10;
const LINK_TIMEOUT_MS = 5000;
const bare = (host) => host.replace(/^www\./, "");

// Links on the home page that lead to other pages of the same site, each once.
export function siteLinks(html, base) {
  const home = new URL(base);
  const seen = new Set();
  for (const a of tags(html, "a")) {
    let u;
    try { u = new URL(a.href || "", base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || bare(u.hostname) !== bare(home.hostname)) continue;
    u.hash = "";
    if (u.pathname === home.pathname && !u.search) continue;
    seen.add(u.toString());
  }
  return [...seen];
}

// A link's status as a visitor would meet it: HEAD first, GET when the server refuses HEAD.
async function linkStatus(url, fetchImpl) {
  const ask = async (method) => {
    const res = await fetchImpl(url, { method, redirect: "follow", signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 ClaimCheck/0.1" } });
    if (method === "GET") res.body?.cancel().catch(() => {});
    return res.status;
  };
  try {
    const head = await ask("HEAD");
    return [403, 405, 501].includes(head) ? await ask("GET") : head;
  } catch { return null; }
}

async function brokenLinks(html, site, fetchImpl) {
  const all = siteLinks(html, site.finalUrl || site.url);
  if (!all.length) return verdict("unverifiable", "Your home page has no links to other pages of your site to check.");
  const picked = all.slice(0, MAX_LINKS);
  const statuses = await Promise.all(picked.map((u) => linkStatus(u, fetchImpl)));
  const cap = all.length > picked.length ? ` Checked ${picked.length} of ${all.length} links.` : "";
  const bad = picked.map((u, i) => [u, statuses[i]]).filter(([, s]) => s === null || s >= 400);
  if (!bad.length) return verdict("false", `All ${picked.length} links to your other pages loaded.${cap}`);
  const [u, s] = bad[0];
  const name = u.replace(/^https?:\/\//, "");
  return verdict("true", `${bad.length} of ${picked.length} links didn't load - first: ${name} ` +
    `(${s === null ? "no answer" : "error " + s}).${cap}`);
}

export async function judge(claim, site, fetchImpl = fetch) {
  const reason = REASONS[claim.type];
  if (reason) return verdict("unverifiable", reason);
  if (claim.type === "down") {
    if (!site) return verdict("unverifiable", "Site wasn't checked.");
    return site.ok
      ? verdict("false", `Your site loaded just now (${site.finalUrl}, ${(site.ms / 1000).toFixed(1)} s). One check, not a record of past outages.`)
      : verdict("true", `Your site didn't load for us just now (${site.reason}). Open it in a browser too - it may be the address.`);
  }
  if (!site || !site.ok) return verdict("unverifiable", "Site didn't load, so this couldn't be checked.");
  if (claim.type === "broken_links") return brokenLinks(site.html || "", site, fetchImpl);
  const check = CHECKS[claim.type];
  if (!check) return verdict("unverifiable", "This claim isn't checked yet.");
  return check(site.html || "", site);
}
