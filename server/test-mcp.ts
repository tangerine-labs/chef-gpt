/** Shared helper for DB-backed tests: JSON-RPC tools/call against the built server bundle. */

export const ORIGIN = Deno.env.get("SUPABASE_URL") ?? "https://abcdefgh.supabase.co";

const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "tools-test", version: "0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

export type Result = {
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type Server = { fetch: (req: Request) => Promise<Response> };

export async function callTool(
  server: Server,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<Result> {
  const res = await server.fetch(
    new Request(`${ORIGIN}/functions/v1/chef/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/call",
        "mcp-name": name,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args, _meta: META },
      }),
    }),
  );
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data:"));
  const msg = JSON.parse(line ? line.slice(5) : text);
  if (msg.error) throw new Error(`${name}: ${JSON.stringify(msg.error)}`);
  return msg.result as Result;
}
