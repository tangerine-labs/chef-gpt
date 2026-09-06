/** Small helpers for the shape mcp-use wants back from tool handlers. */
import type { ToolResult } from "mcp-use";
import { ToolError } from "../db.ts";

/**
 * Tool annotations: hosts use them to decide when to ask before calling and how to describe a
 * call. Every tool touches only its own database, so openWorldHint is false throughout.
 */
export const hints = {
  read: { readOnlyHint: true, openWorldHint: false },
  create: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  idempotent: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  destructive: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
} as const;

/** Text for the agent + structured content for views/typing. */
export function ok<T>(text: string, structured: T): ToolResult<T> {
  return { content: [{ type: "text", text }], structuredContent: structured };
}

/** Run a handler; ToolErrors become error results the agent can read instead of a crash. */
export async function guarded<T>(fn: () => Promise<ToolResult<T>>): Promise<ToolResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ToolError) return { content: [{ type: "text", text: e.message }], isError: true };
    throw e;
  }
}
