# chef-gpt

Household meal planning as MCP Apps. Vote on dinners, plan the week, keep the shopping list — in Claude Desktop, by clicking or by asking.

See [CONTEXT.md](./CONTEXT.md) for the vocabulary and [docs/adr](./docs/adr) for why things are the way they are.

## Stack

Deno · Supabase (Postgres, Auth as OAuth 2.1 server, one Edge Function) · mcp-use v2 · React views · GitHub Pages for the auth page.

## First-time setup

```sh
scripts/setup-supabase.sh   # installs the Supabase CLI, creates projects, enables OAuth server + Google
```

It writes everything it collects to `.env` (see `.env.example`) and is safe to re-run.

## Develop

```sh
deno task test          # domain + server tests
deno task build         # bundle server + inline views → server/.mcp-use/build
deno task dev           # mcp-use inspector (views without a chat host)
deno task stage:edge    # build and copy the bundle into supabase/functions/chef
deno task build:site    # static auth site → site/dist (deployed by .github/workflows/pages.yml)
supabase functions deploy chef --project-ref <ref> --no-verify-jwt
```

## Layout

```
site/              sign-in + consent page for Supabase's OAuth server (GitHub Pages; Supabase won't serve HTML)
server/            mcp-use server: tools, views/
packages/domain/   pure domain logic (tiers, ranked list, week math)
packages/ui/       shared React primitives
supabase/          config, migrations, the `chef` edge function
scripts/           one-off scripts (recipe import)
```
