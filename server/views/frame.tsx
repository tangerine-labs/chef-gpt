import type { ToolContextHandle } from "mcp-use/react";
import type { ReactNode } from "react";

/** Renders loading / error states of a tool context, then hands the structured output to the view. */
export function Frame({
  ctx,
  children,
}: {
  ctx: ToolContextHandle;
  children: (output: unknown) => ReactNode;
}) {
  if (ctx.status === "pending") return <main style={{ padding: 12 }}>Loading…</main>;
  if (ctx.status === "error")
    return <main style={{ padding: 12 }}>{String(ctx.error?.message ?? "Something went wrong")}</main>;
  return <>{children(ctx.toolOutput)}</>;
}
