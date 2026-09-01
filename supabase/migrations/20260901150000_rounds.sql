-- Phase 4: planning rounds and rankings. See CONTEXT.md → Round, Ranking, Tier, Ranked list.

create type public.round_status as enum ('open', 'closed');
create type public.tier as enum ('S', 'A', 'B', 'C', 'D', 'F', 'GARBAGE');

create table public.rounds (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  label         text not null default '',
  status        public.round_status not null default 'open',
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create index rounds_household on public.rounds(household_id, created_at desc);

create table public.round_candidates (
  round_id   uuid not null references public.rounds(id) on delete cascade,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  position   integer not null default 0,
  primary key (round_id, recipe_id)
);

create table public.round_participants (
  round_id   uuid not null references public.rounds(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  primary key (round_id, member_id)
);

create table public.rankings (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references public.rounds(id) on delete cascade,
  member_id     uuid not null references public.members(id) on delete cascade,
  submitted_at  timestamptz not null default now(),
  unique (round_id, member_id)
);

create table public.ranking_entries (
  ranking_id  uuid not null references public.rankings(id) on delete cascade,
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  tier        public.tier not null,
  primary key (ranking_id, recipe_id)
);

create or replace function public.round_household(rid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.rounds where id = rid;
$$;

-- Results are visible only after close; closing happens automatically when the last
-- participant submits (or explicitly via close_round). Re-submissions replace the ranking
-- and do not re-trigger anything once closed.
create or replace function public.maybe_close_round() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.rounds r
     set status = 'closed', closed_at = now()
   where r.id = new.round_id
     and r.status = 'open'
     and not exists (
       select 1 from public.round_participants p
        where p.round_id = r.id
          and not exists (select 1 from public.rankings k where k.round_id = r.id and k.member_id = p.member_id)
     );
  return new;
end $$;
create trigger rankings_maybe_close after insert on public.rankings
  for each row execute function public.maybe_close_round();

alter table public.rounds enable row level security;
alter table public.round_candidates enable row level security;
alter table public.round_participants enable row level security;
alter table public.rankings enable row level security;
alter table public.ranking_entries enable row level security;

create policy rounds_member on public.rounds
  for all to authenticated using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));
create policy round_candidates_member on public.round_candidates
  for all to authenticated using (public.is_member_of(public.round_household(round_id)))
  with check (public.is_member_of(public.round_household(round_id)));
create policy round_participants_member on public.round_participants
  for all to authenticated using (public.is_member_of(public.round_household(round_id)))
  with check (public.is_member_of(public.round_household(round_id)));
create policy rankings_member on public.rankings
  for all to authenticated using (public.is_member_of(public.round_household(round_id)))
  with check (public.is_member_of(public.round_household(round_id)));
create policy ranking_entries_member on public.ranking_entries
  for all to authenticated using (
    public.is_member_of(public.round_household((select round_id from public.rankings k where k.id = ranking_id)))
  ) with check (
    public.is_member_of(public.round_household((select round_id from public.rankings k where k.id = ranking_id)))
  );
