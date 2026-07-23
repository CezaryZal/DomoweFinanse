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

  insert into public.receipt_processing_jobs (
    receipt_id, user_id, parser_variant, status, attempts, started_at, worker_id, lease_expires_at
  ) values (
    v_receipt.id, v_user_id, 'gemini', 'processing', 1, now(), v_worker_id, now() + interval '5 minutes'
  )
  on conflict (receipt_id) do update
    set status = 'processing',
        attempts = public.receipt_processing_jobs.attempts + 1,
        started_at = now(),
        completed_at = null,
        worker_id = v_worker_id,
        lease_expires_at = now() + interval '5 minutes',
        error_message = null,
        updated_at = now()
    where public.receipt_processing_jobs.user_id = v_user_id
      and public.receipt_processing_jobs.parser_variant = 'gemini'
      and public.receipt_processing_jobs.status = 'pending'
  returning * into v_job;

  if not found then
    raise exception 'Receipt is already being analyzed';
  end if;

  update public.receipts
  set status = 'processing', updated_at = now()
  where id = v_receipt.id and user_id = v_user_id;

  return query
  select v_job.id, v_receipt.storage_path, v_receipt.mime_type, v_job.attempts;
end;
$$;

revoke all on function public.start_gemini_receipt_analysis(uuid) from public, anon;
grant execute on function public.start_gemini_receipt_analysis(uuid) to authenticated;
