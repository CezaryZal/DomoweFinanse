create function public.register_receipt_upload(
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
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.receipts (
    id,
    user_id,
    status,
    storage_path,
    original_filename,
    mime_type,
    file_size,
    source_hash
  ) values (
    p_receipt_id,
    v_user_id,
    'queued',
    p_storage_path,
    p_original_filename,
    p_mime_type,
    p_file_size,
    p_source_hash
  );

  insert into public.receipt_processing_jobs (receipt_id, user_id)
  values (p_receipt_id, v_user_id);

  return p_receipt_id;
end;
$$;

create function public.approve_receipt_as_expense(
  p_receipt_id uuid,
  p_category_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_receipt public.receipts%rowtype;
  v_expense_id uuid;
begin
  select *
  into v_receipt
  from public.receipts
  where id = p_receipt_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Receipt not found';
  end if;

  if v_receipt.status <> 'needs_review' then
    raise exception 'Receipt is not ready for approval';
  end if;

  if v_receipt.merchant is null
    or v_receipt.purchased_at is null
    or v_receipt.total_amount is null then
    raise exception 'Receipt data is incomplete';
  end if;

  insert into public.expenses (
    user_id,
    category_id,
    merchant,
    amount,
    currency,
    spent_at,
    notes,
    source
  ) values (
    v_receipt.user_id,
    p_category_id,
    v_receipt.merchant,
    v_receipt.total_amount,
    v_receipt.currency,
    v_receipt.purchased_at,
    'Utworzono z paragonu OCR ' || v_receipt.id::text,
    'receipt'
  )
  returning id into v_expense_id;

  update public.receipts
  set status = 'approved',
      expense_id = v_expense_id,
      updated_at = now()
  where id = v_receipt.id;

  return v_expense_id;
end;
$$;

revoke all on function public.register_receipt_upload(uuid, text, text, text, bigint, text) from public;
revoke all on function public.register_receipt_upload(uuid, text, text, text, bigint, text) from anon;
grant execute on function public.register_receipt_upload(uuid, text, text, text, bigint, text) to authenticated;

revoke all on function public.approve_receipt_as_expense(uuid, uuid) from public;
revoke all on function public.approve_receipt_as_expense(uuid, uuid) from anon;
grant execute on function public.approve_receipt_as_expense(uuid, uuid) to authenticated;
