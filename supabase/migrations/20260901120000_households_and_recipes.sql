-- Phase 2: households, members, cookbooks, recipes, retired recipes. See CONTEXT.md for terms.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  locale      text not null default 'en',
  created_at  timestamptz not null default now()
);

create table public.members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null,
  created_at    timestamptz not null default now()
);
create unique index members_household_user on public.members(household_id, user_id) where user_id is not null;
create index members_user on public.members(user_id);

create table public.cookbooks (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid references public.households(id) on delete cascade,  -- null = system cookbook
  name          text not null,
  slug          text not null,
  created_at    timestamptz not null default now()
);
create unique index cookbooks_system_slug on public.cookbooks(slug) where household_id is null;
create unique index cookbooks_household_slug on public.cookbooks(household_id, slug) where household_id is not null;

-- Only rows for system cookbooks; absent = enabled.
create table public.household_cookbooks (
  household_id  uuid not null references public.households(id) on delete cascade,
  cookbook_id   uuid not null references public.cookbooks(id) on delete cascade,
  enabled       boolean not null default true,
  primary key (household_id, cookbook_id)
);

create table public.recipes (
  id                  uuid primary key default gen_random_uuid(),
  cookbook_id         uuid not null references public.cookbooks(id) on delete cascade,
  source              text,
  external_id         text,
  title               text not null,
  description         text not null default '',
  image_url           text,
  url                 text,
  cook_time_minutes   integer,
  difficulty          text,
  cuisine             text,
  tags                text[] not null default '{}',
  servings            text,
  ingredients         jsonb not null default '[]',   -- [{ text, name, quantity, unit }]
  instructions        text[] not null default '{}',
  allergens           text[] not null default '{}',
  based_on_recipe_id  uuid references public.recipes(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index recipes_cookbook_external on public.recipes(cookbook_id, external_id) where external_id is not null;
create index recipes_cookbook on public.recipes(cookbook_id);
create index recipes_title_trgm on public.recipes using gin (to_tsvector('simple', title || ' ' || description));

create table public.retired_recipes (
  household_id  uuid not null references public.households(id) on delete cascade,
  recipe_id     uuid not null references public.recipes(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (household_id, recipe_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_member_of(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.household_id = hid and m.user_id = auth.uid());
$$;

create or replace function public.cookbook_household(cid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.cookbooks where id = cid;
$$;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger recipes_updated_at before update on public.recipes for each row execute function public.set_updated_at();

-- A signed-in user with no household gets one, with themselves as a member and a default cookbook.
create or replace function public.ensure_household() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  display text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select household_id into hid from public.members where user_id = uid order by created_at limit 1;
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.cookbooks enable row level security;
alter table public.household_cookbooks enable row level security;
alter table public.recipes enable row level security;
alter table public.retired_recipes enable row level security;

create policy households_member on public.households
  for all to authenticated using (public.is_member_of(id)) with check (public.is_member_of(id));

create policy members_member on public.members
  for all to authenticated using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

create policy cookbooks_read on public.cookbooks
  for select to authenticated using (household_id is null or public.is_member_of(household_id));
create policy cookbooks_write on public.cookbooks
  for insert to authenticated with check (household_id is not null and public.is_member_of(household_id));
create policy cookbooks_update on public.cookbooks
  for update to authenticated using (household_id is not null and public.is_member_of(household_id));
create policy cookbooks_delete on public.cookbooks
  for delete to authenticated using (household_id is not null and public.is_member_of(household_id));

create policy household_cookbooks_member on public.household_cookbooks
  for all to authenticated using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

create policy recipes_read on public.recipes
  for select to authenticated using (
    public.cookbook_household(cookbook_id) is null or public.is_member_of(public.cookbook_household(cookbook_id))
  );
create policy recipes_write on public.recipes
  for insert to authenticated with check (
    public.cookbook_household(cookbook_id) is not null and public.is_member_of(public.cookbook_household(cookbook_id))
  );
create policy recipes_update on public.recipes
  for update to authenticated using (
    public.cookbook_household(cookbook_id) is not null and public.is_member_of(public.cookbook_household(cookbook_id))
  );
create policy recipes_delete on public.recipes
  for delete to authenticated using (
    public.cookbook_household(cookbook_id) is not null and public.is_member_of(public.cookbook_household(cookbook_id))
  );

create policy retired_member on public.retired_recipes
  for all to authenticated using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

-- ---------------------------------------------------------------------------
-- Seed: system cookbooks + public image bucket
-- ---------------------------------------------------------------------------
insert into public.cookbooks (household_id, name, slug) values
  (null, 'Aarstiderne', 'aarstiderne'),
  (null, 'HelloFresh', 'hellofresh');

insert into storage.buckets (id, name, public) values ('recipe-images', 'recipe-images', true)
  on conflict (id) do nothing;
create policy recipe_images_public_read on storage.objects for select to public using (bucket_id = 'recipe-images');
