import { assert, assertEquals, assertMatch } from "@std/assert";
import { weekDates, weekStart } from "../packages/domain/mod.ts";
import { callTool } from "./test-mcp.ts";
import { dbTestsEnabled, testUserToken } from "./test-users.ts";

const { default: server } = await import("./.mcp-use/build/index.js");
const call = (token: string, name: string, args: Record<string, unknown> = {}) =>
  callTool(server, token, name, args);

Deno.test({
  name: "week plan and shopping list (dev project)",
  ignore: !dbTestsEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const a = await testUserToken("a");
    const b = await testUserToken("b");
    const monday = weekStart(new Date().toISOString().slice(0, 10));
    const tuesday = weekDates(monday)[1];

    const s = await call(a, "search_recipes", { limit: 1 });
    const recipe = (s.structuredContent?.recipes as { id: string; title: string }[])[0];

    await t.step("set_slot places a recipe and get_week shows it", async () => {
      const r = await call(a, "set_slot", { date: tuesday, recipeId: recipe.id });
      assertMatch(r.content[0].text, new RegExp(`Tuesday ${tuesday}: ${recipe.title.slice(0, 8)}`));
      const w = await call(a, "get_week", { date: monday });
      assertMatch(w.content[0].text, new RegExp(recipe.title.slice(0, 12)));
    });

    await t.step("free-text slot and clearing", async () => {
      const r = await call(a, "set_slot", { date: monday, title: "eating out" });
      assertMatch(r.content[0].text, /Monday .*: eating out\./);
      const c = await call(a, "set_slot", { date: monday, clear: true });
      assertMatch(c.content[0].text, /cleared/);
    });

    await t.step("set_slot without content is rejected", async () => {
      const r = await call(a, "set_slot", { date: monday });
      assertEquals(r.isError, true);
    });

    await t.step("show_week returns the week plus the latest ranked list", async () => {
      const r = await call(a, "show_week", { date: monday });
      const week = r.structuredContent?.week as { days: unknown[] };
      assertEquals(week.days.length, 7);
      assert(Array.isArray(r.structuredContent?.ranked));
    });

    await t.step("shopping: add, check, clear", async () => {
      const add = await call(a, "add_shopping_item", { name: "Milk", quantity: "1", unit: "l" });
      const items = add.structuredContent?.items as { id: string; name: string }[];
      const milk = items.find((i) => i.name === "Milk");
      if (!milk) throw new Error("Milk not added");
      await call(a, "update_shopping_item", { itemId: milk.id, checked: true });
      const cleared = await call(a, "clear_checked");
      assert((cleared.structuredContent?.removed as number) >= 1);
      const after = cleared.structuredContent?.items as { name: string }[];
      assert(!after.some((i) => i.name === "Milk"));
    });

    await t.step("add_ingredients_from_recipe links items to the recipe and skips duplicates", async () => {
      const r1 = await call(a, "add_ingredients_from_recipe", { recipeId: recipe.id });
      const added = r1.structuredContent?.added as number;
      assert(added > 0, r1.content[0].text);
      const r2 = await call(a, "add_ingredients_from_recipe", { recipeId: recipe.id });
      assertEquals(r2.structuredContent?.added, 0);
      assertEquals(r2.structuredContent?.skipped, added);
      const items = r2.structuredContent?.items as {
        recipeTitle: string | null;
        checked: boolean;
        id: string;
      }[];
      assert(items.some((i) => i.recipeTitle === recipe.title));
      // tidy: check + clear everything we added
      for (const i of items.filter((i) => !i.checked))
        await call(a, "update_shopping_item", { itemId: i.id, checked: true });
      await call(a, "clear_checked");
    });

    await t.step("RLS: another household sees an empty list, not ours", async () => {
      await call(a, "add_shopping_item", { name: "RLS-marker" });
      const other = await call(b, "list_shopping_items");
      const names = (other.structuredContent?.items as { name: string }[]).map((i) => i.name);
      assert(!names.includes("RLS-marker"));
      const mine = await call(a, "list_shopping_items");
      const marker = (mine.structuredContent?.items as { id: string; name: string }[]).find(
        (i) => i.name === "RLS-marker",
      );
      if (marker) {
        await call(a, "update_shopping_item", { itemId: marker.id, checked: true });
        await call(a, "clear_checked");
      }
    });
  },
});
