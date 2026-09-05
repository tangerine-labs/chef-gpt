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

Always `deno task <name>` (or `deno run <name>`) — a bare `deno preview:snap` is parsed as a URL and fails with `Unsupported scheme "preview"`.

### Looking at views

Three tiers, cheapest first: fixture gallery → headless PNG of a deployed view → click through it live.

```sh
deno task preview                                          # fixture gallery in the browser (site/preview.html, every component in several states)
deno task preview:snap [--story "Vote"] [--dark] [--width 400] [--out x.png]   # same gallery, headless, no backend → PNG
deno task snap <tool> ['{json}'] [--dark] [--width 600] [--out x.png]          # a deployed view as the test user → PNG (needs .env)
deno task mcp list | call <tool> '{json}' | read <uri>     # poke the deployed server as the test user (seed data before snapping)
deno task dev                                              # mcp-use Inspector on localhost for real clicks
```

Screenshots land in `scratch/` at the repo root (gitignored): `preview.png`, `preview-<story>[-dark].png`, `snap-<tool>.png`. `--out <png>` names the file, `SNAP_DIR=<dir>` moves the directory; the script prints the path it wrote. Stories come from `site/src/fixtures.ts`, and `--story` must match the heading exactly — several contain an em dash, so quote it (`--story "Week plan — no round yet"`). `preview:snap --help` lists the flags.

## Layout

```
site/              sign-in + consent page for Supabase's OAuth server (GitHub Pages; Supabase won't serve HTML)
server/            mcp-use server: tools, views/
packages/domain/   pure domain logic (tiers, ranked list, week math)
packages/ui/       shared React primitives
supabase/          config, migrations, the `chef` edge function
scripts/           dev tooling: mcp-call (probe the server), snap + preview-snap (screenshots), setup-supabase.sh, recipe import
```
