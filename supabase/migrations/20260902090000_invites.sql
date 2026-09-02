-- Phase 3: invites and joining a household. See CONTEXT.md → Invite, Member.

create table public.invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  code          text not null unique,
  member_id     uuid references public.members(id) on delete set null,  -- link the joiner to an existing member
  created_by    uuid references auth.users(id) on delete set null,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  used_by       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index invites_household on public.invites(household_id, created_at desc);

alter table public.invites enable row level security;
create policy invites_member on public.invites
  for all to authenticated using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

-- A user may belong to several households; v1 acts on the most recently joined one.
create or replace function public.ensure_household() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  display text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select household_id into hid from public.members where user_id = uid order by created_at desc limit 1;
  if hid is not null then return hid; end if;

  select coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    split_part(u.email, '@', 1)
  ) into display from auth.users u where u.id = uid;

  insert into public.households (name) values (display || '''s household') returning id into hid;
  insert into public.members (household_id, user_id, name) values (hid, uid, display);
  insert into public.cookbooks (household_id, name, slug) values (hid, 'Our recipes', 'our-recipes');
  return hid;
end $$;

-- True when a household holds nothing but its default cookbook and a single member.
create or replace function public.household_is_untouched(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.members where household_id = hid) <= 1
     and not exists (select 1 from public.recipes r join public.cookbooks c on c.id = r.cookbook_id where c.household_id = hid)
     and not exists (select 1 from public.rounds where household_id = hid)
     and not exists (select 1 from public.meal_plans where household_id = hid)
     and not exists (select 1 from public.shopping_items where household_id = hid)
     and not exists (select 1 from public.invites where household_id = hid);
$$;

-- Redeem an invite as the signed-in user. Runs as definer because the joiner is not yet a member.
create or replace function public.join_household(invite_code text)
returns table (household_id uuid, household_name text, member_id uuid, member_name text)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv public.invites%rowtype;
  display text;
  mid uuid;
  mname text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into inv from public.invites i
   where i.code = upper(regexp_replace(invite_code, '[^A-Za-z0-9]', '', 'g'))
     and i.used_at is null and i.expires_at > now();
  if inv.id is null then raise exception 'invalid or expired invite code'; end if;

  select m.id, m.name into mid, mname from public.members m where m.household_id = inv.household_id and m.user_id = uid;
  if mid is null then
    select coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
      into display from auth.users u where u.id = uid;
    if inv.member_id is not null and exists (select 1 from public.members m where m.id = inv.member_id and m.user_id is null) then
      update public.members m set user_id = uid where m.id = inv.member_id returning m.id, m.name into mid, mname;
    else
      insert into public.members (household_id, user_id, name) values (inv.household_id, uid, display) returning id, name into mid, mname;
    end if;
    update public.invites i set used_at = now(), used_by = uid where i.id = inv.id;
    -- Drop the joiner's own untouched auto-created household(s) so the joined one is the active one.
    delete from public.households h
     where h.id <> inv.household_id
       and exists (select 1 from public.members m where m.household_id = h.id and m.user_id = uid)
       and public.household_is_untouched(h.id);
  end if;

  return query select h.id, h.name, mid, mname from public.households h where h.id = inv.household_id;
end $$;

grant execute on function public.join_household(text) to authenticated;
