import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { z } from "zod";
import { rankedList, TIERS } from "../../packages/domain/mod.ts";
import { PUBLIC_BASE, SITE_ORIGIN } from "../config.ts";
import { type Db, householdId, must, ToolError, userDb } from "../db.ts";
import { guarded, ok } from "./results.ts";

const TierSchema = z.enum(TIERS);

const Candidate = z.object({
  recipeId: z.string(),
  title: z.string(),
  description: z.string(),
  cuisine: z.string().nullable(),
  cookTimeMinutes: z.number().nullable(),
  imageUrl: z.string().nullable().describe("Same-origin proxied URL, safe inside views"),
});

const Participant = z.object({ memberId: z.string(), name: z.string(), hasVoted: z.boolean() });

const RoundInfo = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["open", "closed"]),
  createdAt: z.string(),
  participants: z.array(Participant),
  candidateCount: z.number(),
});

/** Views may only load resources from listed domains; recipe images go through our /img proxy. */
export const proxied = (url: string | null): string | null =>
  url ? `${SITE_ORIGIN}${PUBLIC_BASE}/img?u=${encodeURIComponent(url)}` : null;

async function roundInfo(db: Db, roundId: string) {
  const round = must(await db.from("rounds").select("*").eq("id", roundId).maybeSingle(), "round");
  const [participants, rankings, candidates] = await Promise.all([
    must(
      await db.from("round_participants").select("member_id, members(name)").eq("round_id", roundId),
      "participants",
    ),
    must(await db.from("rankings").select("member_id").eq("round_id", roundId), "rankings"),
    must(await db.from("round_candidates").select("recipe_id").eq("round_id", roundId), "candidates"),
  ]);
  const voted = new Set(rankings.map((r) => r.member_id));
  return {
    row: round,
    info: {
      id: round.id,
      label: round.label,
      status: round.status,
      createdAt: round.created_at,
      participants: participants.map((p) => ({
        memberId: p.member_id,
        name: (p.members as unknown as { name: string })?.name ?? "?",
        hasVoted: voted.has(p.member_id),
      })),
      candidateCount: candidates.length,
    },
    candidateIds: candidates.map((c) => c.recipe_id),
  };
}

async function latestRound(db: Db, hid: string, status: "open" | "closed"): Promise<string> {
  const rows = must(
    await db
      .from("rounds")
      .select("id")
      .eq("household_id", hid)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(1),
    "rounds",
  );
  if (rows.length === 0)
    throw new ToolError(
      `No ${status} round. ${status === "open" ? "Start one with start_round." : ""}`.trim(),
    );
  return rows[0].id;
}

