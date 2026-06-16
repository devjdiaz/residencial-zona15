-- Migración aditiva — aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql).
-- Agrega a contracts los datos de la "persona adicional autorizada" (nombre, DPI,
-- teléfono, teléfono alterno). Vive en contracts y no en tenant_profiles porque esa
-- tabla es 1:1 con auth.users — la persona adicional nunca tiene cuenta/login, solo
-- el inquilino principal accede a la plataforma. Permite mostrarla en el PDF del
-- contrato cuando el checkbox "Persona adicional (mensual)" está activo.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

begin;

alter table contracts add column if not exists has_additional_person boolean not null default false;
alter table contracts add column if not exists additional_person_name text not null default '';
alter table contracts add column if not exists additional_person_dpi text not null default '';
alter table contracts add column if not exists additional_person_phone text not null default '';
alter table contracts add column if not exists additional_person_phone_alt text not null default '';

commit;
