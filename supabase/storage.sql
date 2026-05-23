-- ============================================================
-- EUROTRON IMS — Storage bucket for PDF reports
-- Paste this into Supabase SQL Editor AFTER running schema.sql
-- ============================================================

-- Create the reports storage bucket (public so customers can download via URL)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports',
  'reports',
  true,
  10485760,   -- 10 MB max per PDF
  array['application/pdf']
)
on conflict (id) do nothing;

-- Allow authenticated users (engineers/admins) to upload PDFs
create policy "engineers_upload_pdfs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reports'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'engineer')
    )
  );

-- Allow authenticated users to update/replace PDFs
create policy "engineers_update_pdfs"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'reports')
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'engineer')
    )
  );

-- Allow anyone to read PDFs (public bucket — customers access via URL link)
create policy "public_read_pdfs"
  on storage.objects for select
  to public
  using (bucket_id = 'reports');

-- Done! PDF storage is ready.
