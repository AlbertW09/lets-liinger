// Lightweight client-side text filter for user-generated content (event
// titles/descriptions, comments, DMs). This is a first-line guard so obvious
// slurs and objectionable words don't get posted — it is intentionally small
// and conservative, not a complete moderation system. Anything it misses is
// still catchable via the report → review flow.
//
// The list below covers common slurs and hard profanity. It is deliberately
// terse; extend it as needed. Matching is case-insensitive and ignores simple
// separators (spaces, dots, dashes) between letters to catch light obfuscation.

const BLOCKED_WORDS = [
  // Slurs (racial, homophobic, ableist) — the category stores care most about.
  'n1gger', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded',
  'chink', 'spic', 'kike', 'tranny', 'coon', 'wetback', 'gook',
  // Hard profanity
  'cunt', 'fuck', 'motherfucker', 'shit', 'bitch', 'bastard', 'asshole',
  'dick', 'pussy', 'whore', 'slut',
];

// Build a regex that matches any blocked word, allowing spaces/dots/dashes
// between characters (e.g. "f u c k", "f.u.c.k"). Word-ish boundaries keep
// "assassin" or "scunthorpe"-style false positives lower for the standalone
// short words while still catching them as whole tokens.
function buildPattern(word: string): RegExp {
  const spaced = word.split('').map(escapeRegex).join('[\\s._-]*');
  return new RegExp(`\\b${spaced}\\b`, 'i');
}

function escapeRegex(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PATTERNS = BLOCKED_WORDS.map(buildPattern);

// Returns true if the text contains any blocked word.
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  return PATTERNS.some((re) => re.test(text));
}

// Throwable-friendly check used at write sites. Returns a friendly error string
// if the text is not allowed, or null if it's clean.
export function checkClean(text: string): string | null {
  return containsProfanity(text)
    ? "That contains language we don't allow. Please edit it and try again."
    : null;
}
