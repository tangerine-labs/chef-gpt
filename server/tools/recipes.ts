import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { z } from "zod";
import { type Db, householdId, must, type RecipeRow, ToolError, userDb } from "../db.ts";
import { guarded, ok } from "./results.ts";

const Ingredient = z.object({
  text: z.string().describe("The ingredient line as written, e.g. '2 dl cream'"),
  name: z.string().optional(),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
});

const RecipeSummary = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  cuisine: z.string().nullable(),
  cookTimeMinutes: z.number().nullable(),
  tags: z.array(z.string()),
  imageUrl: z.string().nullable(),
  cookbook: z.string(),
  retired: z.boolean(),
});

const RecipeFull = RecipeSummary.extend({
  url: z.string().nullable(),
  difficulty: z.string().nullable(),
  servings: z.string().nullable(),
  ingredients: z.array(Ingredient),
  instructions: z.array(z.string()),
  allergens: z.array(z.string()),
  basedOnRecipeId: z.string().nullable(),
});

const Cookbook = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  system: z.boolean(),
  enabled: z.boolean(),
  recipeCount: z.number(),
});

type Scope = {
  hid: string;
  cookbooks: { id: string; name: string; system: boolean; enabled: boolean }[];
  retired: Set<string>;
};

/** Cookbooks the household can see, with system ones' enabled flag, plus its retired recipe ids. */
async function scope(db: Db): Promise<Scope> {
  const hid = await householdId(db);
  const [cookbooks, settings, retired] = await Promise.all([
    must(
      await db
        .from("cookbooks")
        .select("id, name, household_id")
        .order("household_id", { nullsFirst: false }),
      "cookbooks",
    ),
    must(
      await db.from("household_cookbooks").select("cookbook_id, enabled").eq("household_id", hid),
      "cookbook settings",
    ),
    must(await db.from("retired_recipes").select("recipe_id").eq("household_id", hid), "retired"),
  ]);
  const disabled = new Set(settings.filter((s) => !s.enabled).map((s) => s.cookbook_id));
  return {
    hid,
    cookbooks: cookbooks.map((c) => ({
      id: c.id,
      name: c.name,
      system: c.household_id === null,
      enabled: !disabled.has(c.id),
    })),
    retired: new Set(retired.map((r) => r.recipe_id)),
  };
}

const summary = (r: RecipeRow, s: Scope) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  cuisine: r.cuisine,
  cookTimeMinutes: r.cook_time_minutes,
  tags: r.tags,
  imageUrl: r.image_url,
  cookbook: s.cookbooks.find((c) => c.id === r.cookbook_id)?.name ?? "",
  retired: s.retired.has(r.id),
});

const full = (r: RecipeRow, s: Scope) => ({
  ...summary(r, s),
  url: r.url,
  difficulty: r.difficulty,
  servings: r.servings,
  ingredients: (r.ingredients ?? []) as z.infer<typeof Ingredient>[],
  instructions: r.instructions,
  allergens: r.allergens,
  basedOnRecipeId: r.based_on_recipe_id,
});

const line = (r: ReturnType<typeof summary>) =>
  `- ${r.title} (${r.id})${r.cuisine ? ` · ${r.cuisine}` : ""}${r.cookTimeMinutes ? ` · ${r.cookTimeMinutes} min` : ""} · ${r.cookbook}${r.retired ? " · retired" : ""}`;

async function householdCookbook(db: Db, s: Scope, cookbookId?: string): Promise<string> {
  if (cookbookId) {
    const c = s.cookbooks.find((c) => c.id === cookbookId);
    if (!c) throw new ToolError(`Cookbook ${cookbookId} not found`);
    if (c.system)
      throw new ToolError(
        `${c.name} is a system cookbook and read-only; copy into your own cookbook instead`,
      );
    return c.id;
  }
  const own = s.cookbooks.find((c) => !c.system);
  if (own) return own.id;
  const created = must(
    await db
      .from("cookbooks")
      .insert({ household_id: s.hid, name: "Our recipes", slug: "our-recipes" })
      .select("id")
      .single(),
    "create cookbook",
  );
  return created.id;
}

