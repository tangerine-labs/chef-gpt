import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { z } from "zod";
import { AUTH_SITE_URL } from "../config.ts";
import { householdId, must, ToolError, userDb } from "../db.ts";
import { guarded, ok } from "./results.ts";

/** 8 unambiguous characters, shown as XXXX-XXXX. */
function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const raw = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

const pretty = (code: string) => (code.includes("-") ? code : `${code.slice(0, 4)}-${code.slice(4)}`);
const inviteLink = (code: string) => `${AUTH_SITE_URL}/?invite=${pretty(code)}`;

const Invite = z.object({
  code: z.string().describe("Give this to the person joining; single use"),
  expiresAt: z.string(),
  forMember: z.string().nullable().describe("Name of the existing member this invite links to, if any"),
  link: z.string().describe("Sign-in link with the code prefilled"),
});

export function registerHouseholdTools(server: MCPServer<SupabaseOAuthUser>) {
  server.tool(
    {
      name: "get_household",
      description: "The household the caller acts in: its name, members, and unused invite codes.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        household: z.object({ id: z.string(), name: z.string() }),
        members: z.array(z.object({ id: z.string(), name: z.string(), linked: z.boolean() })),
        invites: z.array(Invite),
      }),
    },
    (_input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const household = must(
          await db.from("households").select("id, name").eq("id", hid).maybeSingle(),
          "household",
        );
        const [members, invites] = await Promise.all([
          must(
            await db.from("members").select("id, name, user_id").eq("household_id", hid).order("created_at"),
            "members",
          ),
          must(
            await db
              .from("invites")
              .select("code, expires_at, members(name)")
              .eq("household_id", hid)
              .is("used_at", null)
              .gt("expires_at", new Date().toISOString()),
            "invites",
          ),
        ]);
        const out = {
          household,
          members: members.map((m) => ({ id: m.id, name: m.name, linked: m.user_id !== null })),
          invites: invites.map((i) => ({
            code: pretty(i.code),
            expiresAt: i.expires_at,
            forMember: (i.members as unknown as { name: string } | null)?.name ?? null,
            link: inviteLink(i.code),
          })),
        };
        const text = [
          `${household.name}`,
          `Members: ${out.members.map((m) => `${m.name}${m.linked ? "" : " (no account)"}`).join(", ")}`,
          out.invites.length
            ? `Open invites: ${out.invites.map((i) => i.code).join(", ")}`
            : "No open invites.",
        ].join("\n");
        return ok(text, out);
      }),
  );

  server.tool(
    {
      name: "create_invite",
      description:
        "Create a single-use invite code so another signed-in user can join this household. Optionally link it to an existing member (e.g. a kid who now gets an account) so they take over that member instead of appearing twice.",
      inputSchema: z.object({
        memberId: z.string().optional().describe("Existing member without an account to link the joiner to"),
        expiresInDays: z.number().int().min(1).max(30).default(7),
      }),
      outputSchema: z.object({ invite: Invite }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        let forMember: string | null = null;
        if (input.memberId) {
          const m = must(
            await db
              .from("members")
              .select("name, user_id")
              .eq("id", input.memberId)
              .eq("household_id", hid)
              .maybeSingle(),
            "member",
          );
          if (m.user_id) throw new ToolError(`${m.name} already has an account.`);
          forMember = m.name;
        }
        const expiresAt = new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString();
        const row = must(
          await db
            .from("invites")
            .insert({
              household_id: hid,
              code: inviteCode().replace("-", ""),
              member_id: input.memberId ?? null,
              created_by: ctx.auth.user.id,
              expires_at: expiresAt,
            })
            .select("code, expires_at")
            .single(),
          "create invite",
        );
        const code = pretty(row.code);
        const link = inviteLink(row.code);
        return ok(
          `Invite code ${code} (valid ${input.expiresInDays} days${forMember ? `, links to ${forMember}` : ""}). Send them ${link} — signing in there joins the household — or they can tell their assistant to join with the code.`,
          { invite: { code, expiresAt: row.expires_at, forMember, link } },
        );
      }),
  );

  server.tool(
    {
      name: "join_household",
      description:
        "Join another household with an invite code. That household becomes the one you act in; an untouched auto-created household of your own is removed.",
      inputSchema: z.object({ code: z.string().min(6) }),
      outputSchema: z.object({
        household: z.object({ id: z.string(), name: z.string() }),
        member: z.object({ id: z.string(), name: z.string() }),
      }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const { data, error } = await db.rpc("join_household", { invite_code: input.code });
        if (error)
          throw new ToolError(
            error.message.includes("invalid or expired")
              ? "That invite code is invalid or has expired."
              : `join: ${error.message}`,
          );
        const row = data?.[0];
        if (!row) throw new ToolError("join: no household returned");
        return ok(`Joined ${row.household_name} as ${row.member_name}.`, {
          household: { id: row.household_id, name: row.household_name },
          member: { id: row.member_id, name: row.member_name },
        });
      }),
  );

  server.tool(
    {
      name: "revoke_invite",
      description: "Cancel an unused invite code.",
      inputSchema: z.object({ code: z.string() }),
      outputSchema: z.object({ revoked: z.boolean() }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const code = input.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const rows = must(
          await db
            .from("invites")
            .delete()
            .eq("household_id", hid)
            .eq("code", code)
            .is("used_at", null)
            .select("id"),
          "revoke",
        );
        if (rows.length === 0) throw new ToolError("No unused invite with that code.");
        return ok(`Invite ${pretty(code)} revoked.`, { revoked: true });
      }),
  );
}
