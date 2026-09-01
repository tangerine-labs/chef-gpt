/** Tiers a participant can place a candidate in, best first. See CONTEXT.md → Tier. */
export const TIERS = ["S", "A", "B", "C", "D", "F", "GARBAGE"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_POINTS: Record<Tier, number> = {
  S: 7,
  A: 6,
  B: 5,
  C: 4,
  D: 3,
  F: 2,
  GARBAGE: 0,
};

export const TIER_LABELS: Record<Tier, string> = {
  S: "S - Amazing!",
  A: "A - Love it",
  B: "B - Pretty good",
  C: "C - It's okay",
  D: "D - Not great",
  F: "F - Nope",
  GARBAGE: "Garbage",
};

export const TIER_COLORS: Record<Tier, string> = {
  S: "#FFD700",
  A: "#EF4444",
  B: "#F97316",
  C: "#EAB308",
  D: "#22C55E",
  F: "#3B82F6",
  GARBAGE: "#6B7280",
};

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}
