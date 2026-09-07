# Performance: what we know, how we measure, what we do

Performance is a loop, not a fix: measure, set a budget, change one thing, measure again. This document is the loop's home. Numbers here are from 2026-09-07 against the dev project, probed from Copenhagen (Cloudflare PoP CPH, runtime region eu-central-1).

## 1. What we know today

End-to-end through `deno task mcp call` (includes ~0.5 s of Deno start-up and token minting on the probe side):

| Call | Time |
|---|---|
| whoami | 2.0 s |
| get_household | 2.1 s |
| show_week | 2.5 s |
| get_week | 2.7 s |
| search_recipes | 2.8 s |

Server-only, with curl, time to first byte (connect and TLS are under 20 ms):

| Request | TTFB |
|---|---|
| GET `…/.well-known/oauth-protected-resource` (no auth, no DB) | 1.42 to 1.52 s |
| POST `/mcp` initialize, no token, answers 401 | 1.46 s |
| GET `/img?u=…` (proxies one small image) | 1.64 s |
| GET a path that does not exist, answers 404 | 2.13 s |
| Six concurrent 404s | 1.43 to 1.67 s each |
| Three back-to-back 404s | 1.42 to 1.46 s each |

The view asset fetch is fine: 630 KB in 70 to 100 ms, `cache-control: public, max-age=31536000`, Cloudflare cache HIT.

**Reading (2026-09-07, corrected the same evening).** Every request runs in a fresh worker: 24 bench requests answered by 24 different worker ids, and the same holds for a one-line function on this project, so "isolates can remain active for a period (plan-dependent)" means no reuse on this plan. The first reading blamed the platform for the 1.3 s outside the isolate. It was our module graph: a one-line function boots in 0.1 s, one importing supabase-js in 0.17 s, one importing mcp-use in 1.38 s, because mcp-use lists its CLI and inspector as runtime dependencies and the platform loads all 101 packages on every boot. Bundling the function into one module (ADR 0006) took the floor to 0.22 s; the log at the end has the numbers.

On top of that floor, tools spend 200 to 800 ms in the handler, of which 130 to 630 ms is two to six PostgREST round trips (`get_household` 4 calls, `show_week` 6). A view open pays the floor twice (tool call, then resource read) and then fetches 630 KB of assets, which are cached for a year after the first open.

| Bench, p50 after deploy | total | handle | db | calls |
|---|---|---|---|---|
| floor (404) | 3371 ms | 7 | 0 | 0 |
| whoami | 1605 | 208 | 0 | 0 |
| get_household | 2211 | 697 | 533 | 4 |
| get_week | 2199 | 758 | 545 | 3 |
| search_recipes | 2009 | 613 | 489 | 5 |
| show_week | 2447 | 802 | 629 | 6 |
| show_shopping_list | 1679 | 253 | 130 | 2 |

(The floor reads 1.4 to 1.5 s from a single curl and 3.3 s in the bench right after a deploy; the platform side varies, ours does not.)

So "always slow" was our module graph loaded on every boot (fixed, ADR 0006), and "some calls extra slow" is the tools with many sequential queries, plus the host's own round trips.

## 2. Instrument before optimising

Implemented in the `perf/instrument` branch; the numbers above come from it.

