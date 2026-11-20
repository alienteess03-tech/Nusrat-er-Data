-- নুসরাতের সংসার: shared household database
-- Supabase Dashboard → SQL Editor-এ পুরো ফাইলটি একবার Run করুন।

create table if not exists public.household_state (
  id text primary key check (id = 'main'),
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  initialized boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.household_state enable row level security;

-- Browser roles cannot read or modify the family account directly.
revoke all on table public.household_state from public, anon, authenticated;
grant all privileges on table public.household_state to service_role;

insert into public.household_state (id, state, revision, initialized)
values ('main', '{}'::jsonb, 0, false)
on conflict (id) do nothing;
