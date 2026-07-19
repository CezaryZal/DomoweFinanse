create table public.user_receipt_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  parser_variant text not null default 'rules' check (parser_variant in ('rules', 'qwen', 'gemini')),
  updated_at timestamptz not null default now()
);
alter table public.user_receipt_settings enable row level security;
create policy "Users can read their receipt settings" on public.user_receipt_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their receipt settings" on public.user_receipt_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their receipt settings" on public.user_receipt_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.user_receipt_settings to authenticated;
alter table public.receipt_processing_jobs add column parser_variant text not null default 'rules' check (parser_variant in ('rules', 'qwen', 'gemini'));

create or replace function public.register_receipt_upload(p_receipt_id uuid,p_storage_path text,p_original_filename text,p_mime_type text,p_file_size bigint,p_source_hash text) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_parser_variant text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select parser_variant into v_parser_variant from public.user_receipt_settings where user_id = v_user_id;
  v_parser_variant := coalesce(v_parser_variant, 'rules');
  insert into public.receipts (id,user_id,status,storage_path,original_filename,mime_type,file_size,source_hash) values (p_receipt_id,v_user_id,'queued',p_storage_path,p_original_filename,p_mime_type,p_file_size,p_source_hash);
  insert into public.receipt_processing_jobs (receipt_id,user_id,parser_variant) values (p_receipt_id,v_user_id,v_parser_variant);
  return p_receipt_id;
end; $$;
revoke all on function public.register_receipt_upload(uuid,text,text,text,bigint,text) from public;
revoke all on function public.register_receipt_upload(uuid,text,text,text,bigint,text) from anon;
grant execute on function public.register_receipt_upload(uuid,text,text,text,bigint,text) to authenticated;
