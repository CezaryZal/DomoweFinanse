alter table public.receipt_processing_jobs
  add column lease_expires_at timestamptz;

update public.receipt_processing_jobs
set lease_expires_at = now() + interval '15 minutes'
where status = 'processing';

alter table public.receipt_processing_jobs
  add constraint receipt_processing_jobs_processing_lease_check
  check (status <> 'processing' or lease_expires_at is not null);

drop index public.receipt_processing_jobs_poll_idx;

create index receipt_processing_jobs_poll_idx
  on public.receipt_processing_jobs (status, available_at, lease_expires_at, created_at)
  where status in ('pending', 'processing');

create or replace function public.claim_receipt_processing_job(
  p_worker_id text,
  p_lease_seconds integer,
  p_max_attempts integer
)
returns table (
  job_id uuid,
  receipt_id uuid,
  user_id uuid,
  attempts integer,
  parser_variant text,
  storage_path text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.receipt_processing_jobs%rowtype;
begin
  if char_length(trim(coalesce(p_worker_id, ''))) = 0 then
    raise exception 'Worker id is required';
  end if;
  if p_lease_seconds not between 60 and 3600 then
    raise exception 'Lease must be between 60 and 3600 seconds';
  end if;
  if p_max_attempts not between 1 and 10 then
    raise exception 'Max attempts must be between 1 and 10';
  end if;

  with exhausted as (
    update public.receipt_processing_jobs as job
    set status = 'failed',
        completed_at = now(),
        worker_id = null,
        lease_expires_at = null,
        error_message = coalesce(error_message, 'Processing lease expired after the final attempt'),
        updated_at = now()
    where job.status = 'processing'
      and job.lease_expires_at <= now()
      and job.attempts >= p_max_attempts
    returning job.receipt_id, job.user_id
  )
  update public.receipts as receipt
  set status = 'failed',
      updated_at = now()
  from exhausted
  where receipt.id = exhausted.receipt_id
    and receipt.user_id = exhausted.user_id
    and receipt.status = 'processing';

  select job.*
  into v_job
  from public.receipt_processing_jobs as job
  where job.attempts < p_max_attempts
    and (
      (job.status = 'pending' and job.available_at <= now())
      or
      (job.status = 'processing' and job.lease_expires_at <= now())
    )
  order by
    case when job.status = 'processing' then 0 else 1 end,
    coalesce(job.lease_expires_at, job.available_at),
    job.created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.receipt_processing_jobs as job
  set status = 'processing',
      attempts = job.attempts + 1,
      started_at = now(),
      completed_at = null,
      worker_id = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      error_message = null,
      updated_at = now()
  where job.id = v_job.id
  returning job.* into v_job;

  update public.receipts as receipt
  set status = 'processing',
      updated_at = now()
  where receipt.id = v_job.receipt_id
    and receipt.user_id = v_job.user_id;

  return query
  select
    v_job.id,
    v_job.receipt_id,
    v_job.user_id,
    v_job.attempts,
    v_job.parser_variant,
    receipt.storage_path
  from public.receipts as receipt
  where receipt.id = v_job.receipt_id
    and receipt.user_id = v_job.user_id;
end;
$$;

create or replace function public.complete_receipt_processing_job(
  p_job_id uuid,
  p_worker_id text,
  p_expected_attempt integer,
  p_merchant text,
  p_purchased_at date,
  p_total_amount numeric,
  p_confidence numeric,
  p_raw_ocr jsonb,
  p_validation_errors jsonb,
  p_parser_version text,
  p_items jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.receipt_processing_jobs%rowtype;
  v_item jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Receipt items must be an array';
  end if;
  if jsonb_typeof(p_raw_ocr) is distinct from 'object' then
    raise exception 'Raw OCR must be an object';
  end if;
  if jsonb_typeof(p_validation_errors) is distinct from 'array' then
    raise exception 'Validation errors must be an array';
  end if;

  select job.*
  into v_job
  from public.receipt_processing_jobs as job
  where job.id = p_job_id
    and job.status = 'processing'
    and job.worker_id = p_worker_id
    and job.attempts = p_expected_attempt
  for update;

  if not found then
    return false;
  end if;

  delete from public.receipt_items
  where receipt_id = v_job.receipt_id
    and user_id = v_job.user_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.receipt_items (
      receipt_id,
      user_id,
      line_number,
      name,
      quantity,
      unit_price,
      total_price,
      confidence,
      source_text,
      source_bbox
    ) values (
      v_job.receipt_id,
      v_job.user_id,
      (v_item ->> 'line_number')::integer,
      trim(v_item ->> 'name'),
      nullif(v_item ->> 'quantity', '')::numeric,
      nullif(v_item ->> 'unit_price', '')::numeric,
      (v_item ->> 'total_price')::numeric,
      nullif(v_item ->> 'confidence', '')::numeric,
      nullif(v_item ->> 'source_text', ''),
      v_item -> 'source_bbox'
    );
  end loop;

  update public.receipts
  set status = 'needs_review',
      merchant = nullif(trim(p_merchant), ''),
      purchased_at = p_purchased_at,
      total_amount = p_total_amount,
      confidence = p_confidence,
      raw_ocr = p_raw_ocr,
      validation_errors = p_validation_errors,
      parser_version = p_parser_version,
      updated_at = now()
  where id = v_job.receipt_id
    and user_id = v_job.user_id;

  update public.receipt_processing_jobs
  set status = 'completed',
      completed_at = now(),
      worker_id = null,
      lease_expires_at = null,
      updated_at = now()
  where id = v_job.id;

  return true;
end;
$$;

create or replace function public.fail_receipt_processing_job(
  p_job_id uuid,
  p_worker_id text,
  p_expected_attempt integer,
  p_error_message text,
  p_max_attempts integer,
  p_retry_delay_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.receipt_processing_jobs%rowtype;
  v_retry boolean;
begin
  if p_max_attempts not between 1 and 10 then
    raise exception 'Max attempts must be between 1 and 10';
  end if;
  if p_retry_delay_seconds not between 1 and 3600 then
    raise exception 'Retry delay must be between 1 and 3600 seconds';
  end if;

  select job.*
  into v_job
  from public.receipt_processing_jobs as job
  where job.id = p_job_id
    and job.status = 'processing'
    and job.worker_id = p_worker_id
    and job.attempts = p_expected_attempt
  for update;

  if not found then
    return false;
  end if;

  v_retry := v_job.attempts < p_max_attempts;

  update public.receipt_processing_jobs
  set status = case when v_retry then 'pending' else 'failed' end,
      available_at = case
        when v_retry then now() + make_interval(secs => p_retry_delay_seconds)
        else available_at
      end,
      started_at = null,
      completed_at = case when v_retry then null else now() end,
      worker_id = null,
      lease_expires_at = null,
      error_message = left(coalesce(nullif(p_error_message, ''), 'Worker error'), 1000),
      updated_at = now()
  where id = v_job.id;

  update public.receipts
  set status = case when v_retry then 'queued' else 'failed' end,
      updated_at = now()
  where id = v_job.receipt_id
    and user_id = v_job.user_id;

  return true;
end;
$$;

create or replace function public.save_receipt_review(
  p_receipt_id uuid,
  p_merchant text,
  p_purchased_at date,
  p_total_amount numeric,
  p_category_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_line_number integer := 0;
  v_item_category_id uuid;
  v_expense_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_merchant, ''))) not between 1 and 160
    or p_purchased_at is null or p_total_amount is null or p_total_amount <= 0 then
    raise exception 'Receipt review data is invalid';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Receipt items must be an array'; end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories where id = p_category_id and user_id = v_user_id
  ) then raise exception 'Category not found'; end if;

  select expense_id into v_expense_id
  from public.receipts
  where id = p_receipt_id and user_id = v_user_id
    and status in ('needs_review', 'failed', 'approved')
  for update;
  if not found then raise exception 'Receipt cannot be edited'; end if;

  update public.receipts
  set merchant = trim(p_merchant),
      purchased_at = p_purchased_at,
      total_amount = p_total_amount,
      category_id = p_category_id,
      status = case when status = 'failed' then 'needs_review' else status end,
      updated_at = now()
  where id = p_receipt_id and user_id = v_user_id;

  delete from public.receipt_items where receipt_id = p_receipt_id and user_id = v_user_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_category_id := nullif(v_item ->> 'categoryId', '')::uuid;
    if char_length(trim(coalesce(v_item ->> 'name', ''))) not between 1 and 240
      or (v_item ->> 'totalPrice') is null or (v_item ->> 'totalPrice')::numeric < 0
      or v_item_category_id is null
      or ((v_item ->> 'quantity') is not null and (v_item ->> 'quantity')::numeric <= 0)
      or ((v_item ->> 'unitPrice') is not null and (v_item ->> 'unitPrice')::numeric < 0)
      or not exists (select 1 from public.categories where id = v_item_category_id and user_id = v_user_id) then
      raise exception 'Receipt item is invalid';
    end if;
    insert into public.receipt_items (
      receipt_id, user_id, category_id, line_number, name, quantity, unit_price, total_price
    ) values (
      p_receipt_id, v_user_id, v_item_category_id, v_line_number, trim(v_item ->> 'name'),
      nullif(v_item ->> 'quantity', '')::numeric, nullif(v_item ->> 'unitPrice', '')::numeric,
      (v_item ->> 'totalPrice')::numeric
    );
    v_line_number := v_line_number + 1;
  end loop;

  if v_expense_id is not null then
    update public.expenses
    set merchant = trim(p_merchant), amount = p_total_amount, spent_at = p_purchased_at,
        category_id = p_category_id, updated_at = now()
    where id = v_expense_id and user_id = v_user_id;
  end if;
end;
$$;

revoke all on function public.claim_receipt_processing_job(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_receipt_processing_job(text, integer, integer) to service_role;

revoke all on function public.complete_receipt_processing_job(uuid, text, integer, text, date, numeric, numeric, jsonb, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.complete_receipt_processing_job(uuid, text, integer, text, date, numeric, numeric, jsonb, jsonb, text, jsonb) to service_role;

revoke all on function public.fail_receipt_processing_job(uuid, text, integer, text, integer, integer) from public, anon, authenticated;
grant execute on function public.fail_receipt_processing_job(uuid, text, integer, text, integer, integer) to service_role;
