---
status: accepted
---
# Serve view assets from Supabase Storage instead of inlining them

`deno task build --inline` embeds every view's JavaScript and CSS in the server bundle, about 600 KB per view because React, react-dom and the MCP Apps runtime are repeated in each. With four views the bundle passed 2.6 MB, and `supabase functions deploy` failed six times in a row with `unexpected deploy status 500 … internal error` while the previous 2.60 MB bundle went through once. A 66 KB bundle then failed once and deployed on the next two tries, so the 500 is at least partly intermittent and the size threshold is not proven. What is certain: server-side bundling documents a 5 MB limit, inline views were heading there, and local bundling (20 MB) needs Docker, which this machine does not have (ADR 0004). Small bundles also deploy in seconds instead of minutes.

We keep the inline build for tests and local work, and deploy with external views: `MCP_ASSETS_URL` set at build time makes mcp-use write each view's assets to `server/.mcp-use/build/views/` and reference them by absolute URL from the manifest. `scripts/deploy.ts` uploads those files to a public `views` bucket on the same Supabase project and deploys the function, whose bundle is now about 70 KB.

## Consequences

- One command deploys both halves in the right order: `deno task deploy` (or `--prod`). Uploading the assets before the function means a live server never references a file that is not there. File names are content-hashed, so old assets can stay.
- The bucket shares the function's origin (`<ref>.supabase.co`), so the views' CSP (`resourceDomains`, auto-appended from the server origin) already allows it; no extra domain and no `text/html` rewrite problem, since only JS and CSS are served.
- Views load their runtime on demand instead of arriving inside the tool response; the first open of a view fetches roughly 600 KB, then caches for a year.
- `stage:edge` is gone; the deploy script stages. `deno task build` stays inline, so `deno task test` has no network dependency.
- Deploying to a project needs `SUPABASE_SERVICE_ROLE_KEY` in `.env` for the upload; it is never sent anywhere but the Storage API.
