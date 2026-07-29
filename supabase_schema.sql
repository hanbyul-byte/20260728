-- Supabase / PostgreSQL schema for storing lottery draw results.
-- Run this in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.is_valid_lottery_numbers(nums integer[])
returns boolean
language plpgsql
immutable
as $$
declare
  n integer;
  i integer;
  j integer;
begin
  if nums is null or cardinality(nums) <> 6 then
    return false;
  end if;

  foreach n in array nums loop
    if n < 1 or n > 45 then
      return false;
    end if;
  end loop;

  for i in 1..array_length(nums, 1) loop
    for j in i + 1..array_length(nums, 1) loop
      if nums[i] = nums[j] then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

create table if not exists public.lottery_draws (
  id uuid primary key default gen_random_uuid(),
  draw_no integer unique,
  draw_date date not null unique,
  numbers integer[] not null,
  bonus_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lottery_draws_numbers_length check (cardinality(numbers) = 6),
  constraint lottery_draws_bonus_range check (bonus_number between 1 and 45),
  constraint lottery_draws_numbers_valid check (public.is_valid_lottery_numbers(numbers)),
  constraint lottery_draws_bonus_not_in_numbers check (not (bonus_number = any(numbers)))
);

create index if not exists lottery_draws_draw_date_idx on public.lottery_draws (draw_date desc);
create index if not exists lottery_draws_draw_no_idx on public.lottery_draws (draw_no desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_set_updated_at on public.lottery_draws;
create trigger trigger_set_updated_at
before update on public.lottery_draws
for each row
execute function public.set_updated_at();

alter table public.lottery_draws enable row level security;

drop policy if exists "Allow read access to lottery draws" on public.lottery_draws;
create policy "Allow read access to lottery draws"
on public.lottery_draws
for select
using (true);

drop policy if exists "Allow insert for authenticated users" on public.lottery_draws;
create policy "Allow insert for authenticated users"
on public.lottery_draws
for insert
to authenticated
with check (true);

drop policy if exists "Allow update for authenticated users" on public.lottery_draws;
create policy "Allow update for authenticated users"
on public.lottery_draws
for update
to authenticated
using (true)
with check (true);
