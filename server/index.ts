import { MCPServer } from "mcp-use";
import { oauthSupabaseProvider } from "mcp-use/oauth/supabase";
import { z } from "zod";
import { MCP_PATH, SITE_ORIGIN, SUPABASE_URL } from "./config.ts";
import { registerImageProxy } from "./img-proxy.ts";
import { registerRecipeTools } from "./tools/recipes.ts";

// Spike B: hello view + Supabase OAuth. Sign-in/consent pages live in site/ (GitHub Pages);
// Supabase will not serve HTML from *.supabase.co. Domain tools arrive in later phases.
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
});

server.tool(
  {
    name: "hello",
    description: "Smoke-test tool: greets the caller in a view.",
    inputSchema: z.object({ name: z.string().describe("Who to greet") }),
    outputSchema: z.object({ greeting: z.string() }),
    view: { name: "hello", description: "Greeting view" },
  },
  ({ name }) => {
    const greeting = `Hello, ${name}!`;
    return { content: [{ type: "text", text: greeting }], structuredContent: { greeting } };
  },
);

server.tool(
  {
    name: "whoami",
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
registerImageProxy(server);

export default server;
