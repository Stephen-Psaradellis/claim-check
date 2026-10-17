import { CLAIM_TYPES } from "./claim-types.js";

// Lines that are never claims about the site: greetings, sign-offs, prices, replies asked
// for, opt-outs, postal addresses, the sender's own AI disclosure.
const NOISE = [
  /^(hi|hello|hey|dear|good (morning|afternoon|evening))\b/i,
  /^(best|kind|warm)?\s*(regards|thanks|thank you|cheers|sincerely)\b/i,
  /\$\s?\d/,
  /\b(unsubscribe|opt[- ]?out)\b/i,
  /\breply\s+['"‘“]?(yes|stop)\b/i,
  /^\d+\s+\S+.*\b(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|way|ct|suite)\b.*\d{5}/i,
  /^an ai (system|tool|assistant)\b/i,
];

const MAX_QUOTE = 140;

export function splitSentences(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(\d+[.)]|[-*•])\s+/, ""))
    .filter(Boolean)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

// Scare paragraphs pack several claims into one sentence ("it takes forever to load, it has
// broken links, and your page title is missing"), so each clause is tested on its own.
export function splitClauses(sentence) {
  return sentence
    .split(/\s*[,;]\s+(?:and\s+|but\s+)?|\s+and\s+(?=(?:it|its|it's|your|the|there|you|no|missing|broken|slow|several|many|some)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function trimQuote(s) {
  return s.length <= MAX_QUOTE ? s : s.slice(0, MAX_QUOTE).replace(/\s+\S*$/, "") + "…";
}

export function findClaims(emailText) {
  const seen = new Set();
  const claims = [];
  for (const sentence of splitSentences(String(emailText || ""))) {
    if (NOISE.some((re) => re.test(sentence))) continue;
    const clauses = splitClauses(sentence);
    for (const clause of clauses) {
      const match = CLAIM_TYPES.find((t) => t.patterns.some((re) => re.test(clause)));
      if (!match || seen.has(match.type)) continue;
      seen.add(match.type);
      // A one-claim sentence keeps its whole wording; a packed one quotes just the clause.
      claims.push({ type: match.type, quote: trimQuote(clauses.length === 1 ? sentence : clause) });
    }
  }
  return claims;
}
