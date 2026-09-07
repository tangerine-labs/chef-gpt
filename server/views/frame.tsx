/**
 * Renders loading / error states of a tool context, then hands the structured output to the view.
 * While pending, the sheet draws itself (docs/design-system.md, States). Once the output is in,
 * the frame reports how long that took, plus the assets' timing, to /perf (docs/performance.md).
 */
import type { ToolContextHandle } from "mcp-use/react";
import { type CSSProperties, type ReactNode, useEffect } from "react";
import "../../packages/ui/signal.css";

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
    return (
      <div style={desk}>
        <div style={sheet}>
          <p style={err}>{String(ctx.error?.message ?? "Something went wrong")}</p>
        </div>
      </div>
    );
  return <>{children(ctx.toolOutput)}</>;
}

/** The sheet drawing itself: the dot grid fades in and four rules draw left to right, once. */
function Drawing() {
  return (
    <output style={{ ...desk, display: "block" }} aria-busy="true" aria-label="Loading">
      <style>{`
        @keyframes sg-rule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes sg-fade { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .sg-draw * { animation: none !important; } }
      `}</style>
      <div className="sg-draw" style={{ ...sheet, animation: "sg-fade 300ms ease both" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 1,
              background: "var(--sg-rule)",
              transformOrigin: "left",
              animation: `sg-rule 260ms ease ${120 + i * 110}ms both`,
              marginTop: i === 0 ? 8 : 44,
              opacity: i === 0 ? 1 : 0.5,
            }}
          />
        ))}
      </div>
    </output>
  );
}

const desk: CSSProperties = {
  background: "var(--sg-desk)",
  color: "var(--sg-print)",
  fontFamily: "var(--sg-body)",
  padding: 12,
};
const sheet: CSSProperties = {
  backgroundColor: "var(--sg-paper)",
  backgroundImage: "radial-gradient(circle, var(--sg-dot) 0.8px, transparent 1.1px)",
  backgroundSize: "10px 10px",
  border: "1px solid var(--sg-rule)",
  padding: 14,
  minHeight: 200,
};
const err: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
  color: "var(--sg-ink-red)",
  textDecoration: "underline",
  textDecorationColor: "var(--sg-ink-red)",
  textDecorationThickness: 2,
  textUnderlineOffset: 3,
};
