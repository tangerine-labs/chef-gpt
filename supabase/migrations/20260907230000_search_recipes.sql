-- Performance (docs/performance.md §5): search_recipes in one round trip. Scope (enabled
-- cookbooks, retired recipes), filters, exact total and the page come back together; only the
-- summary columns travel, not ingredients and instructions. Runs as the caller (RLS applies).

create or replace function public.search_recipes(
  q text default null,
  cuisine_q text default null,
  tag_q text default null,
  max_minutes integer default null,
  cookbook uuid default null,
  include_retired boolean default false,
  lim integer default 12
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  hid uuid := public.ensure_household();
  pattern text := case when q is null or q = '' then null
                       else '%' || replace(replace(q, '%', ''), '_', '') || '%' end;
  out jsonb;
begin
  with visible as (
    select c.id, c.name from cookbooks c
    where (cookbook is null or c.id = cookbook)
      and not exists (
        select 1 from household_cookbooks s
        where s.household_id = hid and s.cookbook_id = c.id and not s.enabled)
  ),
  gone as (select recipe_id from retired_recipes where household_id = hid),
  hits as (
    select r.id, r.title, r.description, r.cuisine, r.cook_time_minutes, r.tags, r.image_url,
           v.name as cookbook, exists (select 1 from gone g where g.recipe_id = r.id) as retired
    from recipes r join visible v on v.id = r.cookbook_id
    where (pattern is null or r.title ilike pattern or r.description ilike pattern)
      and (cuisine_q is null or r.cuisine ilike cuisine_q)
      and (tag_q is null or r.tags @> array[tag_q])
      and (max_minutes is null or r.cook_time_minutes <= max_minutes)
      and (include_retired or not exists (select 1 from gone g where g.recipe_id = r.id))
  ),
  page as (select h.*, count(*) over () as total from hits h order by h.title, h.id limit greatest(lim, 1))
  select jsonb_build_object(
    'total', coalesce(max(p.total), 0),
    'recipes', coalesce(jsonb_agg(to_jsonb(p) - 'total' order by p.title, p.id), '[]'::jsonb))
  into out from page p;
  return out;
end $$;

grant execute on function public.search_recipes(text, text, text, integer, uuid, boolean, integer) to authenticated;
