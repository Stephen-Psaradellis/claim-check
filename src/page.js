// The one page: HTML, CSS and the client script as a single string. Everything the
// email or the site supplies is inserted with textContent, never as HTML.

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claim Check - is that email about your website true?</title>
<meta name="description" content="Paste a cold email that says your website has problems, add your address, and see which claims are true.">
<style>
  :root { --bg: #faf8f3; --ink: #1a1a1a; --muted: #555; --true: #1f5f3a; --false: #8a1c1c; --unv: #888; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 18px/1.55 system-ui, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 48px 20px 80px; }
  h1, h2 { font-family: Georgia, "Times New Roman", serif; font-weight: normal; line-height: 1.2; }
  h1 { font-size: 2.1rem; margin: 0 0 8px; }
  .lede { color: var(--muted); margin: 0 0 32px; }
  label { display: block; font-weight: 600; margin: 20px 0 6px; }
  textarea, input { width: 100%; font: inherit; padding: 10px 12px; border: 1px solid #bbb;
    border-radius: 6px; background: #fff; color: var(--ink); }
  textarea { min-height: 220px; resize: vertical; }
  button { margin-top: 20px; font: inherit; font-weight: 600; padding: 10px 26px; border: 0;
    border-radius: 6px; background: var(--ink); color: var(--bg); cursor: pointer; }
  button:disabled { opacity: .6; cursor: progress; }
  .msg { margin: 16px 0 0; color: var(--false); }
  #result { margin-top: 40px; }
  .tally { font-weight: 600; }
  .note { color: var(--muted); }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { text-align: left; font-size: .85rem; color: var(--muted); font-weight: 600; padding: 6px 10px; }
  td { padding: 12px 10px; vertical-align: top; border-top: 1px solid #e3dfd5; }
  tr.row td:first-child { border-left: 4px solid var(--unv); }
  tr.true td:first-child { border-left-color: var(--true); }
  tr.false td:first-child { border-left-color: var(--false); }
  .quote { font-style: italic; }
  .verdict { font-weight: 700; white-space: nowrap; }
  tr.true .verdict { color: var(--true); }
  tr.false .verdict { color: var(--false); }
  @media (max-width: 600px) {
    main { padding: 32px 16px 64px; }
    h1 { font-size: 1.8rem; }
    thead { display: none; }
    table, tbody, tr, td { display: block; width: 100%; }
    tr.row { margin-top: 14px; border: 1px solid #e3dfd5; border-left: 4px solid var(--unv);
      border-radius: 6px; background: #fff; }
    tr.true { border-left-color: var(--true); }
    tr.false { border-left-color: var(--false); }
    tr.row td, tr.row td:first-child { border: 0; padding: 8px 12px; }
    td::before { content: attr(data-label); display: block; font-size: .8rem; font-style: normal;
      font-weight: 600; color: var(--muted); }
  }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <h1>Claim Check</h1>
  <p class="lede">Got an email saying your website has problems? Paste it here with your address,
  and we'll check each claim against your site.</p>
  <form id="form" novalidate>
    <label for="email">The email</label>
    <textarea id="email" placeholder="Paste the whole email here"></textarea>
    <label for="site">Your website</label>
    <input id="site" placeholder="danasplumbing.com" autocomplete="url">
    <button id="go" type="submit">Check</button>
    <p class="msg" id="msg" hidden></p>
  </form>
  <section id="result" hidden>
    <h2 id="heading"></h2>
    <p class="tally" id="tally"></p>
    <table id="table">
      <thead><tr><th>What the email says</th><th>Verdict</th><th>What your site shows</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <div id="notes"></div>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
const WORDS = { true: "True", false: "False", unverifiable: "Can't be checked from outside" };

function say(text) { $("msg").textContent = text; $("msg").hidden = !text; }

function lock(on) {
  $("go").disabled = on; $("email").readOnly = on; $("site").readOnly = on;
  $("go").textContent = on ? "Checking your site..." : "Check";
}

function draw(data) {
  const rows = $("rows"); rows.replaceChildren();
  $("heading").textContent = "What we found on " + data.site;
  for (const r of data.rows) {
    const tr = document.createElement("tr"); tr.className = "row " + r.verdict;
    for (const [cls, label, text] of [["quote", "What the email says", "\\u201c" + r.quote + "\\u201d"],
        ["verdict", "Verdict", WORDS[r.verdict]], ["evidence", "What your site shows", r.evidence]]) {
      const td = document.createElement("td"); td.className = cls; td.dataset.label = label;
      td.textContent = text; tr.append(td);
    }
    rows.append(tr);
  }
  const t = data.tally, none = !data.rows.length;
  $("table").hidden = none; $("tally").hidden = none;
  $("tally").textContent = t.true + " true, " + t.false + " false, " + t.unverifiable + " can't be checked from outside.";
  const notes = $("notes"); notes.replaceChildren();
  for (const n of data.notes || []) { const p = document.createElement("p"); p.className = "note"; p.textContent = n; notes.append(p); }
  $("result").hidden = false;
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault(); $("result").hidden = true;
  const email = $("email").value, site = $("site").value.trim();
  if (!email.trim()) { say("Paste the email first."); $("email").focus(); return; }
  if (!site) { say("Add your website address."); $("site").focus(); return; }
  if (site.includes("@")) { say("That looks like an email address - type your website, like danasplumbing.com."); $("site").focus(); return; }
  say(""); lock(true);
  try {
    const res = await fetch("/check", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, site }) });
    const data = await res.json();
    if (!res.ok) { say(data.error || "Something went wrong. Try again."); return; }
    draw(data);
  } catch { say("Something went wrong. Try again."); }
  finally { lock(false); }
});
</script>
</body>
</html>`;
