---
status: accepted
---
# Tenancy is enforced by Postgres Row Level Security, not application code

Every household-scoped table carries RLS policies keyed on `is_member_of(household_id)` (the caller's `auth.uid()` appears in `members`), and tool handlers query through `supabase-js` with the *user's* access token rather than a service role. System cookbooks (`household_id is null`) are readable by every authenticated user and writable only by the import script. The alternative — an ORM (Drizzle/Prisma) over the pooler with the service role and `where household_id = ?` in every query — is the predecessor project's pattern and is one forgotten clause away from a cross-household leak. Schema lives in plain SQL migrations under `supabase/migrations/`; TypeScript row types are generated with `supabase gen types`.

## Consequences

- A bug in a tool handler cannot read or write another household's data; the database refuses.
- Tests must include RLS negatives (a member of household A cannot see B).
- No ORM: queries are supabase-js builder calls or SQL functions; domain logic stays in `packages/domain`, which never touches I/O.
