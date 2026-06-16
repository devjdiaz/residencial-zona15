-- Migración aditiva: archivo del contrato firmado (módulo Historial).
-- Aplicar a mano en el SQL Editor de Supabase. NUNCA re-ejecutar schema.sql.

begin;

-- Path del archivo del contrato firmado en el bucket 'contracts'
alter table contracts add column if not exists contract_file_path text;

-- Bucket privado para contratos firmados (lectura vía signed URL)
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

-- Policies solo-admin, patrón room-photos.
-- Usar public.current_user_role(), NO auth.jwt() (ver
-- knowledge-vault/decisiones/2026-06-08-rls-fotos-storage).
drop policy if exists "contracts_admin_read"   on storage.objects;
drop policy if exists "contracts_admin_insert" on storage.objects;
drop policy if exists "contracts_admin_update" on storage.objects;
drop policy if exists "contracts_admin_delete" on storage.objects;

create policy "contracts_admin_read"
  on storage.objects for select to authenticated
  using ( bucket_id = 'contracts' and public.current_user_role() in ('super_admin','admin') );

create policy "contracts_admin_insert"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'contracts' and public.current_user_role() in ('super_admin','admin') );

create policy "contracts_admin_update"
  on storage.objects for update to authenticated
  using ( bucket_id = 'contracts' and public.current_user_role() in ('super_admin','admin') )
  with check ( bucket_id = 'contracts' and public.current_user_role() in ('super_admin','admin') );

create policy "contracts_admin_delete"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'contracts' and public.current_user_role() in ('super_admin','admin') );

commit;
