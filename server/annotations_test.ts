import { assert, assertEquals } from "@std/assert";
import { rpc } from "./test-mcp.ts";
import { dbTestsEnabled, testUserToken } from "./test-users.ts";

const { default: server } = await import("./.mcp-use/build/index.js");

Deno.test({
  name: "tool annotations (dev project)",
  ignore: !dbTestsEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const a = await testUserToken("a");

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
