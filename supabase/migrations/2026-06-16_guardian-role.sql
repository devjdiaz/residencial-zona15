-- Migración aditiva — aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql).
-- Agrega el rol "guardian" (mantenimiento): puede leer y actualizar issue_reports
-- (ver/cambiar estado de reportes de daños) pero no crear ni borrar reportes, y no
-- tiene acceso a ninguna otra tabla del panel admin. También se amplía audit_insert
-- para que sus cambios de estado queden registrados en la bitácora.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

begin;

drop policy if exists "guardian_read_issues" on issue_reports;
create policy "guardian_read_issues" on issue_reports for select
  using ((auth.jwt()->'user_metadata'->>'role') = 'guardian');

drop policy if exists "guardian_update_issues" on issue_reports;
create policy "guardian_update_issues" on issue_reports for update
  using ((auth.jwt()->'user_metadata'->>'role') = 'guardian');

alter policy "audit_insert" on audit_log
  with check ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin','guardian'));

commit;
