import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { z } from "zod";
import { householdBundle, householdId, must, userDb } from "../db.ts";
import { resolveMember } from "./resolve.ts";
import { guarded, hints, ok } from "./results.ts";

export const Member = z.object({
  id: z.string(),
  name: z.string(),
  linked: z.boolean().describe("Whether this member is linked to a signed-in user"),
});

export function registerMemberTools(server: MCPServer<SupabaseOAuthUser>) {
  server.tool(
    {
      name: "list_members",
      title: "List members",
      annotations: hints.read,
      description: "People in the household who can vote. Members without a linked user are typically kids.",
      inputSchema: z.object({}),
      outputSchema: z.object({ members: z.array(Member) }),
    },
    (_input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const members = (await householdBundle(db)).members.map((m) => ({
          id: m.id,
          name: m.name,
          linked: m.user_id !== null,
        }));
        return ok(members.map((m) => `- ${m.name}${m.linked ? "" : " (no account)"}`).join("\n"), {
          members,
        });
      }),
  );

  server.tool(
    {
      name: "add_member",
      title: "Add member",
      annotations: hints.create,
      description: "Add a member to the household — someone who votes but need not have an account (a kid).",
      inputSchema: z.object({ name: z.string().min(1) }),
      outputSchema: z.object({ member: Member }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const m = must(
          await db
            .from("members")
            .insert({ household_id: hid, name: input.name.trim() })
            .select("id, name, user_id")
            .single(),
          "add member",
        );
        return ok(`Added ${m.name}.`, { member: { id: m.id, name: m.name, linked: false } });
      }),
  );

  server.tool(
    {
      name: "rename_member",
      title: "Rename member",
      annotations: hints.idempotent,
      description:
        "Rename a member of the household (e.g. turn a sign-in handle into a first name). Name them as they are called now, or pass memberId.",
      inputSchema: z.object({
        member: z.string().optional().describe("Current name"),
        memberId: z.string().optional(),
        name: z.string().min(1).describe("New name"),
      }),
      outputSchema: z.object({ member: Member }),
    },
    (input, ctx) =>
      guarded(async () => {
        const db = userDb(ctx.auth.accessToken);
        const hid = await householdId(db);
        const who = await resolveMember(db, hid, input);
        const m = must(
          await db
            .from("members")
            .update({ name: input.name.trim() })
            .eq("id", who.id)
            .eq("household_id", hid)
            .select("id, name, user_id")
            .maybeSingle(),
          "member",
        );
        return ok(`Renamed ${who.name} to ${m.name}.`, {
          member: { id: m.id, name: m.name, linked: m.user_id !== null },
        });
      }),
  );
}
