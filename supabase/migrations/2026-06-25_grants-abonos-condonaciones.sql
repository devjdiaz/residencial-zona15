-- Migración aditiva — GRANTs para las tablas nuevas (condonaciones + abonos)
-- Aplicar en el SQL Editor de Supabase. Idempotente.
--
-- Las migraciones 2026-06-25_condonaciones.sql y 2026-06-25_abonos.sql crearon
-- las tablas y sus policies RLS, pero NO los privilegios a nivel de tabla. En
-- producción esto causa "permission denied for table ... [42501]" al insertar,
-- porque el rol `authenticated` no tiene acceso a la tabla (RLS protege filas,
-- pero primero hace falta el GRANT de tabla). En `schema.sql` esto lo cubre el
-- `grant all on all tables in schema public ...` global; aquí lo replicamos para
-- las tablas creadas por migración. RLS sigue restringiendo qué filas ve cada rol.

begin;

grant all on table charge_waivers  to anon, authenticated, service_role;
grant all on table abono_requests  to anon, authenticated, service_role;
grant all on table abono_payments  to anon, authenticated, service_role;

commit;
