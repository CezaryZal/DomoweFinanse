create or replace function public.start_gemini_receipt_analysis(p_receipt_id uuid)
returns table (
  job_id uuid,
  storage_path text,
  mime_type text,
  attempt integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_receipt public.receipts%rowtype;
  v_job public.receipt_processing_jobs%rowtype;
  v_worker_id constant text := 'supabase-edge-gemini';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_receipt
  from public.receipts
  where id = p_receipt_id
    and user_id = v_user_id
    and analysis_method = 'gemini'
    and status in ('ready_for_analysis', 'queued')
  for update;

  if not found then
    raise exception 'Receipt is not ready for Gemini analysis';
  end if;

  select * into v_job
  from public.receipt_processing_jobs
  where receipt_id = v_receipt.id
    and user_id = v_user_id
  for update;

  if found then
    if v_job.parser_variant <> 'gemini' or v_job.status <> 'pending' then
      raise exception 'Receipt is already being analyzed';
    end if;

    update public.receipt_processing_jobs
    set status = 'processing',
        attempts = attempts + 1,
        started_at = now(),
        completed_at = null,
        worker_id = v_worker_id,
        lease_expires_at = now() + interval '5 minutes',
        error_message = null,
        updated_at = now()
    where id = v_job.id
    returning * into v_job;
  else
    insert into public.receipt_processing_jobs (
      receipt_id, user_id, parser_variant, status, attempts, started_at, worker_id, lease_expires_at
    ) values (
      v_receipt.id, v_user_id, 'gemini', 'processing', 1, now(), v_worker_id, now() + interval '5 minutes'
    )
    returning * into v_job;
  end if;

  update public.receipts
  set status = 'processing', updated_at = now()
  where id = v_receipt.id and user_id = v_user_id;

  return query
  select v_job.id, v_receipt.storage_path, v_receipt.mime_type, v_job.attempts;
end;
$$;

create or replace function public.fail_gemini_receipt_analysis(
  p_job_id uuid,
  p_expected_attempt integer,
  p_error_message text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.receipt_processing_jobs%rowtype;
begin
  select * into v_job
  from public.receipt_processing_jobs
  where id = p_job_id
    and parser_variant = 'gemini'
    and status = 'processing'
    and worker_id = 'supabase-edge-gemini'
    and attempts = p_expected_attempt
  for update;

  if not found then
    return false;
  end if;

  update public.receipt_processing_jobs
  set status = 'failed',
      completed_at = now(),
      worker_id = null,
      lease_expires_at = null,
      error_message = left(coalesce(nullif(p_error_message, ''), 'Gemini analysis failed'), 1000),
      updated_at = now()
  where id = v_job.id;

  update public.receipts
  set status = 'failed', updated_at = now()
  where id = v_job.receipt_id and user_id = v_job.user_id;

  return true;
end;
$$;

revoke all on function public.start_gemini_receipt_analysis(uuid) from public, anon;
grant execute on function public.start_gemini_receipt_analysis(uuid) to authenticated;

revoke all on function public.fail_gemini_receipt_analysis(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.fail_gemini_receipt_analysis(uuid, integer, text) to service_role;
