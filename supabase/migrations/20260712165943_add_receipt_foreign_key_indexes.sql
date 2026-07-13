create index receipt_items_category_user_idx
  on public.receipt_items (category_id, user_id);

create index receipt_items_receipt_user_idx
  on public.receipt_items (receipt_id, user_id);

create index receipt_items_user_receipt_idx
  on public.receipt_items (user_id, receipt_id);

create index receipt_processing_jobs_receipt_user_idx
  on public.receipt_processing_jobs (receipt_id, user_id);

create index receipt_processing_jobs_user_status_idx
  on public.receipt_processing_jobs (user_id, status);

create index receipts_expense_user_idx
  on public.receipts (expense_id, user_id)
  where expense_id is not null;
