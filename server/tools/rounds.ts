import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { z } from "zod";
import { rankedList, TIERS } from "../../packages/domain/mod.ts";
import { PUBLIC_BASE, SITE_ORIGIN } from "../config.ts";
import { type Db, householdBundle, must, ToolError, userDb } from "../db.ts";
import { pickByName, resolveRecipe } from "./resolve.ts";
import { guarded, hints, ok } from "./results.ts";

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

/** What `round_bundle` returns (migration 20260907220000), or null when there is no such round. */
type RoundBundle = {
  round: { id: string; label: string; status: "open" | "closed"; created_at: string };
  participants: { member_id: string; name: string }[];
  voted: string[];
  candidates: {
    recipe_id: string;
    title: string;
    description: string;
    cuisine: string | null;
    cook_time_minutes: number | null;
    image_url: string | null;
  }[];
  entries: { member_id: string; recipe_id: string; tier: (typeof TIERS)[number] }[];
};

/**
 * Everything the round tools read, in one round trip (docs/performance.md §5): `roundId` names
 * the round, otherwise the household's latest round with `status`.
 */
async function roundBundle(db: Db, ref: { roundId?: string; status: "open" | "closed" }) {
  // The generated types call rid non-null; the function takes null for "the latest".
  const args = { rid: ref.roundId ?? null, want: ref.status } as unknown as {
    rid: string;
    want: typeof ref.status;
  };
  const { data, error } = await db.rpc("round_bundle", args);
  if (error) throw new ToolError(`round: ${error.message}`);
  const b = data as unknown as RoundBundle | null;
  if (!b) {
    if (ref.roundId) throw new ToolError("Round not found.");
    throw new ToolError(
      `No ${ref.status} round. ${ref.status === "open" ? "Start one with start_round." : ""}`.trim(),
    );
  }
  const voted = new Set(b.voted);
  return {
    info: {
      id: b.round.id,
      label: b.round.label,
      status: b.round.status,
      createdAt: b.round.created_at,
      participants: b.participants.map((p) => ({
        memberId: p.member_id,
        name: p.name,
        hasVoted: voted.has(p.member_id),
      })),
      candidateCount: b.candidates.length,
    },
    candidateIds: b.candidates.map((c) => c.recipe_id),
    cards: b.candidates.map((c) => ({
      recipeId: c.recipe_id,
      title: c.title,
      description: c.description,
      cuisine: c.cuisine,
      cookTimeMinutes: c.cook_time_minutes,
      imageUrl: proxied(c.image_url),
    })),
    entries: b.entries,
  };
}

const waitingText = (info: { participants: { name: string; hasVoted: boolean }[] }) => {
  const waiting = info.participants.filter((p) => !p.hasVoted).map((p) => p.name);
  return waiting.length ? `waiting on ${waiting.join(", ")}` : "everyone has voted";
};

