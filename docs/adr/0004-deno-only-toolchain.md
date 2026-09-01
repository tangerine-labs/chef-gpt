---
status: accepted
---
# Deno is the only runtime and package manager, including for mcp-use's build

mcp-use's CLI is Node/Vite-based and its docs assume npm, so the safe assumption was "Node builds, Deno serves". A time-boxed spike on 2026-09-01 showed `deno run -A npm:mcp-use@2.3.4 build --inline` works unmodified with `nodeModulesDir: "auto"`: the bundle imports under Deno, views are inlined into the resource, and `tools/call` / `resources/read` behave to spec. We therefore run everything — build, tests, scripts, the edge function — on Deno via `deno task`, with a Deno workspace and no `package.json`, pnpm, or Node. If a future mcp-use release breaks under Deno's npm compatibility, the fallback is a root `package.json` + pnpm for tooling only, keeping Deno inside `supabase/functions/`.

## Consequences

- One toolchain to install (`deno`, `supabase`); CI is a Deno image.
- `nodeModulesDir: "auto"` means a `node_modules/` directory exists for npm deps; it is gitignored.
- The mcp-use inspector (`mcp-use dev`) also runs via `deno run -A npm:mcp-use dev` — verify on first use.
- Inlined views are large (~800 KB for a hello view). Acceptable for four views; revisit if hosts show latency.
