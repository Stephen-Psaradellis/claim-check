// One download of the owner's home page, the way a visitor's browser would ask for it.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/128.0 Safari/537.36 ClaimCheck/0.1";
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 2 * 1024 * 1024;

// "danasplumbing.com/contact?x" -> "danasplumbing.com". Returns null when it is not a host.
export function normaliseSite(site) {
  let s = String(site || "").trim().toLowerCase();
  if (!s || s.includes("@") || /\s/.test(s)) return null;
  s = s.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/\.$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/.test(s) ? s : null;
}

async function readCapped(response) {
  if (!response.body) return { text: "", bytes: 0 };
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytes += value.byteLength;
  }
  reader.cancel().catch(() => {});
  const all = new Uint8Array(bytes);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return { text: new TextDecoder().decode(all), bytes };
}

async function getFollowing(url, fetchImpl, signal) {
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetchImpl(url, {
      redirect: "manual", signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url).toString();
      continue;
    }
    return { res, url };
  }
  throw new Error("too many redirects");
}

export async function fetchSite(site, fetchImpl = fetch) {
  const host = normaliseSite(site);
  if (!host) return { ok: false, reason: "not a website address" };
  const started = Date.now();
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let httpsFailed = false;
  for (const scheme of ["https", "http"]) {
    const url = `${scheme}://${host}/`;
    try {
      const { res, url: finalUrl } = await getFollowing(url, fetchImpl, signal);
      const { text, bytes } = await readCapped(res);
      const ms = Date.now() - started;
      if (res.status >= 400) {
        return { ok: false, url, finalUrl, ms, reason: `it answered with an error (${res.status})` };
      }
      return { ok: true, url, finalUrl, html: text, bytes, ms, httpsFailed, status: res.status };
    } catch (err) {
      if (signal.aborted) return { ok: false, url, ms: Date.now() - started, reason: "it didn't answer" };
      if (scheme === "https") { httpsFailed = true; continue; }
      return { ok: false, url, ms: Date.now() - started,
        reason: /redirects/.test(err.message) ? "it redirected too many times" : "it didn't answer" };
    }
  }
}
