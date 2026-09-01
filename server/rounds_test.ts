import { assert, assertEquals, assertMatch } from "@std/assert";
import { callTool } from "./test-mcp.ts";
import { dbTestsEnabled, testUserToken } from "./test-users.ts";

const { default: server } = await import("./.mcp-use/build/index.js");
const call = (token: string, name: string, args: Record<string, unknown> = {}) =>
  callTool(server, token, name, args);

Deno.test({
  name: "round lifecycle (dev project)",
  ignore: !dbTestsEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const a = await testUserToken("a");
    const b = await testUserToken("b");

    // Two candidates from the imported corpus.
    const s = await call(a, "search_recipes", { limit: 2 });
    const [c1, c2] = (s.structuredContent?.recipes as { id: string }[]).map((r) => r.id);

    // Ensure a kid member exists (idempotent-ish: reuse if a previous run created one).
    const lm = await call(a, "list_members");
    let members = lm.structuredContent?.members as { id: string; name: string; linked: boolean }[];
    if (!members.some((m) => m.name === "Emma")) {
      await call(a, "add_member", { name: "Emma" });
      members = (await call(a, "list_members")).structuredContent?.members as typeof members;
    }
    const self = members.find((m) => m.linked);
    const emma = members.find((m) => m.name === "Emma");
    if (!self || !emma) throw new Error("expected a linked member and Emma");

    let roundId = "";
    await t.step("create_round with two participants", async () => {
      const r = await call(a, "create_round", {
        label: "test round",
        candidateRecipeIds: [c1, c2],
        participantMemberIds: [self.id, emma.id],
      });
      const round = r.structuredContent?.round as { id: string; status: string; participants: unknown[] };
      roundId = round.id;
      assertEquals(round.status, "open");
      assertEquals(round.participants.length, 2);
      assertMatch(r.content[0].text, /waiting on/);
    });

    await t.step("results are hidden while open", async () => {
      const r = await call(a, "get_round_results", { roundId });
      assertEquals(r.isError, true);
      assertMatch(r.content[0].text, /hidden while voting is open/);
    });

    await t.step("open_voting lists candidates with proxied images", async () => {
      const r = await call(a, "open_voting", { roundId });
      const candidates = r.structuredContent?.candidates as { imageUrl: string | null }[];
      assertEquals(candidates.length, 2);
      for (const c of candidates) if (c.imageUrl) assertMatch(c.imageUrl, /\/functions\/v1\/chef\/img\?u=/);
    });

    await t.step("incomplete rankings are rejected", async () => {
      const r = await call(a, "submit_ranking", {
        roundId,
        memberId: self.id,
        entries: [{ recipeId: c1, tier: "S" }],
      });
      assertEquals(r.isError, true);
      assertMatch(r.content[0].text, /every candidate/);
    });

    await t.step("first ranking does not close the round", async () => {
      const r = await call(a, "submit_ranking", {
        roundId,
        memberId: self.id,
        entries: [
          { recipeId: c1, tier: "S" },
          { recipeId: c2, tier: "C" },
        ],
      });
      assertEquals(r.structuredContent, { votedCount: 1, total: 2, closed: false });
    });

    await t.step("re-submission replaces and still does not close", async () => {
      const r = await call(a, "submit_ranking", {
        roundId,
        memberId: self.id,
        entries: [
          { recipeId: c1, tier: "A" },
          { recipeId: c2, tier: "B" },
        ],
      });
      assertEquals(r.structuredContent, { votedCount: 1, total: 2, closed: false });
    });

    await t.step("last participant's ranking auto-closes the round", async () => {
      const r = await call(a, "submit_ranking", {
        roundId,
        memberId: emma.id,
        entries: [
          { recipeId: c1, tier: "GARBAGE" },
          { recipeId: c2, tier: "S" },
        ],
      });
      assertEquals((r.structuredContent as { closed: boolean }).closed, true);
    });

    await t.step("ranked list sums points with per-member tiers", async () => {
      const r = await call(a, "get_round_results", { roundId });
      const ranked = r.structuredContent?.ranked as {
        recipeId: string;
        points: number;
        rank: number;
        tiersByMember: Record<string, string>;
      }[];
      // self: A(6), B(5); Emma: GARBAGE(0), S(7) → c1 = 6, c2 = 12
      assertEquals(ranked[0].recipeId, c2);
      assertEquals(ranked[0].points, 12);
      assertEquals(ranked[1].points, 6);
      assertEquals(ranked[0].tiersByMember.Emma, "S");
    });

    await t.step("closed rounds refuse further rankings", async () => {
      const r = await call(a, "submit_ranking", {
        roundId,
        memberId: self.id,
        entries: [
          { recipeId: c1, tier: "S" },
          { recipeId: c2, tier: "S" },
        ],
      });
      assertEquals(r.isError, true);
    });

    await t.step("RLS: another household sees no trace of the round", async () => {
      const r = await call(b, "get_round_results", { roundId });
      assertEquals(r.isError, true);
      const v = await call(b, "open_voting", { roundId });
      assertEquals(v.isError, true);
    });

    await t.step("close_round closes an open round early", async () => {
      const r2 = await call(a, "create_round", {
        candidateRecipeIds: [c1, c2],
        participantMemberIds: [emma.id],
      });
      const id2 = (r2.structuredContent?.round as { id: string }).id;
      const closed = await call(a, "close_round", { roundId: id2 });
      assertEquals((closed.structuredContent?.round as { status: string }).status, "closed");
      const res = await call(a, "get_round_results", { roundId: id2 });
      assert(!res.isError, res.content[0].text);
    });
  },
});
