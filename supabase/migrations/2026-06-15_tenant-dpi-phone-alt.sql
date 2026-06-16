-- Migración aditiva — aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql).
-- Agrega tenant_profiles.dpi y tenant_profiles.phone_alt: faltaban para que el
-- PDF del contrato (ContractPDF) saliera con esos datos en vez de líneas en blanco.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

begin;

alter table tenant_profiles add column if not exists dpi text not null default '';
alter table tenant_profiles add column if not exists phone_alt text not null default '';

commit;
