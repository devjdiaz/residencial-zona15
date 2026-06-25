-- Migración aditiva — el inquilino puede borrar su propio comprobante
-- mientras la administradora NO lo haya aceptado (verified = false).
--
-- Antes: payment_receipts tenía policies tenant de select/insert/update pero NO delete,
-- y el bucket `receipts` solo permitía delete a admin. Sin estas policies el botón
-- "Eliminar" del dashboard del inquilino falla con error de permiso.
--
-- Idempotente (drop if exists + create). Aplicar en producción con autorización.

-- DB: el tenant borra solo sus rows y solo si no está verificado.
drop policy if exists "tenant_own_receipts_delete" on payment_receipts;
create policy "tenant_own_receipts_delete" on payment_receipts
  for delete using (tenant_profile_id = auth.uid() and verified = false);

-- Storage: el tenant borra archivos de su propia carpeta {user.id}/... del bucket receipts.
-- El candado "no verificado" vive en el row DB + UI; el archivo solo es relevante junto a su row.
drop policy if exists "receipts_tenant_delete" on storage.objects;
create policy "receipts_tenant_delete"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text );
