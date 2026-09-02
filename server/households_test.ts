import { assert, assertEquals, assertMatch } from "@std/assert";
import { callTool } from "./test-mcp.ts";
import { dbTestsEnabled, testUserToken } from "./test-users.ts";

const { default: server } = await import("./.mcp-use/build/index.js");
const call = (token: string, name: string, args: Record<string, unknown> = {}) =>
  callTool(server, token, name, args);

Deno.test({
  name: "invites and joining (dev project)",
  ignore: !dbTestsEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const a = await testUserToken("a");
    const b = await testUserToken("b");
    const aHousehold = (await call(a, "get_household")).structuredContent?.household as {
      id: string;
      name: string;
    };

    // B must start in its own household. If an earlier run left B in A's, leave via the members table.
    const bBefore = (await call(b, "get_household")).structuredContent?.household as { id: string };
    if (bBefore.id === aHousehold.id) {
      const me = (
        (await call(b, "list_members")).structuredContent?.members as {
          id: string;
          linked: boolean;
          name: string;
        }[]
      ).find((m) => m.name === "Test B");
      throw new Error(`test-b is still in test-a's household (member ${me?.id}); clean up before running`);
    }

    let code = "";
    await t.step("create_invite yields a XXXX-XXXX code visible in get_household", async () => {
      const r = await call(a, "create_invite", { expiresInDays: 1 });
      code = (r.structuredContent?.invite as { code: string }).code;
      assertMatch(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      const h = await call(a, "get_household");
      assert((h.structuredContent?.invites as { code: string }[]).some((i) => i.code === code));
    });

    await t.step("a wrong code is rejected", async () => {
      const r = await call(b, "join_household", { code: "ZZZZ-ZZZZ" });
      assertEquals(r.isError, true);
      assertMatch(r.content[0].text, /invalid or has expired/);
    });

    await t.step("B joins A's household; it becomes B's active household", async () => {
      const r = await call(b, "join_household", { code: code.toLowerCase() }); // case/dash-insensitive
      assert(!r.isError, r.content[0].text);
      assertEquals((r.structuredContent?.household as { id: string }).id, aHousehold.id);
      const h = await call(b, "get_household");
      assertEquals((h.structuredContent?.household as { id: string }).id, aHousehold.id);
      const names = (h.structuredContent?.members as { name: string }[]).map((m) => m.name);
      assert(names.includes("Test A") && names.includes("Test B"), names.join(","));
    });

    await t.step("the code is single-use", async () => {
      const r = await call(b, "join_household", { code });
      assertEquals(r.isError, true, "spent invite should be rejected");
      const h = await call(a, "get_household");
      assert(
        !(h.structuredContent?.invites as { code: string }[]).some((i) => i.code === code),
        "used invite still listed",
      );
    });

    await t.step("B now sees A's shopping list (RLS follows membership)", async () => {
      await call(a, "add_shopping_item", { name: "Shared-marker" });
      const l = await call(b, "list_shopping_items");
      const names = l.structuredContent?.items as { id: string; name: string }[];
      const marker = names.find((i) => i.name === "Shared-marker");
      assert(marker, "B cannot see A's list");
      await call(b, "update_shopping_item", { itemId: marker.id, checked: true });
      await call(b, "clear_checked");
    });

    await t.step("cleanup: B leaves A's household", async () => {
      // Deleting one's own member row is allowed by RLS (member of the household).
      const { createClient } = await import("@supabase/supabase-js");
      const url = Deno.env.get("SUPABASE_URL") ?? "";
      const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const db = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${b}` } },
        auth: { persistSession: false },
      });
      const me = (
        (await call(b, "list_members")).structuredContent?.members as { id: string; name: string }[]
      ).find((m) => m.name === "Test B");
      if (!me) throw new Error("Test B member not found");
      const { error } = await db.from("members").delete().eq("id", me.id);
      assertEquals(error, null);
      const h = await call(b, "get_household");
      assert(
        (h.structuredContent?.household as { id: string }).id !== aHousehold.id,
        "B still in A's household",
      );
    });
  },
});
