/**
 * Renders loading / error states of a tool context, then hands the structured output to the view.
 * While pending, the sheet draws itself (packages/ui Sheet). Once the output is in, the frame
 * reports how long that took, plus the assets' timing, to /perf (docs/performance.md).
 */
import type { ToolContextHandle } from "mcp-use/react";
import { type ReactNode, useEffect } from "react";
import "../../packages/ui/signal.css";
import { Drawing, Notice } from "../../packages/ui/mod.ts";

const T0 = performance.now();
let reported = false;

/** The origin the view's own assets came from: the server, so /perf is same-origin for CSP. */
function assetOrigin(): string | null {
  const s = document.querySelector<HTMLScriptElement>("script[src]");
  try {
    return s ? new URL(s.src).origin : null;
  } catch {
    return null;
  }
}

function report(view: string) {
  if (reported) return;
  reported = true;
  const origin = assetOrigin();
  if (!origin) return;
  const assets = performance
    .getEntriesByType("resource")
    .filter((e) => e.name.startsWith(origin)) as PerformanceResourceTiming[];
  const body = JSON.stringify({
    view,
    host: navigator.userAgent.slice(0, 40),
    mountMs: Math.round(performance.now() - T0),
    assetMs: Math.round(Math.max(0, ...assets.map((a) => a.responseEnd)) || 0),
    assetBytes: assets.reduce((n, a) => n + (a.transferSize || 0), 0),
  });
  fetch(`${origin}/functions/v1/chef/perf`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function Frame({
  ctx,
  view,
  children,
}: {
  ctx: ToolContextHandle;
  view: string;
  children: (output: unknown) => ReactNode;
}) {
  const ready = ctx.status !== "pending" && ctx.status !== "error";
  useEffect(() => {
    if (ready) report(view);
  }, [ready, view]);

  if (ctx.status === "pending") return <Drawing />;
  if (ctx.status === "error")
    return <Notice tone="error">{String(ctx.error?.message ?? "Something went wrong")}</Notice>;
  return <>{children(ctx.toolOutput)}</>;
}
