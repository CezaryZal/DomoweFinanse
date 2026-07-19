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
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Receipt items must be an array'; end if;
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
  set merchant = trim(p_merchant), purchased_at = p_purchased_at, total_amount = p_total_amount,
      category_id = p_category_id, updated_at = now()
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
