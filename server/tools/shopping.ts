import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { z } from "zod";
import { householdId, must, ToolError, userDb } from "../db.ts";
import { guarded, ok } from "./results.ts";

const Item = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  checked: z.boolean(),
  recipeId: z.string().nullable().describe("The recipe this item came from, if any"),
  recipeTitle: z.string().nullable(),
});

type ItemT = z.infer<typeof Item>;

const ItemsOut = z.object({ items: z.array(Item), uncheckedCount: z.number() });

const rowToItem = (r: {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  recipe_id: string | null;
  recipes?: unknown;
}): ItemT => ({
  id: r.id,
  name: r.name,
  quantity: r.quantity,
  unit: r.unit,
  checked: r.checked,
  recipeId: r.recipe_id,
  recipeTitle: (r.recipes as { title: string } | null)?.title ?? null,
});

const SELECT = "id, name, quantity, unit, checked, recipe_id, recipes(title)";

async function readItems(db: ReturnType<typeof userDb>, hid: string) {
  const rows = must(
    await db
      .from("shopping_items")
      .select(SELECT)
      .eq("household_id", hid)
      .order("checked")
      .order("position")
      .order("created_at"),
    "shopping list",
  );
  const items = rows.map(rowToItem);
  return { items, uncheckedCount: items.filter((i) => !i.checked).length };
}

const itemLine = (i: ItemT) =>
  `- [${i.checked ? "x" : " "}] ${[i.quantity, i.unit, i.name].filter(Boolean).join(" ")}${i.recipeTitle ? ` (for ${i.recipeTitle})` : ""}`;

export function registerShoppingTools(server: MCPServer<SupabaseOAuthUser>) {
  server.tool(
    {
      name: "show_shopping_list",
      description:
        "Open the Shopping List app: the household's single running list with check-off. Text-only alternatives: list_shopping_items, add_shopping_item, update_shopping_item, clear_checked, add_ingredients_from_recipe.",
      inputSchema: z.object({}),
      outputSchema: ItemsOut,
      view: { name: "shopping-list", description: "The household shopping list" },
    },
    (_input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const out = await readItems(db, hid);
        return ok(
          `Shopping list (${out.uncheckedCount} open):\n${out.items.map(itemLine).join("\n") || "(empty)"}`,
          out,
        );
      }),
  );

  server.tool(
    {
      name: "list_shopping_items",
      description: "The shopping list as text/structured data.",
      inputSchema: z.object({}),
      outputSchema: ItemsOut,
    },
    (_input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const out = await readItems(db, hid);
        return ok(out.items.map(itemLine).join("\n") || "The list is empty.", out);
      }),
  );

  server.tool(
    {
      name: "add_shopping_item",
      description: "Add one item to the shopping list (free text, optional quantity/unit).",
      inputSchema: z.object({
        name: z.string().min(1),
        quantity: z.string().optional(),
        unit: z.string().optional(),
      }),
      outputSchema: ItemsOut,
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        must(
          await db
            .from("shopping_items")
            .insert({
              household_id: hid,
              name: input.name.trim(),
              quantity: input.quantity ?? null,
              unit: input.unit ?? null,
            })
            .select("id"),
          "add item",
        );
        const out = await readItems(db, hid);
        return ok(`Added ${input.name}.`, out);
      }),
  );

  server.tool(
    {
      name: "update_shopping_item",
      description: "Check/uncheck an item, or rename it.",
      inputSchema: z.object({
        itemId: z.string(),
        checked: z.boolean().optional(),
        name: z.string().optional(),
      }),
      outputSchema: ItemsOut,
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const patch: { checked?: boolean; name?: string } = {};
        if (input.checked !== undefined) patch.checked = input.checked;
        if (input.name !== undefined) patch.name = input.name.trim();
        if (input.checked === undefined && input.name === undefined)
          throw new ToolError("Nothing to update.");
        must(
          await db.from("shopping_items").update(patch).eq("id", input.itemId).select("id"),
          "update item",
        );
        const out = await readItems(db, hid);
        return ok("Updated.", out);
      }),
  );

  server.tool(
    {
      name: "clear_checked",
      description: "Remove every checked-off item from the list.",
      inputSchema: z.object({}),
      outputSchema: ItemsOut.extend({ removed: z.number() }),
    },
    (_input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const removed = must(
          await db.from("shopping_items").delete().eq("household_id", hid).eq("checked", true).select("id"),
          "clear",
        );
        const out = await readItems(db, hid);
        return ok(`Cleared ${removed.length} item(s).`, { ...out, removed: removed.length });
      }),
  );

  server.tool(
    {
      name: "add_ingredients_from_recipe",
      description:
        "Add a recipe's ingredients to the shopping list (all of them, or a subset by ingredient name). Items remember which recipe they came from. Duplicates by name are skipped.",
      inputSchema: z.object({
        recipeId: z.string(),
        only: z.array(z.string()).optional().describe("Ingredient names to include; omit for all"),
      }),
      outputSchema: ItemsOut.extend({ added: z.number(), skipped: z.number() }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const recipe = must(
          await db.from("recipes").select("id, title, ingredients").eq("id", input.recipeId).maybeSingle(),
          "recipe",
        );
        const wanted = input.only?.map((n) => n.toLowerCase());
        const ingredients = (
          recipe.ingredients as {
            name?: string;
            text?: string;
            quantity?: string | null;
            unit?: string | null;
          }[]
        )
          .map((i) => ({
            name: (i.name ?? i.text ?? "").trim(),
            quantity: i.quantity ?? null,
            unit: i.unit ?? null,
          }))
          .filter((i) => i.name)
          .filter((i) => !wanted || wanted.some((w) => i.name.toLowerCase().includes(w)));
        if (ingredients.length === 0) throw new ToolError("No matching ingredients on that recipe.");
        const existing = must(
          await db.from("shopping_items").select("name").eq("household_id", hid).eq("checked", false),
          "existing",
        );
        const have = new Set(existing.map((e) => e.name.toLowerCase()));
        const fresh = ingredients.filter((i) => !have.has(i.name.toLowerCase()));
        if (fresh.length > 0) {
          must(
            await db
              .from("shopping_items")
              .insert(
                fresh.map((i) => ({
                  household_id: hid,
                  name: i.name,
                  quantity: i.quantity,
                  unit: i.unit,
                  recipe_id: recipe.id,
                })),
              )
              .select("id"),
            "add items",
          );
        }
        const out = await readItems(db, hid);
        return ok(
          `Added ${fresh.length} item(s) for ${recipe.title}${fresh.length < ingredients.length ? ` (${ingredients.length - fresh.length} already on the list)` : ""}.`,
          {
            ...out,
            added: fresh.length,
            skipped: ingredients.length - fresh.length,
          },
        );
      }),
  );
}
