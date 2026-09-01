/**
 * Real users for DB-backed tests: created once via the service role in the dev project, then
 * signed in with a password to obtain the same ES256 access tokens Claude would send.
 * Tests that need them skip when the env is absent (e.g. CI without secrets).
 */
import { createClient } from "@supabase/supabase-js";

const url = Deno.env.get("SUPABASE_URL");
const anon = Deno.env.get("SUPABASE_ANON_KEY");
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const password = Deno.env.get("TEST_USER_PASSWORD");

export const dbTestsEnabled = Boolean(url && anon && service && password);

export async function testUserToken(name: "a" | "b"): Promise<string> {
  if (!url || !anon || !service || !password) throw new Error("DB test env missing");
  const email = `test-${name}@chef-gpt.test`;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${name.toUpperCase()}` },
  });
  if (error && !/already|exists|registered/i.test(error.message)) throw error;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !data.session) throw signInError ?? new Error("no session");
  return data.session.access_token;
}
