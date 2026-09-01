-- Phase 6: the household's single shopping list. See CONTEXT.md → Shopping list, Item.

create table public.shopping_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  quantity      text,
  unit          text,
  recipe_id     uuid references public.recipes(id) on delete set null,
  checked       boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index shopping_items_household on public.shopping_items(household_id, checked, position);

alter table public.shopping_items enable row level security;
create policy shopping_items_member on public.shopping_items
  for all to authenticated using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));
