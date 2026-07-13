alter table public.receipts
  add column category_id uuid;

alter table public.receipts
  add constraint receipts_category_user_fkey
  foreign key (category_id, user_id)
  references public.categories (id, user_id)
  on delete set null (category_id);

create index receipts_category_user_idx
  on public.receipts (category_id, user_id)
  where category_id is not null;

create function public.save_receipt_review(
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
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(coalesce(p_merchant, ''))) not between 1 and 160
    or p_purchased_at is null
    or p_total_amount is null
    or p_total_amount <= 0 then
    raise exception 'Receipt review data is invalid';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Receipt items must be an array';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.categories
    where id = p_category_id and user_id = v_user_id
  ) then
    raise exception 'Category not found';
  end if;

  update public.receipts
  set merchant = trim(p_merchant),
      purchased_at = p_purchased_at,
      total_amount = p_total_amount,
      category_id = p_category_id,
      status = 'needs_review',
      updated_at = now()
  where id = p_receipt_id
    and user_id = v_user_id
    and status in ('needs_review', 'failed');

  if not found then
    raise exception 'Receipt cannot be edited';
  end if;

  delete from public.receipt_items
  where receipt_id = p_receipt_id and user_id = v_user_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if char_length(trim(coalesce(v_item ->> 'name', ''))) not between 1 and 240
      or coalesce((v_item ->> 'totalPrice')::numeric, 0) < 0
      or ((v_item ->> 'quantity') is not null and (v_item ->> 'quantity')::numeric <= 0)
      or ((v_item ->> 'unitPrice') is not null and (v_item ->> 'unitPrice')::numeric < 0) then
      raise exception 'Receipt item is invalid';
    end if;

    insert into public.receipt_items (
      receipt_id, user_id, line_number, name, quantity, unit_price, total_price
    ) values (
      p_receipt_id, v_user_id, v_line_number, trim(v_item ->> 'name'),
      nullif(v_item ->> 'quantity', '')::numeric,
      nullif(v_item ->> 'unitPrice', '')::numeric,
      (v_item ->> 'totalPrice')::numeric
    );
    v_line_number := v_line_number + 1;
  end loop;
end;
$$;

create function public.delete_receipt(p_receipt_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_receipt public.receipts%rowtype;
begin
  select * into v_receipt
  from public.receipts
  where id = p_receipt_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Receipt not found';
  end if;

  if v_receipt.expense_id is not null then
    delete from public.expenses
    where id = v_receipt.expense_id and user_id = v_receipt.user_id;
  end if;

  delete from public.receipts
  where id = v_receipt.id and user_id = v_receipt.user_id;

  return v_receipt.storage_path;
end;
$$;

revoke all on function public.save_receipt_review(uuid, text, date, numeric, uuid, jsonb) from public;
revoke all on function public.save_receipt_review(uuid, text, date, numeric, uuid, jsonb) from anon;
grant execute on function public.save_receipt_review(uuid, text, date, numeric, uuid, jsonb) to authenticated;

revoke all on function public.delete_receipt(uuid) from public;
revoke all on function public.delete_receipt(uuid) from anon;
grant execute on function public.delete_receipt(uuid) to authenticated;
