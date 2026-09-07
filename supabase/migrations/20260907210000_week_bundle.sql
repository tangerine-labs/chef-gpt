-- Performance (docs/performance.md §5): the week view in one round trip instead of six.
-- Runs as the caller (security invoker) so every table read is under RLS; ensure_household is the
-- existing definer call, made here so the tool needs no separate round trip for the household.
-- The ranked-list arithmetic stays in packages/domain; this returns the raw pieces.

create or replace function public.week_bundle(monday date) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  hid uuid := public.ensure_household();
  pid uuid;
  rid uuid;
begin
  select id into pid from meal_plans where household_id = hid and week_start = monday;
  select id into rid from rounds
    where household_id = hid and status = 'closed'
    order by created_at desc, id desc limit 1;
  return jsonb_build_object(
    'household_id', hid,
    'plan_id', pid,
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
          'date', s.date, 'meal_type', s.meal_type, 'title', s.title,
          'recipe', case when r.id is null then null
                    else jsonb_build_object('id', r.id, 'title', r.title, 'image_url', r.image_url) end)
        order by s.date, s.meal_type, s.created_at, s.id)
      from slots s left join recipes r on r.id = s.recipe_id
      where s.meal_plan_id = pid), '[]'::jsonb),
    'round', case when rid is null then null else jsonb_build_object(
      'id', rid,
      'candidates', coalesce((
        select jsonb_agg(jsonb_build_object('recipe_id', c.recipe_id, 'title', r.title, 'image_url', r.image_url)
          order by c.position, c.recipe_id)
        from round_candidates c join recipes r on r.id = c.recipe_id
        where c.round_id = rid), '[]'::jsonb),
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object('member_id', k.member_id, 'recipe_id', e.recipe_id, 'tier', e.tier))
        from rankings k join ranking_entries e on e.ranking_id = k.id
        where k.round_id = rid), '[]'::jsonb)
    ) end
  );
end $$;

grant execute on function public.week_bundle(date) to authenticated;
