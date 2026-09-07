-- Performance samples (docs/performance.md §3): written by the bench script (service role),
-- the /perf endpoint views post to (service role), and read by nobody but us.
create table public.perf_samples (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  source text not null check (source in ('bench', 'view', 'tool')),
  name text not null,
  ms_total real not null,
  ms_boot real,
  ms_handle real,
  ms_db real,
  db_calls integer,
  worker text,
  region text,
  commit text,
  host text,
  extra jsonb
);
create index perf_samples_at_idx on public.perf_samples (at desc);
create index perf_samples_name_at_idx on public.perf_samples (source, name, at desc);

alter table public.perf_samples enable row level security;
-- No policies: anon and authenticated cannot read or write; the service role bypasses RLS.

-- p50 / p95 per source and name per day.
create view public.perf_daily
with (security_invoker = true) as
select
  date_trunc('day', at) as day,
  source,
  name,
  count(*) as samples,
  percentile_cont(0.5) within group (order by ms_total) as p50_ms,
  percentile_cont(0.95) within group (order by ms_total) as p95_ms,
  percentile_cont(0.5) within group (order by ms_db) as p50_db_ms,
  count(distinct worker) as workers
from public.perf_samples
group by 1, 2, 3
order by 1 desc, 2, 3;
