/**
 * The browser's way to the tools: one JSON-RPC call per tool, carrying the Supabase session's
 * access token as the bearer (the same token a chat host gets from consent), to the MCP endpoint
 * the connector uses. The household screens call this instead of the harness hooks (ADR 0007).
 */
import { MCP_ENDPOINT, META, PROTOCOL } from "./mcp-meta.ts";
import { supabase } from "./supabase.ts";

/** The tool said no (isError): its text is written for a person and can be shown as is. */
export class ToolError extends Error {}
/** No session, or one the server no longer accepts. */
export class NotSignedIn extends Error {}

type Envelope = {
  result?: { isError?: boolean; content?: { type: string; text?: string }[]; structuredContent?: unknown };
  error?: { message?: string };
};

export async function callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new NotSignedIn("Sign in to see your household.");
  const res = await fetch(`${__SUPABASE_URL__}${MCP_ENDPOINT}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL,
      "mcp-method": "tools/call",
      "mcp-name": name,
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args, _meta: META },
    }),
  });
  const text = await res.text();
  if (res.status === 401) throw new NotSignedIn("Your sign-in has expired. Sign in again.");
  if (!res.ok) throw new Error(`The server answered ${res.status}.`);
  const line = text.split("\n").find((l) => l.startsWith("data:"));
  const msg = JSON.parse(line ? line.slice(5) : text) as Envelope;
  if (msg.error) throw new Error(msg.error.message ?? "The call failed.");
  const r = msg.result;
  if (!r) throw new Error("The server sent no result.");
  if (r.isError) throw new ToolError(r.content?.map((c) => c.text ?? "").join("\n") || "That did not work.");
  return r.structuredContent as T;
}
