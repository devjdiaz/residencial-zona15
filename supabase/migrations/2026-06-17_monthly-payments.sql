-- Migración aditiva — aplicar en el SQL Editor de Supabase.
-- Crea la tabla monthly_payments para registrar ingresos reales de renta
-- (por comprobante aprobado o ingreso manual del admin).
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

begin;

create table if not exists monthly_payments (
  id             uuid primary key default gen_random_uuid(),
  contract_id    uuid references contracts(id) on delete cascade not null,
  room_id        uuid references rooms(id) on delete cascade not null,
  period_month   text not null,
  amount         numeric(10,2) not null check (amount >= 0),
  source         text not null check (source in ('receipt', 'manual')),
  receipt_id     uuid references payment_receipts(id) on delete set null,
  registered_by  uuid references auth.users(id) on delete set null,
  registered_at  timestamptz not null default now(),
  notes          text,
  unique (contract_id, period_month)
);

alter table monthly_payments enable row level security;

drop policy if exists "admin_all_monthly_payments" on monthly_payments;
create policy "admin_all_monthly_payments" on monthly_payments
  for all using (
    (auth.jwt()->'user_metadata'->>'role') in ('super_admin', 'admin')
  );

-- Índice para la detección de comprobantes duplicados (cross-tenant lookup)
create index if not exists idx_payment_receipts_file_hash on payment_receipts(file_hash);

commit;
