-- Performance (docs/performance.md §5): every read tool in one round trip. Each function runs as
-- the caller (security invoker) so RLS applies to every table it reads, calls ensure_household
-- itself so the tool needs no separate round trip for the household, and returns raw rows as JSON;
-- the shaping stays in server/tools/*. Lists keep the orders the tools used (created_at, id).

create or replace function public.household_bundle() returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  hid uuid := public.ensure_household();
begin
  return jsonb_build_object(
    'household', (select jsonb_build_object('id', h.id, 'name', h.name) from households h where h.id = hid),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'user_id', m.user_id) order by m.created_at, m.id)
      from members m where m.household_id = hid), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('code', i.code, 'expires_at', i.expires_at, 'member_name', m.name)
        order by i.created_at desc, i.id)
      from invites i left join members m on m.id = i.member_id
      where i.household_id = hid and i.used_at is null and i.expires_at > now()), '[]'::jsonb)
  );
end $$;

create or replace function public.recipe_scope() returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  hid uuid := public.ensure_household();
begin
  return jsonb_build_object(
    'household_id', hid,
    'cookbooks', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'household_id', c.household_id)
        order by c.household_id nulls last, c.name, c.id)
      from cookbooks c), '[]'::jsonb),
    'settings', coalesce((
      select jsonb_agg(jsonb_build_object('cookbook_id', s.cookbook_id, 'enabled', s.enabled))
      from household_cookbooks s where s.household_id = hid), '[]'::jsonb),
    'retired', coalesce((
      select jsonb_agg(r.recipe_id) from retired_recipes r where r.household_id = hid), '[]'::jsonb)
  );
end $$;

create or replace function public.shopping_bundle() returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  hid uuid := public.ensure_household();
begin
  return jsonb_build_object(
    'household_id', hid,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', i.id, 'name', i.name, 'quantity', i.quantity, 'unit', i.unit, 'checked', i.checked,
          'recipe_id', i.recipe_id, 'recipe_title', r.title)
        order by i.position, i.created_at, i.id)
      from shopping_items i left join recipes r on r.id = i.recipe_id
      where i.household_id = hid), '[]'::jsonb)
  );
end $$;

-- One round with everything the round tools read: the row, participants with names, who has
-- voted, candidate cards, and every ranking entry. `rid` names the round; when null, the latest
-- round of the household with status `want`. Null when there is no such round.
create or replace function public.round_bundle(rid uuid, want public.round_status) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  hid uuid := public.ensure_household();
  r rounds%rowtype;
begin
  if rid is not null then
    select * into r from rounds where id = rid;
  else
    select * into r from rounds where household_id = hid and status = want
      order by created_at desc, id desc limit 1;
  end if;
  if r.id is null then return null; end if;
  return jsonb_build_object(
    'household_id', hid,
    'round', jsonb_build_object('id', r.id, 'label', r.label, 'status', r.status, 'created_at', r.created_at),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('member_id', p.member_id, 'name', m.name) order by m.created_at, m.id)
      from round_participants p join members m on m.id = p.member_id where p.round_id = r.id), '[]'::jsonb),
    'voted', coalesce((select jsonb_agg(k.member_id) from rankings k where k.round_id = r.id), '[]'::jsonb),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
          'recipe_id', c.recipe_id, 'title', x.title, 'description', x.description, 'cuisine', x.cuisine,
          'cook_time_minutes', x.cook_time_minutes, 'image_url', x.image_url)
        order by c.position, c.recipe_id)
      from round_candidates c join recipes x on x.id = c.recipe_id where c.round_id = r.id), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object('member_id', k.member_id, 'recipe_id', e.recipe_id, 'tier', e.tier))
      from rankings k join ranking_entries e on e.ranking_id = k.id where k.round_id = r.id), '[]'::jsonb)
  );
end $$;

grant execute on function public.household_bundle() to authenticated;
grant execute on function public.recipe_scope() to authenticated;
grant execute on function public.shopping_bundle() to authenticated;
grant execute on function public.round_bundle(uuid, public.round_status) to authenticated;
