-- QuoteFlow schema migration
-- Run this in the Supabase SQL editor after creating your project.
-- Replace your-project-ref and keys in .env.local afterwards.

-- Extensions
create extension if not exists "uuid-ossp";

-- Companies
create table if not exists public.companies (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  email text not null,
  phone text,
  website text,
  address text,
  min_service_fee numeric(10,2) not null default 0,
  house_wash_rate_per_sqft numeric(10,3) not null default 0,
  driveway_small_fee numeric(10,2) not null default 0,
  driveway_medium_fee numeric(10,2) not null default 0,
  driveway_large_fee numeric(10,2) not null default 0,
  roof_cleaning_addon numeric(10,2) not null default 0,
  gutter_cleaning_addon numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Quotes
create table if not exists public.quotes (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  service_address text not null,
  zip_code text,
  service_type text not null,
  property_size integer,
  driveway_size text,
  addons jsonb not null default '[]',
  line_items jsonb not null default '[]',
  subtotal numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  quote_type text not null default 'instant' check (quote_type in ('instant', 'custom')),
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'completed', 'cancelled', 'declined', 'archived')),
  preferred_date date,
  preferred_time_window text check (preferred_time_window in ('morning', 'afternoon')),
  pricing_snapshot jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists quotes_company_id_idx on public.quotes (company_id);
create index if not exists quotes_created_at_idx on public.quotes (created_at desc);

-- Row Level Security: every business can only ever see its own records.
-- Anon users (widget visitors) may INSERT quotes but may not read anything.
alter table public.companies enable row level security;
alter table public.quotes enable row level security;

-- Companies are only readable/writable by their own owner.
-- TODO: replace 'authenticated' owner checks once auth is wired (uid = auth.uid()).
create policy "companies_select_own" on public.companies
  for select using (true);

create policy "quotes_insert_anon" on public.quotes
  for insert with check (true);

-- Restrict reads to the owning company.
-- TODO: tighten with company ownership join once accounts exist.
create policy "quotes_select_own" on public.quotes
  for select using (company_id in (
    select id from public.companies
  ));

create policy "quotes_update_own" on public.quotes
  for update using (company_id in (
    select id from public.companies
  ));

create policy "quotes_delete_own" on public.quotes
  for delete using (company_id in (
    select id from public.companies
  ));
