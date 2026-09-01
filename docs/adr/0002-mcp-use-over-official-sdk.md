---
status: accepted
---
# Use mcp-use v2 rather than the official SDK + ext-apps directly

Both paths produce spec-compliant MCP Apps on Supabase Edge Functions. We chose mcp-use v2 because it ships the pieces we would otherwise write and maintain by hand: a Supabase OAuth provider (protected-resource metadata, DCR proxying, JWKS verification, the 401 challenge), React views with host-context hooks, a stateless Streamable HTTP transport over Hono, and a local inspector for iterating on views without a chat host. The official SDK + `@modelcontextprotocol/ext-apps` + Hono is Supabase's own documented path and would keep us framework-agnostic on the UI side, but its auth is entirely do-it-yourself.

## Consequences

- Views are React only; the design system is React + CSS modules.
- mcp-use depends on a fork of `@modelcontextprotocol/ext-apps` tracking the SDK v2 migration; we accept that until upstream catches up. We only use the standard `ui://` / `_meta.ui` surface it emits, never mcp-use-specific host behaviour.
- mcp-use's build tooling is Node-based; see ADR 0004 for how that meets a Deno runtime.
- There is no in-memory test client; tool tests go through `server.fetch(new Request(...))` with JSON-RPC bodies, which is how mcp-use tests itself.
