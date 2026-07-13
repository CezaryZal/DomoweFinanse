create index receipts_category_user_idx
  on public.receipts (category_id, user_id)
  where category_id is not null;
