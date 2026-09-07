import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { z } from "zod";
import {
  MEAL_TYPES,
  type RankingEntry,
  rankedList,
  weekDates,
  weekStart,
} from "../../packages/domain/mod.ts";
import { type Db, householdId, must, ToolError, userDb } from "../db.ts";
import { resolveRecipe } from "./resolve.ts";
import { guarded, hints, ok } from "./results.ts";
import { proxied } from "./rounds.ts";

const MealType = z.enum(MEAL_TYPES);

const Slot = z.object({
  date: z.string(),
  mealType: MealType,
  recipe: z.object({ id: z.string(), title: z.string(), imageUrl: z.string().nullable() }).nullable(),
  title: z.string().nullable().describe("Free text when no recipe, e.g. 'eating out'"),
});

const Week = z.object({
  weekStart: z.string().describe("Monday, YYYY-MM-DD"),
  days: z.array(z.object({ date: z.string(), slots: z.array(Slot) })),
});

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const dayName = (date: string): string =>
  DAY_NAMES[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];

type Card = { id: string; title: string; image_url: string | null };
/** What `week_bundle` returns (migration 20260907210000): the week's slots and the latest closed round, raw. */
type Bundle = {
  household_id: string;
  plan_id: string | null;
  slots: { date: string; meal_type: z.infer<typeof MealType>; title: string | null; recipe: Card | null }[];
  round: {
    id: string;
    candidates: { recipe_id: string; title: string; image_url: string | null }[];
    entries: { member_id: string; recipe_id: string; tier: RankingEntry["tier"] }[];
  } | null;
};

/** The week containing `anyDate` plus the latest closed round, in one round trip (docs/performance.md §5). */
async function weekBundle(db: Db, anyDate: string) {
  const monday = weekStart(anyDate);
  const bundle = must(await db.rpc("week_bundle", { monday }), "week") as unknown as Bundle;
  const byDate = new Map<string, Bundle["slots"]>();
  for (const s of bundle.slots) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }
  const week: z.infer<typeof Week> = {
    weekStart: monday,
    days: weekDates(monday).map((date) => ({
      date,
      slots: (byDate.get(date) ?? []).map((s) => ({
        date,
        mealType: s.meal_type,
        recipe: s.recipe
          ? { id: s.recipe.id, title: s.recipe.title, imageUrl: proxied(s.recipe.image_url) }
          : null,
        title: s.title,
      })),
    })),
  };
  return { hid: bundle.household_id, planId: bundle.plan_id, week, round: bundle.round };
}

const weekText = (week: z.infer<typeof Week>): string =>
  week.days
    .map((d) => {
      const dinner = d.slots.find((s) => s.mealType === "dinner");
      const what = dinner
        ? dinner.recipe
          ? `${dinner.recipe.title} (${dinner.recipe.id})`
          : dinner.title
        : "—";
      return `${dayName(d.date)} ${d.date}: ${what}`;
    })
    .join("\n");

const today = () => new Date().toISOString().slice(0, 10);

export function registerWeekTools(server: MCPServer<SupabaseOAuthUser>) {
  server.tool(
    {
      name: "get_week",
      title: "Week plan (text)",
      annotations: hints.read,
      description:
        "The household's meal plan for the week containing `date` (default: today). Days without a slot show —.",
      inputSchema: z.object({ date: z.string().optional().describe("Any date in the week, YYYY-MM-DD") }),
      outputSchema: z.object({ week: Week }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const { week } = await weekBundle(db, input.date ?? today());
        return ok(`Week of ${week.weekStart}:\n${weekText(week)}`, { week });
      }),
  );

  server.tool(
    {
      name: "set_slot",
      title: "Set meal slot",
      annotations: hints.idempotent,
      description:
        "Fill, change or clear one slot in the meal plan. Name the recipe by title (or pass recipeId), or give title for free text ('eating out'); clear=true empties the slot. Any recipe may go in — winners from a round are not required.",
      inputSchema: z.object({
        date: z.string().describe("YYYY-MM-DD"),
        mealType: MealType.default("dinner"),
        recipe: z.string().optional().describe("Recipe title (a unique part of it is enough)"),
        recipeId: z.string().optional(),
        title: z.string().optional().describe("Free text when it is not a recipe"),
        clear: z.boolean().optional(),
      }),
      outputSchema: z.object({ week: Week }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        if (!input.clear && !input.recipe && !input.recipeId && !input.title) {
          throw new ToolError("Provide recipe (title) or recipeId, or title for free text, or clear=true.");
        }
        const recipeId = input.recipe || input.recipeId ? (await resolveRecipe(db, input)).id : undefined;
        const monday = weekStart(input.date);
        const plan = must(
          await db
            .from("meal_plans")
            .upsert({ household_id: hid, week_start: monday }, { onConflict: "household_id,week_start" })
            .select("id")
            .single(),
          "plan",
        );
        await db
          .from("slots")
          .delete()
          .eq("meal_plan_id", plan.id)
          .eq("date", input.date)
          .eq("meal_type", input.mealType);
        let what = "cleared";
        if (!input.clear) {
          const row = must(
            await db
              .from("slots")
              .insert({
                meal_plan_id: plan.id,
                date: input.date,
                meal_type: input.mealType,
                recipe_id: recipeId ?? null,
                title: recipeId ? null : (input.title ?? null),
              })
              .select("title, recipes(title)")
              .single(),
            "slot",
          );
          what = (row.recipes as unknown as { title: string } | null)?.title ?? row.title ?? "";
        }
        const { week } = await weekBundle(db, input.date);
        return ok(
          `${dayName(input.date)} ${input.date}${input.mealType === "dinner" ? "" : ` (${input.mealType})`}: ${what}.`,
          { week },
        );
      }),
  );

  server.tool(
    {
      name: "show_week",
      title: "Week plan",
      annotations: hints.read,
      description:
        "Open the Week Plan app: the week's dinner slots side by side with the latest closed round's ranked list, for filling the week by tapping. For text-only access use get_week / set_slot.",
      inputSchema: z.object({ date: z.string().optional().describe("Any date in the week, YYYY-MM-DD") }),
      outputSchema: z.object({
        week: Week,
        ranked: z
          .array(
            z.object({
              recipeId: z.string(),
              title: z.string(),
              points: z.number(),
              rank: z.number(),
              imageUrl: z.string().nullable(),
            }),
          )
          .describe("Latest closed round's ranked list; empty when there is none"),
      }),
      view: { name: "week-plan", description: "Plan the week's dinners" },
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const { week, round } = await weekBundle(db, input.date ?? today());
        let ranked: {
          recipeId: string;
          title: string;
          points: number;
          rank: number;
          imageUrl: string | null;
        }[] = [];
        if (round) {
          const cardById = new Map(round.candidates.map((c) => [c.recipe_id, c]));
          const list = rankedList(
            round.candidates.map((c) => c.recipe_id),
            round.entries.map((e) => ({ recipeId: e.recipe_id, memberId: e.member_id, tier: e.tier })),
          );
          ranked = list.map((r) => ({
            recipeId: r.recipeId,
            title: cardById.get(r.recipeId)?.title ?? "?",
            points: r.points,
            rank: r.rank,
            imageUrl: proxied(cardById.get(r.recipeId)?.image_url ?? null),
          }));
        }
        return ok(`Week Plan is open (week of ${week.weekStart}).\n${weekText(week)}`, { week, ranked });
      }),
  );
}
