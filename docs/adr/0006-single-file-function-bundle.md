---
status: accepted
---
# Bundle the edge function into one module

Every request to the `chef` function ran in a fresh worker and took 1.4 s before our code did anything; `Server-Timing` showed 7 ms of handling. The performance doc read that as the platform's cost. It was not: on the same dev project a one-line function answers in 0.1 s, one that imports only supabase-js in 0.17 s, and one that imports mcp-use in 1.38 s. Workers are indeed never reused here (every response carries a new worker id, so "warm starts, plan-dependent" means none on this plan), but what the boot pays for is the module graph. `mcp-use@2.3.4` lists its CLI and inspector as runtime dependencies, which pull rolldown, vite, lightningcss and tailwind into the graph: 101 npm packages for a server that uses a handful. The platform bundles that whole graph at deploy and loads it on every boot.

`deno bundle` of the same imports into one file (868 KB minified) answered in 0.17 s per request, so `scripts/deploy.ts` now stages `server.js` (mcp-use's build, views external per ADR 0005) with the edge shim in a temp dir outside the workspace and bundles them into `supabase/functions/chef/bundle.js`; the tracked `index.ts` only imports it. Two packages stay external and resolve through the function's import map: `tslib`, whose CommonJS shape breaks under the bundler's interop (`Cannot destructure property '__extends'`), and `@mcp-use/client`, an optional import the server never takes.

## Consequences

- p50 per request fell from 1.4 s to 0.22 s for the floor and roughly halved for every tool (docs/performance.md, 2026-09-07 entry). The remaining time is our own PostgREST round trips.
- The temp dir is needed because `deno bundle` refuses a `deno.json` that is not a member of the repo workspace, and the function's import map must not join the workspace (it pins npm specifiers for the platform).
- `deno bundle` is marked experimental by Deno. If it breaks, the fallback is esbuild through `npm:esbuild` with the same externals; the shape of the fix does not depend on the tool.
- The bundle is minified and has no source map, so a stack trace in the function logs points into `bundle.js`. Reproduce locally instead: bundle the same way (the deploy script's steps) and `deno run -A --env-file=.env bundle.js`, then probe with `deno task mcp … --url http://localhost:8000/functions/v1/chef/mcp`.
- Tests and `deno task dev` still run mcp-use's own build; only the deployed artefact changes.
