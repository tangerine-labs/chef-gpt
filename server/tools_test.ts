import { assert, assertEquals, assertMatch } from "@std/assert";
import { dbTestsEnabled, testUserToken } from "./test-users.ts";

const ORIGIN = Deno.env.get("SUPABASE_URL") ?? "https://abcdefgh.supabase.co";
const { default: server } = await import("./.mcp-use/build/index.js");

const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "tools-test", version: "0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

type Result = {
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

async function call(token: string, name: string, args: Record<string, unknown> = {}): Promise<Result> {
  const res = await server.fetch(
    new Request(`${ORIGIN}/functions/v1/chef/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/call",
        "mcp-name": name,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args, _meta: META },
      }),
    }),
  );
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data:"));
  const msg = JSON.parse(line ? line.slice(5) : text);
  if (msg.error) throw new Error(`${name}: ${JSON.stringify(msg.error)}`);
  return msg.result as Result;
}

Deno.test({
  name: "recipe tools (dev project)",
  ignore: !dbTestsEnabled,
  sanitizeOps: false, // supabase-js keeps fetch/timer handles open
  sanitizeResources: false,
  fn: async (t) => {
    const a = await testUserToken("a");
    const b = await testUserToken("b");

    await t.step("whoami reflects the signed-in test user", async () => {
      const r = await call(a, "whoami");
      assertEquals(r.structuredContent?.email, "test-a@chef-gpt.test");
    });

    await t.step(
      "list_cookbooks shows the two system cookbooks and an auto-created household cookbook",
      async () => {
        const r = await call(a, "list_cookbooks");
        const cookbooks = r.structuredContent?.cookbooks as {
          name: string;
          system: boolean;
          recipeCount: number;
        }[];
        const names = cookbooks.map((c) => c.name).sort();
        assert(names.includes("Aarstiderne") && names.includes("HelloFresh"), names.join(","));
        assert(
          cookbooks.some((c) => !c.system),
          "household cookbook",
        );
        assert((cookbooks.find((c) => c.name === "HelloFresh")?.recipeCount ?? 0) > 50, "import ran");
      },
    );

    await t.step("search_recipes finds imported recipes by text", async () => {
      const r = await call(a, "search_recipes", { query: "tofu", limit: 5 });
      const recipes = r.structuredContent?.recipes as { id: string; title: string }[];
      assert(recipes.length > 0, r.content[0].text);
      assertMatch(recipes[0].title.toLowerCase() + r.content[0].text.toLowerCase(), /tofu/);
    });

    let createdId = "";
    await t.step("create_recipe adds to the household cookbook and get_recipe reads it back", async () => {
      const r = await call(a, "create_recipe", {
        title: `Test toast ${Date.now()}`,
        ingredients: [{ text: "2 slices bread" }, { text: "butter" }],
        instructions: ["Toast the bread.", "Butter it."],
        tags: ["test"],
      });
      assert(!r.isError, r.content[0].text);
      const recipe = r.structuredContent?.recipe as { id: string; cookbook: string };
      createdId = recipe.id;
      const g = await call(a, "get_recipe", { recipeId: createdId });
      assertMatch(g.content[0].text, /## Ingredients\n- 2 slices bread/);
    });

    await t.step("RLS: another household cannot read the recipe", async () => {
      const r = await call(b, "get_recipe", { recipeId: createdId });
      assertEquals(r.isError, true);
      assertMatch(r.content[0].text, /not found/);
    });

    await t.step("retire_recipe hides it from search and get_recipe reports it", async () => {
      await call(a, "retire_recipe", { recipeId: createdId });
      const s = await call(a, "search_recipes", { query: "Test toast", limit: 50 });
      const ids = (s.structuredContent?.recipes as { id: string }[]).map((r) => r.id);
      assert(!ids.includes(createdId), "retired recipe still in search");
      const g = await call(a, "get_recipe", { recipeId: createdId });
      assertEquals((g.structuredContent?.recipe as { retired: boolean }).retired, true);
    });

    await t.step("copy_recipe_to_cookbook forks a system recipe with provenance", async () => {
      const s = await call(a, "search_recipes", { cookbookId: undefined, limit: 1 });
      const src = (s.structuredContent?.recipes as { id: string; title: string }[])[0];
      const c = await call(a, "copy_recipe_to_cookbook", { recipeId: src.id });
      const copy = c.structuredContent?.recipe as { id: string; basedOnRecipeId: string; title: string };
      assertEquals(copy.basedOnRecipeId, src.id);
      assertEquals(copy.title, src.title);
      await call(a, "retire_recipe", { recipeId: copy.id }); // keep the test household tidy
    });

    await t.step("set_cookbook_enabled refuses household cookbooks and toggles system ones", async () => {
      const l = await call(a, "list_cookbooks");
      const cookbooks = l.structuredContent?.cookbooks as { id: string; system: boolean; name: string }[];
      const own = cookbooks.find((c) => !c.system);
      const sys = cookbooks.find((c) => c.name === "HelloFresh");
      if (!own || !sys) throw new Error("expected both a household and the HelloFresh cookbook");
      assertEquals(
        (await call(a, "set_cookbook_enabled", { cookbookId: own.id, enabled: false })).isError,
        true,
      );
      await call(a, "set_cookbook_enabled", { cookbookId: sys.id, enabled: false });
      const s = await call(a, "search_recipes", { cookbookId: sys.id, limit: 3 });
      assertEquals(
        (s.structuredContent?.recipes as unknown[]).length,
        0,
        "disabled cookbook still searchable",
      );
      await call(a, "set_cookbook_enabled", { cookbookId: sys.id, enabled: true });
    });
  },
});
