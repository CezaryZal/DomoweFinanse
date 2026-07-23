-- Users may read or create their own jobs, but must not update queue state directly.
-- This function performs the narrow state transition after verifying auth.uid()
-- against the receipt owner.
alter function public.start_gemini_receipt_analysis(uuid) security definer;
alter function public.start_gemini_receipt_analysis(uuid) set search_path = '';

revoke all on function public.start_gemini_receipt_analysis(uuid) from public, anon;
grant execute on function public.start_gemini_receipt_analysis(uuid) to authenticated;
