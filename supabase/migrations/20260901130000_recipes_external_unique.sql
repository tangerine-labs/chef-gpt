-- PostgREST upsert (ON CONFLICT (cookbook_id, external_id)) cannot target a partial index.
-- NULL external_ids never collide in a unique index, so the WHERE clause was unnecessary.
drop index if exists public.recipes_cookbook_external;
create unique index recipes_cookbook_external on public.recipes(cookbook_id, external_id);