export function registerRoundTools(server: MCPServer<SupabaseOAuthUser>) {
  server.tool(
    {
      name: "start_round",
      title: "Round builder",
      annotations: hints.read,
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
        const { members } = await householdBundle(db);
        return ok("Round Builder is open: pick candidates, choose voters, and start the round.", {
          members: members.map((m) => ({ memberId: m.id, name: m.name })),
          candidateDefault: 10,
        });
      }),
  );

  server.tool(
    {
      name: "create_round",
      title: "Create round",
      annotations: hints.create,
      description:
        "Create a planning round from candidate recipes (by title) and participants (by name; default: every member). Ids are accepted instead. Voting is open until every participant has ranked, or until close_round.",
      inputSchema: z.object({
        label: z.string().default(""),
        candidates: z
          .array(z.string())
          .optional()
          .describe("Recipe titles (a unique part of each is enough)"),
        candidateRecipeIds: z.array(z.string()).optional(),
        participants: z.array(z.string()).optional().describe("Member names; omit for everyone"),
        participantMemberIds: z.array(z.string()).optional(),
      }),
      outputSchema: z.object({ round: RoundInfo }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const { household, members } = await householdBundle(db);
        const hid = household.id;
        const byTitle = await Promise.all(
          (input.candidates ?? []).map((t) => resolveRecipe(db, { recipe: t }).then((r) => r.id)),
        );
        const candidateRecipeIds = [...new Set([...(input.candidateRecipeIds ?? []), ...byTitle])];
        if (candidateRecipeIds.length < 2) throw new ToolError("A round needs at least two candidates.");
        let participantIds = input.participantMemberIds ?? [];
        if (input.participants?.length)
          participantIds = [
            ...new Set([
              ...participantIds,
              ...input.participants.map((n) => pickByName(members, n, "member").id),
            ]),
          ];
        if (participantIds.length === 0) participantIds = members.map((m) => m.id);
        const round = must(
          await db.from("rounds").insert({ household_id: hid, label: input.label }).select("id").single(),
          "create round",
        );
        must(
          await db
            .from("round_candidates")
            .insert(
              candidateRecipeIds.map((recipeId, i) => ({
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
        const { info } = await roundBundle(db, { roundId: round.id, status: "open" });
        return ok(
          `Round${info.label ? ` "${info.label}"` : ""} started with ${info.candidateCount} candidates; ${waitingText(info)}.`,
          { round: info },
        );
      }),
  );

  server.tool(
    {
      name: "open_voting",
      title: "Vote",
      annotations: hints.read,
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
        const { info, cards: candidates } = await roundBundle(db, { roundId: input.roundId, status: "open" });
        if (info.status !== "open") throw new ToolError("That round is closed; use get_round_results.");
        return ok(`Voting is open (${info.candidateCount} candidates); ${waitingText(info)}.`, {
          round: info,
          candidates,
        });
      }),
  );

  server.tool(
    {
      name: "submit_ranking",
      title: "Submit ranking",
      annotations: hints.idempotent,
      description:
        "Submit one member's complete ranking for an open round (default: the latest open one): every candidate placed in a tier (S, A, B, C, D, F, GARBAGE). Name the voter and the candidates by title; ids are accepted instead. Re-submitting before the round closes replaces the earlier ranking. The round closes automatically when every participant has voted.",
      inputSchema: z.object({
        roundId: z.string().optional().describe("Default: the latest open round"),
        member: z.string().optional().describe("Who is voting, by name"),
        memberId: z.string().optional(),
        entries: z
          .array(
            z.object({
              recipe: z.string().optional().describe("Candidate title (a unique part is enough)"),
              recipeId: z.string().optional(),
              tier: TierSchema,
            }),
          )
          .min(1),
      }),
      outputSchema: z.object({ votedCount: z.number(), total: z.number(), closed: z.boolean() }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const { info, candidateIds, cards } = await roundBundle(db, {
          roundId: input.roundId,
          status: "open",
        });
        const roundId = info.id;
        if (info.status !== "open")
          throw new ToolError("The round is closed; rankings can no longer change.");
        if (!input.member && !input.memberId)
          throw new ToolError("Say who is voting: member (name) or memberId.");
        const voter = input.memberId
          ? info.participants.find((p) => p.memberId === input.memberId)
          : pickByName(info.participants, input.member ?? "", "participant");
        if (!voter) throw new ToolError("That member is not a participant in this round.");
        const titled = cards.map((c) => ({
          id: c.recipeId,
          name: c.title,
        }));
        const entries = input.entries.map((e) => ({
          recipeId: e.recipeId ?? pickByName(titled, e.recipe ?? "", "candidate").id,
          tier: e.tier,
        }));
        const got = new Set(entries.map((e) => e.recipeId));
        const missing = candidateIds.filter((id) => !got.has(id));
        const extra = entries.filter((e) => !candidateIds.includes(e.recipeId));
        if (missing.length || extra.length || got.size !== entries.length) {
          const names = titled.filter((t) => missing.includes(t.id)).map((t) => t.name);
          throw new ToolError(
            `A ranking must place every candidate exactly once.${names.length ? ` Missing: ${names.join(", ")}.` : ""}${extra.length ? ` Not candidates: ${extra.length}.` : ""}`,
          );
        }
        await db.from("rankings").delete().eq("round_id", roundId).eq("member_id", voter.memberId);
        const ranking = must(
          await db
            .from("rankings")
            .insert({ round_id: roundId, member_id: voter.memberId })
            .select("id")
            .single(),
          "ranking",
        );
        must(
          await db
            .from("ranking_entries")
            .insert(entries.map((e) => ({ ranking_id: ranking.id, recipe_id: e.recipeId, tier: e.tier })))
            .select("ranking_id"),
          "entries",
        );
        const after = await roundBundle(db, { roundId, status: "open" });
        const votedCount = after.info.participants.filter((p) => p.hasVoted).length;
        const closed = after.info.status === "closed";
        const name = voter.name;
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
      title: "Close round",
      annotations: hints.destructive,
      description: "Close an open round early (e.g. a participant is away). Results become visible.",
      inputSchema: z.object({ roundId: z.string().optional() }),
      outputSchema: z.object({ round: RoundInfo }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const roundId = input.roundId ?? (await roundBundle(db, { status: "open" })).info.id;
        must(
          await db
            .from("rounds")
            .update({ status: "closed", closed_at: new Date().toISOString() })
            .eq("id", roundId)
            .eq("status", "open")
            .select("id"),
          "close round",
        );
        const { info } = await roundBundle(db, { roundId, status: "closed" });
        return ok("Round closed. Use get_round_results for the ranked list.", { round: info });
      }),
  );

  server.tool(
    {
      name: "get_round_results",
      title: "Round results",
      annotations: hints.read,
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
        const {
          info,
          candidateIds,
          cards,
          entries: raw,
        } = await roundBundle(db, {
          roundId: input.roundId,
          status: "closed",
        });
        if (info.status !== "closed")
          throw new ToolError(`Results are hidden while voting is open (${waitingText(info)}).`);
        const nameOf = new Map(info.participants.map((p) => [p.memberId, p.name]));
        const entries = raw.map((e) => ({
          recipeId: e.recipe_id,
          memberId: nameOf.get(e.member_id) ?? e.member_id,
          tier: e.tier,
        }));
        const list = rankedList(candidateIds, entries);
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
