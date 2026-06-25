-- Migración aditiva — Storage: admin lee/borra el bucket `receipts`
-- Aplicar en el SQL Editor de Supabase. Idempotente.
--
-- El bucket `receipts` solo tenía policies tenant-scoped (cada inquilino su
-- carpeta). El admin no podía generar signed URLs → "No se pudo abrir el
-- comprobante" al intentar ver un comprobante (mensual o de abono, mismo bucket).
-- Se agregan policies para que super_admin/admin puedan leer (ver) y borrar
-- (limpieza al eliminar habitaciones, ver RoomGrid) cualquier objeto del bucket.
-- Usa current_user_role() (rol fresco), igual que las policies de room-photos y contracts.

begin;

drop policy if exists "receipts_admin_read"   on storage.objects;
create policy "receipts_admin_read"
  on storage.objects for select to authenticated
  using ( bucket_id = 'receipts' and public.current_user_role() in ('super_admin','admin') );

drop policy if exists "receipts_admin_delete" on storage.objects;
create policy "receipts_admin_delete"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'receipts' and public.current_user_role() in ('super_admin','admin') );

commit;
