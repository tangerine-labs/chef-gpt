import { assert, assertEquals, assertMatch } from "@std/assert";
import { rpc } from "./test-mcp.ts";
import { dbTestsEnabled, testUserToken } from "./test-users.ts";

const { default: server } = await import("./.mcp-use/build/index.js");

Deno.test({
  name: "prompts and annotations (dev project)",
  ignore: !dbTestsEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const a = await testUserToken("a");

    await t.step("prompts/list names the five household routines with their arguments", async () => {
      type Prompt = { name: string; arguments?: { name: string; required?: boolean }[] };
      const { prompts } = await rpc<{ prompts: Prompt[] }>(server, a, "prompts/list", {});
      const byName = new Map(prompts.map((p) => [p.name, p]));
      assertEquals([...byName.keys()].sort(), [
        "onboard",
        "plan-week",
        "shopping-run",
        "start-round",
        "tonight",
      ]);
      const args = byName.get("start-round")?.arguments ?? [];
      assertEquals(args.map((x) => x.name).sort(), ["candidates", "participants", "theme"]);
      assert(args.every((x) => !x.required));
    });

    await t.step("prompts/get renders the argument into the message", async () => {
      type Got = { messages: { role: string; content: { text: string } }[] };
      const r = await rpc<Got>(server, a, "prompts/get", {
        name: "plan-week",
        arguments: { date: "2026-09-07" },
      });
      assertEquals(r.messages.length, 1);
      assertEquals(r.messages[0].role, "user");
      assertMatch(r.messages[0].content.text, /week of 2026-09-07/);
      assertMatch(r.messages[0].content.text, /get_round_results/);
    });

    await t.step("every tool carries annotations; reads are read-only, deletes are destructive", async () => {
      type Tool = { name: string; annotations?: Record<string, boolean> };
      const { tools } = await rpc<{ tools: Tool[] }>(server, a, "tools/list", {});
      assertEquals(
        tools.filter((t) => !t.annotations).map((t) => t.name),
        [],
      );
      const ann = (name: string) => tools.find((t) => t.name === name)?.annotations ?? {};
      assertEquals(ann("search_recipes").readOnlyHint, true);
      assertEquals(ann("clear_checked").destructiveHint, true);
      assertEquals(ann("add_shopping_item").destructiveHint, false);
      assertEquals(ann("set_slot").idempotentHint, true);
      assert(tools.every((t) => t.annotations?.openWorldHint === false));
    });
  },
});
