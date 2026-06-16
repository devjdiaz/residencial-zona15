-- Migración aditiva — aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql).
-- Quita las policies del bucket contract-templates: la función de "plantilla
-- en blanco" se descartó a favor del PDF autogenerado por contrato (ver
-- decisión renta-por-contrato). Idempotente: se puede re-ejecutar sin efectos
-- secundarios.
--
-- El bucket y sus objetos NO se borran aquí — Supabase no permite delete
-- directo sobre storage.objects/buckets por SQL ("Direct deletion from
-- storage tables is not allowed. Use the Storage API instead."). Se borraron
-- aparte vía Storage API (sb.storage.from(...).remove(...) + deleteBucket()).

begin;

drop policy if exists "contract_templates_public_read"  on storage.objects;
drop policy if exists "contract_templates_admin_insert" on storage.objects;
drop policy if exists "contract_templates_admin_update" on storage.objects;
drop policy if exists "contract_templates_admin_delete" on storage.objects;

commit;
