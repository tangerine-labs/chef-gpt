---
status: accepted
---
# The website's household screens call the MCP tools over HTTP

The organizer runs the household from Claude Desktop. Everyone else in it was stuck: to vote, a partner needed a paid Claude plan with custom connectors or the organizer's screen, and nobody had the shopping list on their phone in the shop, because the apps render in the desktop client. The invite flow already lands people on the website, signed in. So the website gets three screens for signed-in members, phone first: the week, the vote and the shopping list (`site/src/household/`, at `household/{week,vote,shopping}` under the site base). Round builder, recipes, cookbooks and invites stay in Claude: the organizer says it, the page shows it.

Three ways to give those screens data were on the table.

1. **supabase-js straight to Postgres** under Row Level Security, from the browser. Reads are trivial, but the rules (closing a round when the last ranking lands, ranked-list points, name resolution, the ranked list beside the week) live in `server/tools/`, about two thousand lines. The website would grow a second copy.
2. **The MCP tools over HTTP**, the way `scripts/mcp-client.ts` already calls them: one JSON-RPC `tools/call` per action, the Supabase session's access token as the bearer. The server accepts that token as is, because it is the same kind of token a chat host gets from consent (`server/test-users.ts` mints one by password sign-in for every test).
3. **The built view bundles in an iframe** with a small host speaking the MCP Apps protocol. Faithful to the harness, but the presentational components are already split out (`packages/ui/views/`, props in, callbacks out) and render on the landing page today; a host shim would add a layer to reproduce what a wrapper does in thirty lines.

**Decision: 2.** `site/src/mcp.ts` is the browser's client; `site/src/household/screens.tsx` wires each presentational view to the tools exactly as `server/views/<name>/view.tsx` wires it to the harness, minus the follow-up messages to the chat. The tool's structured output is the screen's initial data; every callback calls the tool the harness would and hands the view what comes back. `site/src/mcp-meta.ts` holds the wire constants (protocol version, `_meta`), shared with the scripts.

## Consequences

- The server sends CORS headers for the site origin (`SITE_URL`'s origin) and localhost, and for nobody else (`cors` in `server/index.ts`; `server/server_test.ts` covers the preflight, a readable 401 and a stranger origin). Chat hosts send no `Origin` and are unaffected. No new auth path: the session token is the bearer.
- The logic lives once. A rule changed in a tool changes on the website and in Claude at the same time.
- Every screen costs one tool call, so one worker boot and one database round trip (about half a second from Europe; `docs/performance.md`). Acceptable for a page a member opens a few times a week; a screen that needed several calls would want a bundling tool.
- Members who want the website need a user: they sign in. Kids can register too. A vote link for a member without a user would need a round-scoped token and its own auth path; not built, and not planned until a household asks.
- The screens have no chat to narrate to. What the harness said as a follow-up ("Emma has voted, 2 of 3") the screen says in its own result line, or not at all.
- Verifying the screens means a real session: `deno task snap:household` builds the site, injects test user A's session into `localStorage` the way supabase-js stores it, and screenshots the three screens against the deployed dev server (the CORS has to be deployed for the browser to get through).