1. **`Server-Timing` header from the edge shim** (`server/edge.ts`, `server/timing.ts`): `boot;dur=<ms from isolate start to our first module>;desc="worker <id> age <ms>"`, `handle;dur=<ms inside server.fetch>`, `db;dur=<ms in PostgREST>;desc="<n> calls"`. The worker id is fixed for the life of a worker, so a changing id across responses means a boot per request. The shim also logs one JSON line per request (method, tool name, status, durations; no arguments, no user data) for the Logs Explorer. The bundle carries its own copy of `timing.ts`, so the state lives on `globalThis`.
2. **Database time** is charged by the `fetch` the user database client is created with (`userDb` in `server/db.ts`), so every tool is covered without touching handlers.
3. **Every MCP request** becomes a `perf_samples` row (source `tool`, `server/request-log.ts`): arrival time, method, tool name, status, our handle and database time, worker id and the host's user agent. It is the only record of what a host actually sends per tool call and when; the bench cannot show that. Written through the service role after the response, via `EdgeRuntime.waitUntil`.
4. **Client-side truth.** `server/views/frame.tsx` posts `{view, mountMs, assetMs, assetBytes, host}` once per open to `/functions/v1/chef/perf` (same origin as the assets, so the views' CSP allows it); the endpoint (`server/perf.ts`) writes a `perf_samples` row through the service role. This is the number a person feels.

## 3. Continuous benchmarking

**Store** (done): `perf_samples` in our own Postgres (migration `20260907170000_perf.sql`): `at, source ('bench' | 'view' | 'tool'), name, ms_total, ms_boot, ms_handle, ms_db, db_calls, worker, region, commit, host, extra`. RLS on with no policies, so only the service role writes and reads. `perf_daily` gives p50 and p95 per source and name per day. Costs nothing, keeps the data ours.

**Bench** (done): `scripts/bench.ts` (`deno task bench`, `--runs N`, `--no-store`, `--enforce`) runs a fixed script as the test user (floor 404, well-known, whoami, get_household, get_week, search_recipes, show_week, show_shopping_list), prints p50/p95 with the `Server-Timing` split and the number of worker ids seen, and stores the rows with the commit. `scripts/deploy.ts` runs it after every deploy. `.github/workflows/bench.yml` runs it every six hours with `--enforce` once the secrets `SUPABASE_SERVICE_ROLE_KEY` and `TEST_USER_PASSWORD` are set on the repo; until then the job skips itself. The probe (`deno task mcp … -v`) prints the same header per call.

**Budgets** (first draft; every name is inside at p50 since the read bundles, the p95 flags that remain are single slow platform boots, so `--enforce` can go on the deploy once a few days of `perf_daily` confirm the p95):

| Name | p95 budget |
|---|---|
| any request floor (404) | 300 ms |
| whoami | 500 ms |
| get_week, get_household | 700 ms |
| search_recipes | 900 ms |
| view mount, warm assets | 1.5 s after the tool result |

**Platform reports, no code**: Supabase → Edge Functions → the function's Metrics tab shows invocations and execution time; the Logs Explorer's `function_edge_logs` has `execution_time_ms` and "booted (time: …)" events per worker, which also answers the boot question directly. Free tier keeps one day of logs, so the table above is where history lives.

**Sentry?** It would give traces per request with database spans and error grouping, and `@sentry/deno` runs in Edge Functions. It also adds a vendor, an SDK on every boot (which is the thing we suspect), and a free tier that is fine for errors but thin for performance sampling. Recommendation: not yet. Server-Timing plus our own table answers the current question with zero boot cost. Revisit Sentry when we have users and want error alerting with stack traces.

## 4. Handling the wait, without a spinner

- **Draw the sheet.** The design system's loading states: the dot grid fades in and the rules draw themselves, the notepad rolls down, the tier rows are ruled one stroke at a time. Under a second, once, then the content lands. Implement as the `pending` branch of `server/views/frame.tsx`, one drawing per view.
- **Optimistic already.** Week plan and Shopping list show the change before the server answers and revert in red if it refuses; keep that pattern for Vote's submit (show "rated" on the roster at once).
- **Print what we know first.** A view receives its tool result in one go, so there is nothing to stream, but the host shows the tool's text while the iframe loads; keep the text results short and useful so the wait reads as progress.
- **Cut round trips where the wait is felt.** A view open is tool call, then resource read, then assets. Assets are cached for a year after the first open; the tool and resource round trips each pay the 0.22 s floor plus the tool's own queries, which is why the read tools' round trips matter more than any view-side trick.

## 5. Fix the floor

Done for the boot (ADR 0006): the function deploys as one module and the floor is 0.22 s. What is left, in order of leverage:

1. **One RPC per read tool** instead of three to six PostgREST calls. Done: `week_bundle`, `household_bundle`, `recipe_scope`, `shopping_bundle`, `round_bundle` (see the log). Every read tool is inside its budget at p50. From a fresh worker each call costs 100 to 150 ms and the first also pays the TLS handshake to the public gateway; `get_household` (4 calls), `search_recipes` (5) and `show_week` (6) spend 530 to 660 ms there. A Postgres function per tool, run as the caller so RLS still applies, brings each to one round trip: expect 400 to 500 ms off the heavy tools and the budgets within reach.
2. **Region.** Done: MCP requests that land outside Europe are redirected to eu-central-1 with `forceFunctionRegion` (see the log). The hosts call from the US, and from there every database call and the JWKS fetch crossed the Atlantic.
3. **Warm workers** would remove the remaining 0.2 s per request. Supabase ties the idle period to the plan; check what Pro gives before paying for it, since the bench answers the question in one run.
4. **The view's second round trip**: the resource read pays the floor again. Check whether the host caches `ui://` resources across opens; if not, the resource must be as cheap as possible on our side (it already is: 7 ms).
5. Not a lever: connection pooling. The function never opens a Postgres connection; supabase-js speaks HTTP to PostgREST, which holds its own pool. Hyperdrive is a Cloudflare Workers binding, and Supabase Edge Functions are Deno workers behind Cloudflare's CDN, not Workers.

## 6. Cadence

- Every deploy: `deno task bench` prints the table; the deploy script refuses to finish if the floor regressed past budget.
- Weekly: look at `perf_daily` for the week, pick the worst name, change one thing, note it in this file under a dated heading.
- Every change to a tool that adds a query: run the bench before and after and put both numbers in the PR.

## 7. Log

### 2026-09-07 · one-module bundle (ADR 0006)

Bench p50 in ms, 5 runs, dev project, before → after:

| Name | before | after | handle | db | calls |
|---|---|---|---|---|---|
| floor (404) | 1402 | 225 | 7 | 0 | 0 |
| whoami | 1739 | 364 | 129 | 0 | 0 |
| get_household | 2235 | 971 | 709 | 534 | 4 |
| get_week | 1860 | 625 | 386 | 252 | 3 |
| search_recipes | 2137 | 987 | 769 | 606 | 5 |
| show_week | 2059 | 939 | 726 | 594 | 6 |
| show_shopping_list | 1689 | 697 | 434 | 260 | 2 |

Method: deployed `ping` (one line), `ping-sb` (imports supabase-js), `ping-heavy` (imports what chef imports) and `ping-bundled` (ping-heavy through `deno bundle`, tslib and @mcp-use/client external) next to chef on the dev project and timed each: 0.10, 0.17, 1.38 and 0.17 s per request, all with a new worker id per request. Region pinning (`x-region: eu-north-1`, the database's region) was rerouted to eu-central-1 and changed nothing. The experiment functions were deleted afterwards.

### 2026-09-07 · week in one round trip (`week_bundle`)

`show_week` made six PostgREST calls in sequence (household, plan, slots, latest round, candidates, rankings); `get_week` three. A security-invoker Postgres function now returns the week's slots and the latest closed round as one JSON document, RLS applied as the caller, and the ranked-list arithmetic stays in `packages/domain`. The bench also warms the function up once before timing, so the 404 row no longer measures the post-deploy first hit.

| Name | before | after | handle | db | calls |
|---|---|---|---|---|---|
| show_week | 939 | 460 | 252 | 86 | 1 |
| get_week | 625 | 491 | 257 | 133 | 1 |

p50 in ms, 3 runs, dev project. The same shape fits `get_household` (4 calls) and `search_recipes` (5).

### 2026-09-07 · every read tool in one round trip

Four more security-invoker functions, same shape as `week_bundle`: `household_bundle` (household, members, open invites), `recipe_scope` (cookbooks, the household's enabled flags, retired ids), `shopping_bundle` (the list with recipe titles) and `round_bundle` (a round with participants, who voted, candidate cards and every ranking entry; by id or the latest with a status). Each calls `ensure_household` itself, so no tool pays a separate household round trip. `search_recipes` keeps its filtered PostgREST query and is two calls; the round tools went from four to seven calls each to one or two.

| Name | before | after | handle | db | calls |
|---|---|---|---|---|---|
| get_household | 768 | 496 | 273 | 76 | 1 |
| search_recipes | 1023 | 626 | 368 | 216 | 2 |
| show_shopping_list | 590 | 413 | 204 | 73 | 1 |
| show_week | 460 | 417 | 202 | 84 | 1 |
| get_week | 491 | 481 | 259 | 142 | 1 |

p50 in ms, 3 runs, dev project. What is left per request is the 0.22 s boot, the host's own round trips, and 200 to 370 ms of handler time that is mostly the one PostgREST call from a cold worker (TLS to the public gateway included).

### 2026-09-07 · search_recipes in one round trip

The query itself was never slow: 1129 recipes, the filtered `ilike` with an exact count answers in 50 to 80 ms from a laptop. The tool cost was two sequential PostgREST calls from a cold worker (scope, then the query) and `select *` carrying ingredients and instructions for every hit. `search_recipes(q, cuisine_q, tag_q, max_minutes, cookbook, include_retired, lim)` now does scope, filters, exact total and the page in one call and returns summary columns only; the tool's text and structured output are unchanged (diffed before and after on two queries).

| Name | before | after | handle | db | calls |
|---|---|---|---|---|---|
| search_recipes | 626 | 538 | 317 | 169 | 1 |

What remains on every tool call is 150 to 220 ms of handler time with no database in it (`whoami` shows it alone): mcp-use's Supabase provider verifies the bearer token against the project's JWKS, and with a fresh worker per request that is a fetch per call. The tokens are ES256, so the provider's `jwtSecret` shortcut (HS256, local) does not apply; the fix would be a verifier with the public keys embedded at deploy time and the remote set as fallback for an unknown key id.

### 2026-09-07 · what a host's tool call costs, measured

A search through the claude.ai connector, bracketed from a Claude Code session with the request log on:

- The host sends **one request** per tool call (`tools/call`, user agent `Claude-User`); no initialize or tools/list before it. The server is stateless (no session id), so there is nothing to re-establish.
- The request reached us about 2 s after the model emitted the call (5.4 s minus roughly 3 s of the model's own turn). Our handle time was 1.3 s on that call (two PostgREST calls at 854 ms, the slow end of the cold-worker range; #9 makes it one call), 0.45 to 0.95 s on repeats.
- So a search that feels like ten seconds in Claude Desktop is mostly the model's turns around the call (thinking before it, reading a 6.5 KB result after it) plus about 2 s of connector transit; the server's share is under a second and now visible per request in `perf_samples`.
- Claude Desktop's own log showed the views' perf post blocked by CORS (the view document's origin is `claudemcpcontent.com`); the endpoint now answers preflight and sends `access-control-allow-origin: *`, so view samples will start arriving.
- Side effect of the after-response hand-off: the platform kept a worker alive until the log insert finished and routed the next request to it. That request handled in 83 ms with a 75 ms database call. Workers can be reused here; what decides it is pending work.

### 2026-09-07 · Claude Desktop's search, measured, and the region fix

The request log caught a search from Claude Desktop: a `server/discover` (571 ms) and, a second later, the `tools/call` (1306 ms, of which 1025 ms was two database calls). The same two calls take 200 to 300 ms from the bench. The difference is where the worker runs: Supabase runs a request in the region closest to its caller, Anthropic calls from the US, and every PostgREST call (and the JWKS fetch) then crosses the Atlantic with a fresh handshake. Forcing the region with the `forceFunctionRegion` query parameter reproduces both ends:

| function region | tool call | database, 2 calls |
|---|---|---|
| us-east-1 | 1418 to 1699 ms | 832 to 849 ms |
| eu-central-1 | 667 to 860 ms | 193 to 325 ms |

eu-north-1, the database's own region, is not in Supabase's list of function regions; eu-central-1 is the nearest. The edge shim now answers a 307 to the same URL with `forceFunctionRegion=eu-central-1` for MCP requests that land outside Europe (`SB_REGION`), and leaves forced requests alone. The claude.ai connector follows it: its next search ran in 476 ms with 234 ms of database time, against 1306 and 1025 before. The redirect itself is one cheap boot in the far region (about 0.33 s to first byte from us-east-1).

Of the 12 s the person saw in Desktop, the server accounted for about 2.4 s across the two requests before the fix and about 1.2 s after; the rest is the model's turns around the call and the connector's transit.
