import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.ts";
import type { Database } from "./db.types.ts";

export type Db = ReturnType<typeof userDb>;
export type Tables = Database["public"]["Tables"];
export type RecipeRow = Tables["recipes"]["Row"];
export type CookbookRow = Tables["cookbooks"]["Row"];

/** A Supabase client acting as the signed-in user: every query is subject to RLS. See ADR 0003. */
export function userDb(accessToken: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** The caller's household (v1: their first membership), created on first use. */
export async function householdId(db: Db): Promise<string> {
  const { data, error } = await db.rpc("ensure_household");
  if (error || !data) throw new Error(`ensure_household: ${error?.message ?? "no household"}`);
  return data;
}

export class ToolError extends Error {}

/** Throws a ToolError with the Postgres message; use on any query whose failure should reach the agent. */
export function must<T>(
  result: { data: T; error: { message: string } | null },
  what: string,
): NonNullable<T> {
  if (result.error) throw new ToolError(`${what}: ${result.error.message}`);
  if (result.data === null || result.data === undefined) throw new ToolError(`${what}: not found`);
  return result.data as NonNullable<T>;
}