async function candidateCards(db: Db, candidateIds: string[]) {
  if (candidateIds.length === 0) return [];
  const rows = must(
    await db
      .from("recipes")
      .select("id, title, description, cuisine, cook_time_minutes, image_url")
      .in("id", candidateIds),
    "recipes",
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return candidateIds
    .map((id) => byId.get(id))
    .filter((r) => r !== undefined)
    .map((r) => ({
      recipeId: r.id,
      title: r.title,
      description: r.description,
      cuisine: r.cuisine,
      cookTimeMinutes: r.cook_time_minutes,
      imageUrl: proxied(r.image_url),
    }));
}

const waitingText = (info: { participants: { name: string; hasVoted: boolean }[] }) => {
  const waiting = info.participants.filter((p) => !p.hasVoted).map((p) => p.name);
  return waiting.length ? `waiting on ${waiting.join(", ")}` : "everyone has voted";
};

export function registerRoundTools(server: MCPServer<SupabaseOAuthUser>) {
  server.tool(
    {
      name: "start_round",
      description:
        "Open the Round Builder app to put together a planning round: pick candidate dinners from the cookbooks and choose who votes. To create a round without the app, call create_round directly.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        members: z.array(Participant.omit({ hasVoted: true })),
        candidateDefault: z.number(),
      }),
      view: { name: "round-builder", description: "Pick candidates and participants for a voting round" },
    },
    (_input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const members = must(
          await db.from("members").select("id, name").eq("household_id", hid).order("created_at"),
          "members",
        );
        return ok("Round Builder is open: pick candidates, choose voters, and start the round.", {
          members: members.map((m) => ({ memberId: m.id, name: m.name })),
          candidateDefault: 10,
        });
      }),
  );

  server.tool(
    {
      name: "create_round",
      description:
        "Create a planning round from candidate recipe ids and participant member ids (defaults to every member). Voting is open until every participant has ranked, or until close_round.",
      inputSchema: z.object({
        label: z.string().default(""),
        candidateRecipeIds: z.array(z.string()).min(2),
        participantMemberIds: z.array(z.string()).optional(),
      }),
      outputSchema: z.object({ round: RoundInfo }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        let participantIds = input.participantMemberIds;
        if (!participantIds || participantIds.length === 0) {
          const members = must(await db.from("members").select("id").eq("household_id", hid), "members");
          participantIds = members.map((m) => m.id);
        }
        const round = must(
          await db.from("rounds").insert({ household_id: hid, label: input.label }).select("id").single(),
          "create round",
        );
        must(
          await db
            .from("round_candidates")
            .insert(
              input.candidateRecipeIds.map((recipeId, i) => ({
                round_id: round.id,
                recipe_id: recipeId,
                position: i,
              })),
            )
            .select("round_id"),
          "candidates",
        );
        must(
          await db
            .from("round_participants")
            .insert(participantIds.map((memberId) => ({ round_id: round.id, member_id: memberId })))
            .select("round_id"),
          "participants",
        );
        const { info } = await roundInfo(db, round.id);
        return ok(
          `Round${info.label ? ` "${info.label}"` : ""} started with ${info.candidateCount} candidates; ${waitingText(info)}.`,
          { round: info },
        );
      }),
  );

  server.tool(
    {
      name: "open_voting",
      description:
        "Open the Vote app for a round (default: the latest open round). A member picks their name and drags each candidate into a tier. Results stay hidden until the round closes.",
      inputSchema: z.object({ roundId: z.string().optional() }),
      outputSchema: z.object({
        round: RoundInfo,
        candidates: z.array(Candidate),
      }),
      view: { name: "vote", description: "Rank the round's candidates into tiers" },
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const roundId = input.roundId ?? (await latestRound(db, hid, "open"));
        const { info, candidateIds } = await roundInfo(db, roundId);
        if (info.status !== "open") throw new ToolError("That round is closed; use get_round_results.");
        const candidates = await candidateCards(db, candidateIds);
        return ok(`Voting is open (${info.candidateCount} candidates); ${waitingText(info)}.`, {
          round: info,
          candidates,
        });
      }),
  );

  server.tool(
    {
      name: "submit_ranking",
      description:
        "Submit one member's complete ranking for an open round: every candidate placed in a tier (S, A, B, C, D, F, GARBAGE). Re-submitting before the round closes replaces the earlier ranking. The round closes automatically when every participant has voted.",
      inputSchema: z.object({
        roundId: z.string(),
        memberId: z.string(),
        entries: z.array(z.object({ recipeId: z.string(), tier: TierSchema })).min(1),
      }),
      outputSchema: z.object({ votedCount: z.number(), total: z.number(), closed: z.boolean() }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const { row, info, candidateIds } = await roundInfo(db, input.roundId);
        if (row.status !== "open") throw new ToolError("The round is closed; rankings can no longer change.");
        if (!info.participants.some((p) => p.memberId === input.memberId)) {
          throw new ToolError("That member is not a participant in this round.");
        }
        const got = new Set(input.entries.map((e) => e.recipeId));
        const missing = candidateIds.filter((id) => !got.has(id));
        const extra = input.entries.filter((e) => !candidateIds.includes(e.recipeId));
        if (missing.length || extra.length) {
          throw new ToolError(
            `A ranking must place every candidate exactly once. Missing: ${missing.length}, not candidates: ${extra.length}.`,
          );
        }
        await db.from("rankings").delete().eq("round_id", input.roundId).eq("member_id", input.memberId);
        const ranking = must(
          await db
            .from("rankings")
            .insert({ round_id: input.roundId, member_id: input.memberId })
            .select("id")
            .single(),
          "ranking",
        );
        must(
          await db
            .from("ranking_entries")
            .insert(
              input.entries.map((e) => ({ ranking_id: ranking.id, recipe_id: e.recipeId, tier: e.tier })),
            )
            .select("ranking_id"),
          "entries",
        );
        const after = await roundInfo(db, input.roundId);
        const votedCount = after.info.participants.filter((p) => p.hasVoted).length;
        const closed = after.info.status === "closed";
        const name = info.participants.find((p) => p.memberId === input.memberId)?.name ?? "Someone";
        return ok(
          closed
            ? `${name} has voted — that was everyone, the round is closed. Use get_round_results.`
            : `${name} has voted (${votedCount} of ${after.info.participants.length}).`,
          { votedCount, total: after.info.participants.length, closed },
        );
      }),
  );

  server.tool(
    {
      name: "close_round",
      description: "Close an open round early (e.g. a participant is away). Results become visible.",
      inputSchema: z.object({ roundId: z.string().optional() }),
      outputSchema: z.object({ round: RoundInfo }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const roundId = input.roundId ?? (await latestRound(db, hid, "open"));
        must(
          await db
            .from("rounds")
            .update({ status: "closed", closed_at: new Date().toISOString() })
            .eq("id", roundId)
            .eq("status", "open")
            .select("id"),
          "close round",
        );
        const { info } = await roundInfo(db, roundId);
        return ok("Round closed. Use get_round_results for the ranked list.", { round: info });
      }),
  );

  server.tool(
    {
      name: "get_round_results",
      description:
        "The ranked list of a closed round (default: the latest closed one): candidates ordered by summed tier points across participants, with each member's tier. There is no winner — people pick from the list.",
      inputSchema: z.object({ roundId: z.string().optional() }),
      outputSchema: z.object({
        round: RoundInfo,
        ranked: z.array(
          Candidate.extend({
            points: z.number(),
            rank: z.number(),
            tiersByMember: z.record(z.string(), TierSchema).describe("member name → tier"),
          }),
        ),
      }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const roundId = input.roundId ?? (await latestRound(db, hid, "closed"));
        const { info, candidateIds } = await roundInfo(db, roundId);
        if (info.status !== "closed")
          throw new ToolError(`Results are hidden while voting is open (${waitingText(info)}).`);
        const rankings = must(
          await db
            .from("rankings")
            .select("id, member_id, ranking_entries(recipe_id, tier)")
            .eq("round_id", roundId),
          "rankings",
        );
        const nameOf = new Map(info.participants.map((p) => [p.memberId, p.name]));
        const entries = rankings.flatMap((r) =>
          (r.ranking_entries as { recipe_id: string; tier: (typeof TIERS)[number] }[]).map((e) => ({
            recipeId: e.recipe_id,
            memberId: nameOf.get(r.member_id) ?? r.member_id,
            tier: e.tier,
          })),
        );
        const list = rankedList(candidateIds, entries);
        const cards = await candidateCards(db, candidateIds);
        const cardById = new Map(cards.map((c) => [c.recipeId, c]));
        const ranked = list.map((r) => ({
          ...(cardById.get(r.recipeId) ?? {
            recipeId: r.recipeId,
            title: "?",
            description: "",
            cuisine: null,
            cookTimeMinutes: null,
            imageUrl: null,
          }),
          points: r.points,
          rank: r.rank,
          tiersByMember: r.tiersByMember,
        }));
        const text = ranked
          .map(
            (r) =>
              `${r.rank}. ${r.title} — ${r.points} pts (${Object.entries(r.tiersByMember)
                .map(([m, t]) => `${m}: ${t}`)
                .join(", ")})`,
          )
          .join("\n");
        return ok(text || "No candidates.", { round: info, ranked });
      }),
  );
}
