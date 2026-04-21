// Room slug generator. Memorable, voice-shareable codes that match the
// server's `^[a-z0-9][a-z0-9-]{2,39}$` sanitizer.
//
// ADJECTIVES × NOUNS × 900 ≈ 360k combinations — collisions just mean the two
// users land in the same room, which is harmless for this demo's threat model.

const ADJECTIVES = [
  "amber", "brisk", "calm", "dusky", "eager", "fuzzy", "gentle", "hazy",
  "ivory", "jolly", "keen", "lucid", "mellow", "nimble", "olive", "plush",
  "quiet", "rosy", "sleek", "tidy", "verdant", "witty", "zesty", "bold",
];

const NOUNS = [
  "otter", "koala", "falcon", "maple", "harbor", "comet", "ember", "lantern",
  "orchid", "pebble", "ridge", "sparrow", "thicket", "vista", "willow",
  "atlas", "beacon", "cedar", "delta", "forge", "grove", "meadow",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function newRoomSlug(): string {
  const n = 100 + Math.floor(Math.random() * 900);
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${n}`;
}

const ROOM_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;

export function isValidSlug(s: string): boolean {
  return ROOM_RE.test(s);
}

// normalizeSlug attempts to coerce user input into a valid slug
// (trim, lowercase, strip spaces, convert invalid chars to dashes,
// collapse repeated dashes). Returns empty string if nothing salvageable.
export function normalizeSlug(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length > 40) s = s.slice(0, 40);
  return isValidSlug(s) ? s : "";
}
