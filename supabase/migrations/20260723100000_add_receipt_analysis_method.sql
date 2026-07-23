alter table public.receipts
  add column analysis_method text;

update public.receipts as receipt
set analysis_method = 'gemini'
where receipt.status = 'ready_for_analysis'
   or exists (
     select 1
     from public.receipt_processing_jobs as job
     where job.receipt_id = receipt.id
       and job.user_id = receipt.user_id
       and job.parser_variant = 'gemini'
   );

update public.receipts
set analysis_method = 'ocr'
where analysis_method is null;

alter table public.receipts
  alter column analysis_method set default 'ocr',
  alter column analysis_method set not null,
  add constraint receipts_analysis_method_check
    check (analysis_method in ('ocr', 'gemini'));

create or replace function public.register_receipt_upload(
  p_receipt_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_source_hash text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_parser_variant text;
  v_analysis_method text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select parser_variant into v_parser_variant
  from public.user_receipt_settings
  where user_id = v_user_id;
  v_parser_variant := coalesce(v_parser_variant, 'rules');
  v_analysis_method := case when v_parser_variant = 'gemini' then 'gemini' else 'ocr' end;

  insert into public.receipts (
    id, user_id, status, analysis_method, storage_path, original_filename, mime_type, file_size, source_hash
  ) values (
    p_receipt_id,
    v_user_id,
    case when v_analysis_method = 'gemini' then 'ready_for_analysis' else 'queued' end,
    v_analysis_method,
    p_storage_path,
    p_original_filename,
    p_mime_type,
    p_file_size,
    p_source_hash
  );

  if v_analysis_method = 'ocr' then
    insert into public.receipt_processing_jobs (receipt_id, user_id, parser_variant)
    values (p_receipt_id, v_user_id, v_parser_variant);
  end if;

  return p_receipt_id;
end;
$$;

create or replace function public.queue_gemini_receipt_analysis(p_receipt_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_parser_variant text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select parser_variant into v_parser_variant
  from public.user_receipt_settings
  where user_id = v_user_id;
  if coalesce(v_parser_variant, 'rules') <> 'gemini' then
    raise exception 'Select Gemini in receipt settings before starting analysis';
  end if;

  perform 1
  from public.receipts
  where id = p_receipt_id
    and user_id = v_user_id
    and analysis_method = 'gemini'
    and status = 'ready_for_analysis'
  for update;
  if not found then
    raise exception 'Only a new Gemini receipt can be queued for analysis';
  end if;

  insert into public.receipt_processing_jobs (receipt_id, user_id, parser_variant)
  values (p_receipt_id, v_user_id, 'gemini');

  update public.receipts
  set status = 'queued', updated_at = now()
  where id = p_receipt_id and user_id = v_user_id;
end;
$$;

revoke all on function public.queue_gemini_receipt_analysis(uuid) from public, anon;
grant execute on function public.queue_gemini_receipt_analysis(uuid) to authenticated;
