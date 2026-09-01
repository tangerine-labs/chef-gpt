// Supabase Edge Function entry. `server.js` (the mcp-use bundle with views inlined) and
// `edge.ts` are staged here by `deno task stage:edge`.
import { createEdgeHandler } from "./edge.ts";
import server from "./server.js";

Deno.serve(createEdgeHandler((req) => server.fetch(req)));
