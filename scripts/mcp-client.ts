/**
 * A minimal MCP client for scripts: one token, JSON-RPC over Streamable HTTP with the
 * 2026-07-28 headers, and the response's Server-Timing kept for the bench.
 */
import { testUserToken } from "../server/test-users.ts";

export const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "mcp-call", version: "0" },
  "io.modelcontextprotocol/clientCapabilities": {
    extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } },
  },
};

/** A JSON-RPC envelope; callers know the shape of `result` for the method they sent. */
// biome-ignore lint/suspicious/noExplicitAny: shaped by the caller per method
export type Envelope = { result?: any; error?: any };

export type Rpc = {
  call: (
    method: string,
    params: Record<string, unknown>,
  ) => Promise<{ msg: Envelope; ms: number; timing: string }>;
};

export async function mcpClient(opts: { url: string; user?: "a" | "b"; local?: boolean }): Promise<Rpc> {
  const token = await testUserToken(opts.user ?? "a");
  const localServer = opts.local ? (await import("../server/.mcp-use/build/index.js")).default : null;
  return {
    async call(method, params) {
      const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { ...params, _meta: META } });
      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": method,
        authorization: `Bearer ${token}`,
      };
      const n = (params.name ?? params.uri) as string | undefined;
      if (n) headers["mcp-name"] = n;
      const req = new Request(opts.url, { method: "POST", headers, body });
      const s = performance.now();
      const res = localServer ? await localServer.fetch(req) : await fetch(req);
      const text = await res.text();
      const ms = performance.now() - s;
      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status} ${res.headers.get("www-authenticate") ?? ""}\n${text.slice(0, 500)}`,
        );
      }
      const line = text.split("\n").find((l) => l.startsWith("data:"));
      return {
        msg: JSON.parse(line ? line.slice(5) : text),
        ms,
        timing: res.headers.get("server-timing") ?? "",
      };
    },
  };
}

/** Parse `boot;dur=12;desc="worker ab12", handle;dur=3.4` into numbers and the worker id. */
export function parseServerTiming(h: string): {
  boot?: number;
  handle?: number;
  db?: number;
  dbCalls?: number;
  worker?: string;
} {
  const out: ReturnType<typeof parseServerTiming> = {};
  for (const part of h.split(",")) {
    const [name, ...attrs] = part.trim().split(";");
    const dur = attrs.find((a) => a.startsWith("dur="))?.slice(4);
    const desc = attrs
      .find((a) => a.startsWith("desc="))
      ?.slice(5)
      .replace(/^"|"$/g, "");
    if (name === "boot") {
      out.boot = Number(dur);
      out.worker = desc?.match(/worker (\S+)/)?.[1];
    } else if (name === "handle") out.handle = Number(dur);
    else if (name === "db") {
      out.db = Number(dur);
      out.dbCalls = Number(desc?.split(" ")[0]);
    }
  }
  return out;
}
