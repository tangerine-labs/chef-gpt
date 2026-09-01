---
status: accepted
---
# Run the whole stack on Supabase, not Vercel

chef-gpt needs a remote MCP server with OAuth 2.1 for Claude Desktop, a multi-tenant Postgres, and user sign-in — and as little infrastructure as possible while it grows from one family to a few friends. We run everything on Supabase: one Edge Function (Deno) hosts the MCP endpoint, the MCP App views, and the sign-in/consent pages; Supabase Auth is the OAuth 2.1 authorization server (dynamic client registration enabled, since Claude uses DCR and Supabase has no client-ID-metadata-document support yet); Supabase Postgres holds the data. The alternative — Next.js on Vercel with a hosted identity provider (Clerk/WorkOS) — was the default in the predecessor project and works, but it is a second platform and a second auth vendor for no gain at this scale.

## Consequences

- The function cannot serve root `/.well-known/*`; the MCP server answers `401 + WWW-Authenticate: Bearer resource_metadata=…` instead, as Claude's docs prescribe for this exact setup. mcp-use hard-codes that URL at the origin root, so `server/edge.ts` rewrites it to `/functions/v1/chef/.well-known/oauth-protected-resource` and forwards that path to mcp-use's handler.
- The function is deployed with `verify_jwt = false` and validates tokens itself, so unauthenticated requests get the correct challenge header.
- We must build and host the OAuth consent screen ourselves (Supabase does not provide one) — and not on Supabase: its gateway rewrites `text/html` to `text/plain` on `*.supabase.co` (HTML needs a Pro-plan custom domain), so the sign-in/consent page is a static client-side site in `site/` on GitHub Pages, talking to Supabase Auth with the public anon key.
- Per-request limits (2 s CPU, 150–400 s wall clock) rule out long-running work in tools; anything heavy becomes a script or a scheduled job.
