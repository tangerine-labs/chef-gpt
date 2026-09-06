/**
 * Name-first lookups so tools work from what the user says ("check off the milk", "Emma") without
 * ids. Ids stay accepted for views and for the agent's own follow-ups. Ambiguity is a ToolError
 * that names the matches, so the agent can ask which one.
 */
import { type Db, must, ToolError } from "../db.ts";

const norm = (s: string) => s.trim().toLowerCase();
/** An ambiguity error names at most this many matches; beyond that it asks for a narrower name. */
const MAX_LISTED = 8;

/**
 * Exact (case-insensitive) match wins; else a unique substring match; else a ToolError. Rows may
 * carry a `label` (e.g. title + cookbook) that the ambiguity listing shows instead of the name.
 */
export function pickByName<T extends { name: string; label?: string }>(
  rows: T[],
  query: string,
  what: string,
): T {
  const q = norm(query);
  if (!q) throw new ToolError(`Which ${what}? The name is empty.`);
  const exact = rows.filter((r) => norm(r.name) === q);
  const pool = exact.length ? exact : rows.filter((r) => norm(r.name).includes(q));
  if (pool.length === 1) return pool[0];
  if (pool.length === 0) throw new ToolError(`No ${what} named "${query}".`);
  const labels = [...new Set(pool.map((r) => r.label ?? r.name))];
  const shown = labels.slice(0, MAX_LISTED).join(", ");
  const more = labels.length > MAX_LISTED ? ` and ${labels.length - MAX_LISTED} more` : "";
  throw new ToolError(
    `Several ${what}s match "${query}": ${shown}${more} — which one?${more ? " A more specific name helps." : ""}`,
  );
}

const needOne = (id: string | undefined, name: string | undefined, idField: string, nameField: string) => {
  if (!id && !name) throw new ToolError(`Give ${nameField} (a name) or ${idField}.`);
};

/**
 * A recipe by title (unique substring) or id, among what RLS lets the caller see. Retired recipes
 * are skipped unless `includeRetired`; when several share the exact title (a system recipe and
 * the household's copy of it), the household's own copy wins.
 */
export async function resolveRecipe(
  db: Db,
  ref: { recipeId?: string; recipe?: string },
  opts: { includeRetired?: boolean } = {},
): Promise<{ id: string; name: string }> {
  needOne(ref.recipeId, ref.recipe, "recipeId", "recipe");
  if (ref.recipeId) {
    const r = must(
      await db.from("recipes").select("id, title").eq("id", ref.recipeId).maybeSingle(),
      "recipe",
    );
    return { id: r.id, name: r.title };
  }
  const query = ref.recipe ?? "";
  const like = `%${query.replace(/[%_]/g, "")}%`;
  const [rows, retiredRows] = await Promise.all([
    must(
      await db
        .from("recipes")
        .select("id, title, cookbooks(name, household_id)")
        .ilike("title", like)
        .limit(50),
      "recipes",
    ),
    opts.includeRetired ? [] : must(await db.from("retired_recipes").select("recipe_id"), "retired"),
  ]);
  const retired = new Set(retiredRows.map((r) => r.recipe_id));
  const candidates = rows
    .filter((r) => !retired.has(r.id))
    .map((r) => {
      const cb = r.cookbooks as unknown as { name: string; household_id: string | null } | null;
      return {
        id: r.id,
        name: r.title,
        label: `${r.title} (${cb?.name ?? "?"})`,
        own: cb?.household_id !== null,
      };
    });
  const exact = candidates.filter((c) => norm(c.name) === norm(query));
  const ownExact = exact.filter((c) => c.own);
  if (exact.length > 1 && ownExact.length === 1) return ownExact[0];
  return pickByName(candidates, query, "recipe");
}

/** A household member by name or id. */
export async function resolveMember(
  db: Db,
  hid: string,
  ref: { memberId?: string; member?: string },
): Promise<{ id: string; name: string; userId: string | null }> {
  needOne(ref.memberId, ref.member, "memberId", "member");
  const rows = must(
    await db.from("members").select("id, name, user_id").eq("household_id", hid).order("created_at"),
    "members",
  );
  const members = rows.map((m) => ({ id: m.id, name: m.name, userId: m.user_id }));
  if (ref.memberId) {
    const m = members.find((m) => m.id === ref.memberId);
    if (!m) throw new ToolError("member: not found");
    return m;
  }
  return pickByName(members, ref.member ?? "", "member");
}

/** A shopping item by name or id; unchecked items take precedence over checked ones. */
export async function resolveItem(
  db: Db,
  hid: string,
  ref: { itemId?: string; item?: string },
): Promise<{ id: string; name: string; checked: boolean }> {
  needOne(ref.itemId, ref.item, "itemId", "item");
  if (ref.itemId) {
    const r = must(
      await db.from("shopping_items").select("id, name, checked").eq("id", ref.itemId).maybeSingle(),
      "item",
    );
    return r;
  }
  const rows = must(
    await db.from("shopping_items").select("id, name, checked").eq("household_id", hid),
    "shopping list",
  );
  const q = norm(ref.item ?? "");
  const open = rows.filter((r) => !r.checked);
  const pool = open.some((r) => norm(r.name).includes(q)) ? open : rows;
  return pickByName(pool, ref.item ?? "", "item");
}
