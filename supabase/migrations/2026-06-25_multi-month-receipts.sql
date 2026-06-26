-- Migración aditiva — Pago de varios meses en una sola transferencia
-- Aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql). Idempotente.
--
-- Un inquilino puede pagar varios meses (p. ej. mayo, junio y julio) en una sola
-- transferencia, subiendo un único comprobante. Se crea una fila en payment_receipts
-- por cada mes cubierto (manteniendo el único (contract_id, period_month) y el cálculo
-- de Finanzas mes a mes), todas con el MISMO storage_path/file_hash y un mismo
-- payment_group_id que marca que pertenecen a la misma transferencia.
--
-- payment_group_id nullable: null = pago de un solo mes (comportamiento actual).

begin;

alter table payment_receipts
  add column if not exists payment_group_id uuid;

create index if not exists idx_payment_receipts_group
  on payment_receipts(payment_group_id);

commit;
