create table if not exists public.ice_cream_app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ice_cream_app_state_updated_at on public.ice_cream_app_state;

create trigger set_ice_cream_app_state_updated_at
before update on public.ice_cream_app_state
for each row
execute function public.set_updated_at();

alter table public.ice_cream_app_state enable row level security;

drop policy if exists "Anyone can read booth app state" on public.ice_cream_app_state;
drop policy if exists "Anyone can insert booth app state" on public.ice_cream_app_state;
drop policy if exists "Anyone can update booth app state" on public.ice_cream_app_state;

create policy "Anyone can read booth app state"
on public.ice_cream_app_state
for select
to anon
using (true);

create policy "Anyone can insert booth app state"
on public.ice_cream_app_state
for insert
to anon
with check (true);

create policy "Anyone can update booth app state"
on public.ice_cream_app_state
for update
to anon
using (true)
with check (true);
