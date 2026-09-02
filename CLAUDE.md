# chef-gpt — agent notes

Household meal planning as MCP Apps on Supabase. Vocabulary: `CONTEXT.md` (use its terms exactly). Why things are the way they are: `docs/adr/`. Commands: `deno.json` tasks — Deno only, no Node/npm/pnpm anywhere (ADR 0004).

## Working on the server

- **Build before `server.fetch`.** mcp-use refuses to serve view-bound tools from source; tests and `--local` probes run against `server/.mcp-use/build/` (`deno task build`).
- **See a view with `deno task snap <tool> ['{json}'] [--dark] [--out png]`** — headless render of the deployed view as the test user (wraps `mcp-use screenshot`); then Read the PNG. Seed the test household first with `deno task mcp call …` so the panel has data. Never ship a view change without looking at it.
- **Click through a view live**: `deno task dev` (needs `server/package.json`, metadata only) with `MCP_URL=http://localhost:3000/functions/v1/chef/mcp MCP_ASSETS_URL=http://localhost:3000` — without those the dev views point their scripts at the deployed origin and hang on "Compiling…". Open `http://localhost:3000/functions/v1/chef/mcp/inspector`, add the localhost MCP URL, Authenticate (the owner signs in at the consent site; never paste tokens into browser fields), Execute a view tool, then drive it with the Chrome tools. Keep the window ≥1200 px wide or the Inspector goes single-column; typing letters outside a field triggers its keyboard shortcuts.
- **Probe the deployed server with `deno task mcp`** (`list`, `call <tool> '{json}'`, `read <uri>`; `--local`, `--user b`, `-v`). It handles the 2026-07-28 protocol headers (`Mcp-Method`, `Mcp-Name`, `params._meta`) and mints real test-user tokens — never hand-roll that curl.
- Tool handlers: `inputSchema`/`outputSchema` take `z.object(...)`, results need `structuredContent` or `isError: true` (`server/tools/results.ts` has `ok`/`guarded`). Data access only through `userDb(ctx.auth.accessToken)` so RLS applies (ADR 0003).
- Views: folder name under `server/views/` must equal `view.name`. Import across packages by **relative path** — the bundler resolves no Deno workspace aliases. Images in views go through the `/img` proxy (`proxied()` in `server/tools/rounds.ts`).
- Deploy: `deno task stage:edge`, then `supabase functions deploy chef --project-ref <ref> --no-verify-jwt`. A 500 from the deploy API is transient — retry once before digging.
- Anything a view lists must have a **deterministic order** (`position`, `created_at`, then `id`): batch inserts share a `created_at`, and Postgres reorders ties after an UPDATE, so rows visibly jump under an optimistic UI.

## Database

- No Docker on this machine → no `supabase start`. Migrations go straight to the linked dev project: `supabase db push -p "$SUPABASE_DEV_DB_PASSWORD"`, then regenerate `server/db.types.ts` with `supabase gen types typescript --linked --schema public`.
- PostgREST `upsert(onConflict)` cannot target a **partial** unique index — plain unique indexes only (NULLs never collide anyway).
- DB-backed tests hit the dev project as `test-a/b@chef-gpt.test` (`server/test-users.ts`) and self-skip without `.env`. Test files share one process: guard `Deno.env.set` with "only if unset". supabase-js leaves handles open — `sanitizeOps/Resources: false` on DB tests.

## Supabase platform traps (each cost real debugging time)

- The gateway rewrites `text/html` → `text/plain` on `*.supabase.co`; HTML lives on GitHub Pages (`site/`, deployed by `pages.yml` to https://tangerine-labs.com/chef-gpt/). Any path under it serves the app via the `404.html` fallback.
- Root `/.well-known/*` is unreachable; `server/edge.ts` rewrites the 401 `resource_metadata` URL to a function-scoped path and forwards it. The same shim re-bases every request URL on the public origin, because the internal proxy presents requests as `http://`.
- Dashboard: **Authorization Path resolves against Site URL** (Auth → URL Configuration), and leaving the OAuth Server page without Save loses the path. Provider credentials only take effect once the provider's *toggle* is on — verify with `curl $SUPABASE_URL/auth/v1/settings -H "apikey: $SUPABASE_ANON_KEY"` (`external` map).

## Claude Desktop

- It caches a connector's tool list; after deploying new tools either wait (it refreshed by itself within ~an hour) or toggle the connector off/on, **and start a new chat** (old chats keep their tool set). Re-auth is a silent bounce once consent exists. Its settings page splits view-bound tools into "Interactive tools" — add the two counts.
- Custom connectors reach the server from Anthropic's egress — localhost never works; test against the deployed dev function.

## Repo habits

- `biome` via `deno task fmt`/`lint`; read lint output in full (a `tail -1` once hid a CI-breaking error). Edits to a bash script that is currently running corrupt its parse — wizards included.
- Conventional-ish commits with the phase in the subject; every phase lands green (`deno task test`) and deployed before the commit.
