/**
 * Same-origin image proxy for views: `GET {PUBLIC_BASE}/img?u=<https url>`.
 * Views run under a CSP that only allows listed resource domains; routing every image through
 * here means user-added recipes with images on arbitrary hosts still render.
 */
import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { PUBLIC_BASE } from "./config.ts";

const MAX_BYTES = 8 * 1024 * 1024;

export function registerImageProxy(server: MCPServer<SupabaseOAuthUser>) {
  server.app.get(`${PUBLIC_BASE}/img`, async (c) => {
    const u = new URL(c.req.url).searchParams.get("u");
    let target: URL;
    try {
      target = new URL(u ?? "");
    } catch {
      return c.text("missing or invalid u", 400);
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") return c.text("unsupported scheme", 400);
    const upstream = await fetch(target, { headers: { accept: "image/*" }, redirect: "follow" });
    const type = upstream.headers.get("content-type") ?? "";
    const length = Number(upstream.headers.get("content-length") ?? 0);
    if (!upstream.ok || !type.startsWith("image/") || length > MAX_BYTES) {
      await upstream.body?.cancel();
      return c.text("not an image", 502);
    }
    return new Response(upstream.body, {
      headers: { "content-type": type, "cache-control": "public, max-age=86400" },
    });
  });
}
