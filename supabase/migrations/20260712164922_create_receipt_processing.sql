alter table public.expenses
  add constraint expenses_id_user_id_key unique (id, user_id);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expense_id uuid,
  source text not null default 'image_ocr' check (source in ('image_ocr', 'hub_mf')),
  status text not null default 'uploading'
    check (status in ('uploading', 'queued', 'processing', 'needs_review', 'approved', 'failed')),
  storage_path text not null,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size between 1 and 10485760),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  merchant text,
  purchased_at date,
  total_amount numeric(12, 2) check (total_amount is null or total_amount >= 0),
  currency text not null default 'PLN' check (currency ~ '^[A-Z]{3}$'),
  confidence numeric(5, 4) check (confidence is null or confidence between 0 and 1),
  raw_ocr jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  parser_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, source_hash),
  foreign key (expense_id, user_id)
    references public.expenses (id, user_id)
    on delete set null (expense_id)
);

create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid,
  line_number integer not null check (line_number >= 0),
  name text not null check (char_length(trim(name)) between 1 and 240),
  quantity numeric(12, 3) check (quantity is null or quantity > 0),
  unit_price numeric(12, 2) check (unit_price is null or unit_price >= 0),
  total_price numeric(12, 2) not null check (total_price >= 0),
  confidence numeric(5, 4) check (confidence is null or confidence between 0 and 1),
  source_text text,
  source_bbox jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (receipt_id, line_number),
  foreign key (receipt_id, user_id)
    references public.receipts (id, user_id)
    on delete cascade,
  foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete restrict
);

create table public.receipt_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  worker_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (receipt_id),
  foreign key (receipt_id, user_id)
    references public.receipts (id, user_id)
    on delete cascade
);

create index receipts_user_created_at_idx
  on public.receipts (user_id, created_at desc);

create index receipts_user_status_idx
  on public.receipts (user_id, status);

create index receipt_items_receipt_idx
  on public.receipt_items (receipt_id, line_number);

create index receipt_processing_jobs_poll_idx
  on public.receipt_processing_jobs (status, available_at, created_at)
  where status = 'pending';

alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.receipt_processing_jobs enable row level security;

create policy "Users can read their own receipts"
  on public.receipts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own receipts"
  on public.receipts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own receipts"
  on public.receipts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own receipts"
  on public.receipts for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own receipt items"
  on public.receipt_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own receipt items"
  on public.receipt_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own receipt items"
  on public.receipt_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own receipt items"
  on public.receipt_items for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own receipt jobs"
  on public.receipt_processing_jobs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own receipt jobs"
  on public.receipt_processing_jobs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own receipt jobs"
  on public.receipt_processing_jobs for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.receipts from anon;
revoke all on table public.receipt_items from anon;
revoke all on table public.receipt_processing_jobs from anon;
grant select, insert, update, delete on table public.receipts to authenticated;
grant select, insert, update, delete on table public.receipt_items to authenticated;
grant select, insert, delete on table public.receipt_processing_jobs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipt-images',
  'receipt-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own receipt images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipt-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload their own receipt images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipt-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own receipt images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'receipt-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'receipt-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own receipt images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipt-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