export function registerRecipeTools(server: MCPServer<SupabaseOAuthUser>) {
  server.tool(
    {
      name: "search_recipes",
      description:
        "Search recipes across the household's enabled cookbooks (system cookbooks like Aarstiderne/HelloFresh plus the household's own). Retired recipes are excluded unless includeRetired is set. Returns up to `limit` summaries; use get_recipe for ingredients and instructions.",
      inputSchema: z.object({
        query: z.string().optional().describe("Free text matched against title and description"),
        cuisine: z.string().optional(),
        tag: z.string().optional().describe("e.g. quick, veggie, kid-friendly"),
        maxCookTimeMinutes: z.number().int().positive().optional(),
        cookbookId: z.string().optional(),
        includeRetired: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).default(12),
      }),
      outputSchema: z.object({ recipes: z.array(RecipeSummary), total: z.number() }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const s = await scope(db);
        const ids = s.cookbooks
          .filter((c) => c.enabled && (!input.cookbookId || c.id === input.cookbookId))
          .map((c) => c.id);
        let q = db.from("recipes").select("*", { count: "exact" }).in("cookbook_id", ids);
        if (input.query) {
          const like = `%${input.query.replace(/[%_]/g, "")}%`;
          q = q.or(`title.ilike.${like},description.ilike.${like}`);
        }
        if (input.cuisine) q = q.ilike("cuisine", input.cuisine);
        if (input.tag) q = q.contains("tags", [input.tag]);
        if (input.maxCookTimeMinutes) q = q.lte("cook_time_minutes", input.maxCookTimeMinutes);
        if (!input.includeRetired && s.retired.size > 0)
          q = q.not("id", "in", `(${[...s.retired].join(",")})`);
        const { data, error, count } = await q.order("title").limit(input.limit);
        if (error) throw new ToolError(`search: ${error.message}`);
        const recipes = (data ?? []).map((r) => summary(r, s));
        const text = recipes.length
          ? `${count ?? recipes.length} match(es), showing ${recipes.length}:\n${recipes.map(line).join("\n")}`
          : "No recipes match.";
        return ok(text, { recipes, total: count ?? recipes.length });
      }),
  );

  server.tool(
    {
      name: "get_recipe",
      description: "Full recipe: ingredients, instructions, allergens, source URL.",
      inputSchema: z.object({ recipeId: z.string() }),
      outputSchema: z.object({ recipe: RecipeFull }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const s = await scope(db);
        const r = must(await db.from("recipes").select("*").eq("id", input.recipeId).maybeSingle(), "recipe");
        const recipe = full(r, s);
        const text = [
          `# ${recipe.title}`,
          recipe.description,
          [
            recipe.cuisine,
            recipe.cookTimeMinutes && `${recipe.cookTimeMinutes} min`,
            recipe.servings && `serves ${recipe.servings}`,
            recipe.cookbook,
          ]
            .filter(Boolean)
            .join(" · "),
          "",
          "## Ingredients",
          ...recipe.ingredients.map((i) => `- ${i.text}`),
          "",
          "## Instructions",
          ...recipe.instructions.map((step, i) => `${i + 1}. ${step}`),
          recipe.allergens.length ? `\nAllergens: ${recipe.allergens.join(", ")}` : "",
          recipe.url ? `\nSource: ${recipe.url}` : "",
        ].join("\n");
        return ok(text, { recipe });
      }),
  );

  server.tool(
    {
      name: "create_recipe",
      description:
        "Add a recipe to one of the household's own cookbooks (default: the first one). Use for recipes the agent writes or the user dictates.",
      inputSchema: z.object({
        title: z.string().min(1),
        description: z.string().default(""),
        ingredients: z.array(Ingredient).min(1),
        instructions: z.array(z.string()).min(1),
        cuisine: z.string().optional(),
        tags: z.array(z.string()).default([]),
        cookTimeMinutes: z.number().int().positive().optional(),
        servings: z.string().optional(),
        imageUrl: z.string().url().optional(),
        url: z.string().url().optional().describe("Where the recipe came from, if anywhere"),
        cookbookId: z.string().optional(),
      }),
      outputSchema: z.object({ recipe: RecipeFull }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const s = await scope(db);
        const cookbookId = await householdCookbook(db, s, input.cookbookId);
        const r = must(
          await db
            .from("recipes")
            .insert({
              cookbook_id: cookbookId,
              title: input.title,
              description: input.description,
              ingredients: input.ingredients.map((i) => ({ ...i, name: i.name ?? i.text })),
              instructions: input.instructions,
              cuisine: input.cuisine ?? null,
              tags: input.tags,
              cook_time_minutes: input.cookTimeMinutes ?? null,
              servings: input.servings ?? null,
              image_url: input.imageUrl ?? null,
              url: input.url ?? null,
            })
            .select("*")
            .single(),
          "create recipe",
        );
        const recipe = full(r, s);
        return ok(`Added "${recipe.title}" (${recipe.id}) to ${recipe.cookbook}.`, { recipe });
      }),
  );

  server.tool(
    {
      name: "copy_recipe_to_cookbook",
      description:
        "Copy a recipe (typically from a system cookbook) into one of the household's own cookbooks so it can be edited. Records what it was based on.",
      inputSchema: z.object({ recipeId: z.string(), cookbookId: z.string().optional() }),
      outputSchema: z.object({ recipe: RecipeFull }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const s = await scope(db);
        const src = must(
          await db.from("recipes").select("*").eq("id", input.recipeId).maybeSingle(),
          "recipe",
        );
        const cookbookId = await householdCookbook(db, s, input.cookbookId);
        const { id: _id, created_at: _c, updated_at: _u, cookbook_id: _cb, external_id: _e, ...rest } = src;
        const r = must(
          await db
            .from("recipes")
            .insert({ ...rest, cookbook_id: cookbookId, based_on_recipe_id: src.id })
            .select("*")
            .single(),
          "copy recipe",
        );
        const recipe = full(r, s);
        return ok(`Copied "${recipe.title}" into ${recipe.cookbook} as ${recipe.id}.`, { recipe });
      }),
  );

  server.tool(
    {
      name: "retire_recipe",
      description:
        "Hide a recipe from this household's searches and candidate lists (or un-hide it). Never automatic.",
      inputSchema: z.object({ recipeId: z.string(), retired: z.boolean().default(true) }),
      outputSchema: z.object({ recipeId: z.string(), retired: z.boolean() }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        must(await db.from("recipes").select("id").eq("id", input.recipeId).maybeSingle(), "recipe");
        if (input.retired) {
          must(
            await db
              .from("retired_recipes")
              .upsert({ household_id: hid, recipe_id: input.recipeId })
              .select(),
            "retire",
          );
        } else {
          must(
            await db
              .from("retired_recipes")
              .delete()
              .eq("household_id", hid)
              .eq("recipe_id", input.recipeId)
              .select(),
            "unretire",
          );
        }
        return ok(input.retired ? "Retired." : "Back in rotation.", {
          recipeId: input.recipeId,
          retired: input.retired,
        });
      }),
  );

  server.tool(
    {
      name: "list_cookbooks",
      description:
        "Cookbooks visible to the household: system ones (with whether they're enabled) and the household's own.",
      inputSchema: z.object({}),
      outputSchema: z.object({ cookbooks: z.array(Cookbook) }),
    },
    (_input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const s = await scope(db);
        const rows = must(await db.from("cookbooks").select("id, name, slug, household_id"), "cookbooks");
        const cookbooks = await Promise.all(
          rows.map(async (c) => {
            const { count } = await db
              .from("recipes")
              .select("id", { count: "exact", head: true })
              .eq("cookbook_id", c.id);
            const sc = s.cookbooks.find((x) => x.id === c.id);
            return {
              id: c.id,
              name: c.name,
              slug: c.slug,
              system: c.household_id === null,
              enabled: sc?.enabled ?? true,
              recipeCount: count ?? 0,
            };
          }),
        );
        const text = cookbooks
          .map(
            (c) =>
              `- ${c.name} (${c.id}): ${c.recipeCount} recipes${c.system ? `, system, ${c.enabled ? "enabled" : "disabled"}` : ", yours"}`,
          )
          .join("\n");
        return ok(text, { cookbooks });
      }),
  );

  server.tool(
    {
      name: "set_cookbook_enabled",
      description:
        "Enable or disable a system cookbook for this household (household cookbooks are always on).",
      inputSchema: z.object({ cookbookId: z.string(), enabled: z.boolean() }),
      outputSchema: z.object({ cookbookId: z.string(), enabled: z.boolean() }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const s = await scope(db);
        const c = s.cookbooks.find((c) => c.id === input.cookbookId);
        if (!c) throw new ToolError(`Cookbook ${input.cookbookId} not found`);
        if (!c.system) throw new ToolError(`${c.name} is your own cookbook; it is always enabled`);
        must(
          await db
            .from("household_cookbooks")
            .upsert({ household_id: s.hid, cookbook_id: c.id, enabled: input.enabled })
            .select(),
          "cookbook setting",
        );
        return ok(`${c.name} ${input.enabled ? "enabled" : "disabled"}.`, {
          cookbookId: c.id,
          enabled: input.enabled,
        });
      }),
  );
}
