// Copied from packages/domain (views are bundled standalone; keep in sync via domain tests).
export const TIERS = ["S", "A", "B", "C", "D", "F", "GARBAGE"] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_COLORS: Record<Tier, string> = {
  S: "#FFD700",
  A: "#EF4444",
  B: "#F97316",
  C: "#EAB308",
  D: "#22C55E",
  F: "#3B82F6",
  GARBAGE: "#6B7280",
};
