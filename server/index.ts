import { MCPServer } from "mcp-use";
import { oauthSupabaseProvider } from "mcp-use/oauth/supabase";
import { z } from "zod";
import { AUTH_SITE_URL, MCP_PATH, SITE_ORIGIN, SUPABASE_URL } from "./config.ts";
import { registerImageProxy } from "./img-proxy.ts";
import { registerPerf } from "./perf.ts";
import { registerHouseholdTools } from "./tools/households.ts";
import { registerMemberTools } from "./tools/members.ts";
import { registerRecipeTools } from "./tools/recipes.ts";
import { hints } from "./tools/results.ts";
import { registerRoundTools } from "./tools/rounds.ts";
import { registerShoppingTools } from "./tools/shopping.ts";
import { registerWeekTools } from "./tools/week.ts";

/** The website's origin: its household screens call the tools from the browser (ADR 0007). */
const SITE = new URL(AUTH_SITE_URL).origin;
const LOCAL_SITE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/; // `deno task dev:site`

// Sign-in/consent pages live in site/ (GitHub Pages); Supabase will not serve HTML from *.supabase.co.
const server = new MCPServer({
  name: "chef-gpt",
  version: "0.0.1",
  description: "Household meal planning: vote on dinners, plan the week, keep the shopping list.",
  basePath: MCP_PATH,
  oauth: oauthSupabaseProvider({
    supabaseUrl: SUPABASE_URL,
    resource: `${SITE_ORIGIN}${MCP_PATH}`,
    resourceName: "chef-gpt",
  }),
  // Chat hosts send no Origin and are unaffected; a browser on the site gets its origin reflected.
  cors: {
    origin: (o) => (o !== null && (o === SITE || LOCAL_SITE.test(o)) ? o : null),
    allowedHeaders: [
      "authorization",
      "content-type",
      "accept",
      "mcp-protocol-version",
      "mcp-method",
      "mcp-name",
      "mcp-session-id",
    ],
  },
});

server.tool(
  {
    name: "whoami",
    title: "Who am I",
    annotations: hints.read,
    description: "Smoke-test tool: returns the signed-in user's id and email.",
    inputSchema: z.object({}),
    outputSchema: z.object({ userId: z.string().nullable(), email: z.string().nullable() }),
  },
  (_args, ctx) => {
    const out = { userId: ctx.auth.user.id ?? null, email: ctx.auth.user.email ?? null };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
);

registerRecipeTools(server);
registerMemberTools(server);
registerHouseholdTools(server);
registerRoundTools(server);
registerWeekTools(server);
registerShoppingTools(server);
registerImageProxy(server);
registerPerf(server);

export default server;
