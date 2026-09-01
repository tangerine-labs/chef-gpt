-- Phase 5: meal plans and slots. See CONTEXT.md → Meal plan, Slot.

create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');

create table public.meal_plans (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  week_start    date not null,  -- always a Monday; normalised in the server
  created_at    timestamptz not null default now(),
  unique (household_id, week_start)
);

create table public.slots (
  id            uuid primary key default gen_random_uuid(),
  meal_plan_id  uuid not null references public.meal_plans(id) on delete cascade,
  date          date not null,
  meal_type     public.meal_type not null default 'dinner',
  recipe_id     uuid references public.recipes(id) on delete set null,
  title         text,
  created_at    timestamptz not null default now(),
  unique (meal_plan_id, date, meal_type),
  check (recipe_id is not null or title is not null)
);

create or replace function public.plan_household(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.meal_plans where id = pid;
$$;

alter table public.meal_plans enable row level security;
alter table public.slots enable row level security;

create policy meal_plans_member on public.meal_plans
  for all to authenticated using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));
create policy slots_member on public.slots
  for all to authenticated using (public.is_member_of(public.plan_household(meal_plan_id)))
  with check (public.is_member_of(public.plan_household(meal_plan_id)));
