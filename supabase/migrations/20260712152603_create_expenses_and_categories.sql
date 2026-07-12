create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  color text not null default '#3B82F6',
  icon text not null default 'tag',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index categories_user_name_lower_idx
  on public.categories (user_id, lower(name));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid,
  merchant text not null check (char_length(trim(merchant)) between 1 and 160),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'PLN' check (currency ~ '^[A-Z]{3}$'),
  spent_at date not null default current_date,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'receipt', 'bank')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete restrict
);

create index expenses_user_spent_at_idx
  on public.expenses (user_id, spent_at desc);

create index expenses_user_category_idx
  on public.expenses (user_id, category_id);

alter table public.categories enable row level security;
alter table public.expenses enable row level security;

create policy "Users can read their own categories"
  on public.categories
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own categories"
  on public.categories
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own categories"
  on public.categories
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own categories"
  on public.categories
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own expenses"
  on public.expenses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own expenses"
  on public.expenses
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own expenses"
  on public.expenses
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own expenses"
  on public.expenses
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.categories from anon;
revoke all on table public.expenses from anon;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;
