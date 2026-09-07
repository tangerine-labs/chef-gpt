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

**Reading, confirmed by the instrumentation below (2026-09-07, after deploy).** Every request runs in a fresh worker: 24 bench requests answered by 24 different worker ids. Inside the worker the costs are small: the isolate reaches our first module 76 to 120 ms after it starts, and handling a 404 takes 7 ms. The request still takes about 1.47 s, so roughly 1.3 s per request is spent by the platform outside the isolate, creating and tearing down a worker each time. Supabase's architecture guide says isolates "can remain active for a period (plan-dependent)"; on this project they do not.

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

So "always slow" is the platform's worker per request, and "some calls extra slow" is the tools with many sequential queries, plus the host's own round trips.

## 2. Instrument before optimising

Implemented in the `perf/instrument` branch; the numbers above come from it.

1. **`Server-Timing` header from the edge shim** (`server/edge.ts`, `server/timing.ts`): `boot;dur=<ms from isolate start to our first module>;desc="worker <id> age <ms>"`, `handle;dur=<ms inside server.fetch>`, `db;dur=<ms in PostgREST>;desc="<n> calls"`. The worker id is fixed for the life of a worker, so a changing id across responses means a boot per request. The shim also logs one JSON line per request (method, tool name, status, durations; no arguments, no user data) for the Logs Explorer. The bundle carries its own copy of `timing.ts`, so the state lives on `globalThis`.
2. **Database time** is charged by the `fetch` the user database client is created with (`userDb` in `server/db.ts`), so every tool is covered without touching handlers.
3. **Client-side truth.** `server/views/frame.tsx` posts `{view, mountMs, assetMs, assetBytes, host}` once per open to `/functions/v1/chef/perf` (same origin as the assets, so the views' CSP allows it); the endpoint (`server/perf.ts`) writes a `perf_samples` row through the service role. This is the number a person feels.

## 3. Continuous benchmarking

**Store** (done): `perf_samples` in our own Postgres (migration `20260907170000_perf.sql`): `at, source ('bench' | 'view' | 'tool'), name, ms_total, ms_boot, ms_handle, ms_db, db_calls, worker, region, commit, host, extra`. RLS on with no policies, so only the service role writes and reads. `perf_daily` gives p50 and p95 per source and name per day. Costs nothing, keeps the data ours.

**Bench** (done): `scripts/bench.ts` (`deno task bench`, `--runs N`, `--no-store`, `--enforce`) runs a fixed script as the test user (floor 404, well-known, whoami, get_household, get_week, search_recipes, show_week, show_shopping_list), prints p50/p95 with the `Server-Timing` split and the number of worker ids seen, and stores the rows with the commit. `scripts/deploy.ts` runs it after every deploy. `.github/workflows/bench.yml` runs it every six hours with `--enforce` once the secrets `SUPABASE_SERVICE_ROLE_KEY` and `TEST_USER_PASSWORD` are set on the repo; until then the job skips itself. The probe (`deno task mcp … -v`) prints the same header per call.

**Budgets** (first draft; every name is over today because of the floor, so `--enforce` stays off the deploy until the floor is addressed):

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
- **Cut round trips where the wait is felt.** A view open is tool call, then resource read, then assets. Assets are cached for a year after the first open; the tool and resource round trips each pay the 1.4 s floor today, which is why fixing the floor matters more than any view-side trick.

## 5. Fix the floor

`Server-Timing` says: a worker per request, and 1.3 s of the 1.5 s is outside the isolate. So the fixes are, in order of leverage:

1. **Ask Supabase why workers are not kept warm** on this project, with the evidence (worker ids, `boot;dur` under 120 ms, handle 7 ms, total 1.5 s, `x-deno-execution-id`). If warm isolates are a paid-plan feature, that is a plan decision, not code.
2. **If the platform will not reuse workers**, the MCP endpoint's host is the variable: ADR 0001 chose Supabase for one platform, and this cost was not visible then. Measure the same bench against a Deno Deploy or Fly deployment of the same bundle before deciding; the edge shim and the deploy script make that a small experiment.
3. **Inside the request**, worth doing regardless: one RPC per read tool instead of three to six PostgREST calls (`show_week`, `get_household`, `search_recipes` first), which also removes the per-call JWT check. Expect 400 to 500 ms off the heavy tools.
4. **The view's second round trip**: the resource read pays the floor again. Check whether the host caches `ui://` resources across opens; if not, the resource must be as cheap as possible on our side (it already is: 7 ms).

## 6. Cadence

- Every deploy: `deno task bench` prints the table; the deploy script refuses to finish if the floor regressed past budget.
- Weekly: look at `perf_daily` for the week, pick the worst name, change one thing, note it in this file under a dated heading.
- Every change to a tool that adds a query: run the bench before and after and put both numbers in the PR.
