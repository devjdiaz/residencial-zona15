-- Migración aditiva — aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql).
-- Agrega: email visible en tenant_profiles, contracts.signed_at, bucket contract-templates.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

begin;

-- 1. Email del inquilino visible en backoffice.
--    Fuente de verdad: auth.users; se sincroniza vía /api/admin/update-tenant-email
--    y se escribe al crear el contrato. El backfill repara cualquier desincronización.
alter table tenant_profiles add column if not exists email text not null default '';

update tenant_profiles tp
set email = coalesce(u.email, '')
from auth.users u
where u.id = tp.id and tp.email = '';

-- 2. Contrato firmado recibido (null = aún no firmado)
alter table contracts add column if not exists signed_at timestamptz;

-- 3. Bucket del template de contrato: lectura pública (el inquilino lo descarga
--    desde el link de WhatsApp sin sesión), escritura solo admin/super_admin.
insert into storage.buckets (id, name, public)
values ('contract-templates', 'contract-templates', true)
on conflict (id) do nothing;

drop policy if exists "contract_templates_public_read"  on storage.objects;
drop policy if exists "contract_templates_admin_insert" on storage.objects;
drop policy if exists "contract_templates_admin_update" on storage.objects;
drop policy if exists "contract_templates_admin_delete" on storage.objects;

create policy "contract_templates_public_read"
  on storage.objects for select
  using ( bucket_id = 'contract-templates' );

create policy "contract_templates_admin_insert"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'contract-templates' and public.current_user_role() in ('super_admin','admin') );

create policy "contract_templates_admin_update"
  on storage.objects for update to authenticated
  using ( bucket_id = 'contract-templates' and public.current_user_role() in ('super_admin','admin') );

create policy "contract_templates_admin_delete"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'contract-templates' and public.current_user_role() in ('super_admin','admin') );

commit;
