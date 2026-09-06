/**
 * Prompts: the household's standing routines as one-click entry points (Claude Desktop lists them
 * in the "+" menu). Each is a user message that names the tools to use, in order, and when to
 * stop. Data is fetched by the tools, not embedded here, so a prompt is never stale.
 *
 * Arguments cannot autocomplete from the database: completion callbacks run without the caller's
 * token, so only static lists could be offered — none of these prompts have such an argument.
 */
import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { z } from "zod";

const user = (text: string) => ({
  messages: [{ role: "user" as const, content: { type: "text" as const, text: text.trim() } }],
});

const today = () => new Date().toISOString().slice(0, 10);

export function registerPrompts(server: MCPServer<SupabaseOAuthUser>) {
  server.prompt(
    {
      name: "plan-week",
      title: "Plan the week",
      description: "Fill the week's dinners from the latest ranked list, then offer to shop for them.",
      schema: z.object({
        date: z.string().optional().describe("Any date in the week to plan, YYYY-MM-DD (default: today)"),
      }),
    },
    ({ date }) =>
      user(`
Let's plan dinners for the week of ${date ?? today()}.
1. Call get_round_results for the latest closed round and get_week for that date.
2. For each dinner slot that is empty, propose one recipe from the ranked list, highest first, without repeating a recipe already planned this week. Show the whole proposal as a table before changing anything.
3. When I confirm or swap items, call set_slot per day using the recipe title (or title for free text like "eating out"). Leave days I say to skip empty.
4. When the week is filled, offer to add the ingredients of the chosen recipes to the shopping list with add_ingredients_from_recipe, one recipe at a time, and do it for the ones I pick.
If there is no closed round, say so and offer to start one with start_round instead.`),
  );

  server.prompt(
    {
      name: "start-round",
      title: "Start a voting round",
      description: "Put together a round of candidate dinners and open voting.",
      schema: z.object({
        candidates: z.number().int().min(2).max(20).optional().describe("How many candidates (default 8)"),
        participants: z
          .string()
          .optional()
          .describe("Who votes, comma-separated names (default: everyone in the household)"),
        theme: z
          .string()
          .optional()
          .describe("Optional steer, e.g. 'quick weeknight', 'veggie', 'kid-friendly'"),
      }),
    },
    ({ candidates, participants, theme }) =>
      user(`
Let's start a voting round with ${candidates ?? 8} candidate dinners${theme ? ` (${theme})` : ""}${participants ? ` for ${participants}` : " for everyone"}.
1. Call list_members so you know who is in the household.
2. Call search_recipes (several calls with different queries, cuisines or tags if needed) and pick ${candidates ?? 8} varied candidates; avoid retired recipes and ones planned in the current week (get_week).
3. Show me the candidates as a numbered list with cook time and cookbook, and ask me to confirm or swap any.
4. On confirmation, call create_round with the candidate titles${participants ? ` and participants ${participants}` : ""}. Then call open_voting so people can rank in the Vote app, and tell me who still needs to vote.`),
  );

  server.prompt(
    {
      name: "tonight",
      title: "What's for dinner tonight?",
      description: "Tonight's plan, its recipe, and what is missing from the shopping list.",
    },
    () =>
      user(`
What's for dinner tonight (${today()})?
1. Call get_week for today and find tonight's dinner slot.
2. If it is a recipe, call get_recipe by title and list_shopping_items. Tell me the dish, cook time, and which ingredients are not on the shopping list (compare by name, loosely).
3. Offer to add the missing ingredients with add_ingredients_from_recipe using the "only" filter, and to show the steps when I start cooking.
If tonight is empty, suggest two options from get_round_results (latest) that fit a weeknight, and set_slot the one I pick.`),
  );

  server.prompt(
    {
      name: "shopping-run",
      title: "Shopping run",
      description: "Read the list grouped by recipe, add what I dictate, clear what I bought.",
    },
    () =>
      user(`
I'm going shopping.
1. Call list_shopping_items and read the unchecked items grouped by the recipe they came from (loose items last), compact.
2. Ask what else to add and call add_shopping_item for each thing I mention; keep quantities as I say them.
3. While I shop, check off items I name with update_shopping_item (by item name). Confirm briefly, don't re-read the list each time.
4. When I say I'm done, call clear_checked and tell me what is still open.`),
  );

  server.prompt(
    {
      name: "onboard",
      title: "Set up the household",
      description: "Add the people who live here and invite the adults to connect their own Claude.",
    },
    () =>
      user(`
Help me set up my household.
1. Call get_household. If I am the only member, ask who lives here (first names are enough; kids too, they vote but need no account) and call add_member for each.
2. If any of my sign-in names look like email handles, offer to rename_member to a first name.
3. For each adult who will use their own Claude, call create_invite linked to their member and give me the invite link to forward. Explain in one line that signing in there joins the household and then shows how to add the chef-gpt connector.
4. Finish with a one-line summary of who is in the household and who still needs to join.`),
  );
}
