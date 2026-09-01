import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { z } from "zod";
import { MEAL_TYPES, weekDates, weekStart } from "../../packages/domain/mod.ts";
import { type Db, householdId, must, ToolError, userDb } from "../db.ts";
import { guarded, ok } from "./results.ts";
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

async function readWeek(db: Db, hid: string, anyDate: string) {
  const monday = weekStart(anyDate);
  const plan = must(
    await db
      .from("meal_plans")
      .select("id")
      .eq("household_id", hid)
      .eq("week_start", monday)
      .maybeSingle()
      .then((r) => ({ ...r, data: r.data ?? { id: null } })),
    "plan",
  );
  const slots = plan.id
    ? must(
        await db
          .from("slots")
          .select("date, meal_type, title, recipes(id, title, image_url)")
          .eq("meal_plan_id", plan.id),
        "slots",
      )
    : [];
  const byDate = new Map<string, typeof slots>();
  for (const s of slots) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }
  return {
    planId: plan.id as string | null,
    week: {
      weekStart: monday,
      days: weekDates(monday).map((date) => ({
        date,
        slots: (byDate.get(date) ?? []).map((s) => {
          const r = s.recipes as unknown as { id: string; title: string; image_url: string | null } | null;
          return {
            date,
            mealType: s.meal_type,
            recipe: r ? { id: r.id, title: r.title, imageUrl: proxied(r.image_url) } : null,
            title: s.title,
          };
        }),
      })),
    },
  };
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

export function registerWeekTools(server: MCPServer<SupabaseOAuthUser>) {
  server.tool(
    {
      name: "get_week",
      description:
        "The household's meal plan for the week containing `date` (default: today). Days without a slot show —.",
      inputSchema: z.object({ date: z.string().optional().describe("Any date in the week, YYYY-MM-DD") }),
      outputSchema: z.object({ week: Week }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const { week } = await readWeek(db, hid, input.date ?? new Date().toISOString().slice(0, 10));
        return ok(`Week of ${week.weekStart}:\n${weekText(week)}`, { week });
      }),
  );

  server.tool(
    {
      name: "set_slot",
      description:
        "Fill, change or clear one slot in the meal plan. Provide recipeId for a recipe, or title for free text ('eating out'); clear=true empties the slot. Any recipe may go in — winners from a round are not required.",
      inputSchema: z.object({
        date: z.string().describe("YYYY-MM-DD"),
        mealType: MealType.default("dinner"),
        recipeId: z.string().optional(),
        title: z.string().optional(),
        clear: z.boolean().optional(),
      }),
      outputSchema: z.object({ week: Week }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        if (!input.clear && !input.recipeId && !input.title) {
          throw new ToolError("Provide recipeId or title, or clear=true.");
        }
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
                recipe_id: input.recipeId ?? null,
                title: input.recipeId ? null : (input.title ?? null),
              })
              .select("title, recipes(title)")
              .single(),
            "slot",
          );
          what = (row.recipes as unknown as { title: string } | null)?.title ?? row.title ?? "";
        }
        const { week } = await readWeek(db, hid, input.date);
        return ok(
          `${dayName(input.date)} ${input.date}${input.mealType === "dinner" ? "" : ` (${input.mealType})`}: ${what}.`,
          { week },
        );
      }),
  );

  server.tool(
    {
      name: "show_week",
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
        const hid = await householdId(db);
        const { week } = await readWeek(db, hid, input.date ?? new Date().toISOString().slice(0, 10));
        const rounds = must(
          await db
            .from("rounds")
            .select("id")
            .eq("household_id", hid)
            .eq("status", "closed")
            .order("created_at", { ascending: false })
            .limit(1),
          "rounds",
        );
        let ranked: {
          recipeId: string;
          title: string;
          points: number;
          rank: number;
          imageUrl: string | null;
        }[] = [];
        if (rounds.length > 0) {
          const [candidates, rankings] = await Promise.all([
            must(
              await db
                .from("round_candidates")
                .select("recipe_id, recipes(id, title, image_url)")
                .eq("round_id", rounds[0].id),
              "candidates",
            ),
            must(
              await db
                .from("rankings")
                .select("member_id, ranking_entries(recipe_id, tier)")
                .eq("round_id", rounds[0].id),
              "rankings",
            ),
          ]);
          const { rankedList } = await import("../../packages/domain/mod.ts");
          const entries = rankings.flatMap((r) =>
            (
              r.ranking_entries as {
                recipe_id: string;
                tier: "S" | "A" | "B" | "C" | "D" | "F" | "GARBAGE";
              }[]
            ).map((e) => ({
              recipeId: e.recipe_id,
              memberId: r.member_id,
              tier: e.tier,
            })),
          );
          const list = rankedList(
            candidates.map((c) => c.recipe_id),
            entries,
          );
          const cardById = new Map(
            candidates.map((c) => [
              c.recipe_id,
              c.recipes as unknown as { title: string; image_url: string | null },
            ]),
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
