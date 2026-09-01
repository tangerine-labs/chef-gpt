import { TIER_POINTS, type Tier } from "./tiers.ts";

/** One participant's tier for one candidate. */
export interface RankingEntry {
  recipeId: string;
  memberId: string;
  tier: Tier;
}

export interface RankedCandidate {
  recipeId: string;
  points: number;
  /** 1-based; equal points share the same rank ("1, 1, 3"). */
  rank: number;
  tiersByMember: Record<string, Tier>;
}

/**
 * A closed round's result: candidates ordered by summed tier points.
 * Candidates nobody ranked score 0 and sort last. Ties share a rank; there is no tie-break.
 * See CONTEXT.md → Ranked list.
 */
export function rankedList(
  candidateIds: readonly string[],
  entries: readonly RankingEntry[],
): RankedCandidate[] {
  const byRecipe = new Map<string, RankedCandidate>();
  for (const id of candidateIds) byRecipe.set(id, { recipeId: id, points: 0, rank: 0, tiersByMember: {} });

  for (const e of entries) {
    const c = byRecipe.get(e.recipeId);
    if (!c) continue; // not a candidate of this round
    c.points += TIER_POINTS[e.tier];
    c.tiersByMember[e.memberId] = e.tier;
  }

  const sorted = [...byRecipe.values()].sort((a, b) => b.points - a.points);
  let rank = 0;
  sorted.forEach((c, i) => {
    if (i === 0 || c.points !== sorted[i - 1].points) rank = i + 1;
    c.rank = rank;
  });
  return sorted;
}
