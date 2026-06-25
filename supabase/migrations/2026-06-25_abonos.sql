-- Migración aditiva — Abonos (pagos parciales con autorización del admin)
-- Aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql). Idempotente.
-- Un inquilino que no tiene el monto completo del mes solicita pagar en partes.
-- El admin (o super_admin) autoriza, rechaza o contraoferta. Tras autorizar, el
-- inquilino sube varios comprobantes de abono para el mismo mes; al verificarlos,
-- su monto se suma a monthly_payments (source='abono') para que Finanzas los cuente.

begin;

-- Ampliar source de monthly_payments para incluir abonos
alter table monthly_payments drop constraint if exists monthly_payments_source_check;
alter table monthly_payments add constraint monthly_payments_source_check
  check (source in ('receipt','manual','abono'));

-- Solicitudes de abono (tenant -> admin)
create table if not exists abono_requests (
  id                 uuid primary key default gen_random_uuid(),
  contract_id        uuid references contracts(id) on delete cascade not null,
  tenant_profile_id  uuid references tenant_profiles(id) on delete cascade not null,
  room_id            uuid references rooms(id) on delete cascade not null,
  period_month       text not null,                 -- 'YYYY-MM'
  requested_amount   numeric(10,2) not null check (requested_amount > 0),
  month_total        numeric(10,2),                 -- snapshot informativo del total del mes
  status             text not null default 'pending'
                       check (status in ('pending','authorized','rejected')),
  authorized_amount  numeric(10,2),                 -- editable por admin (= contraoferta o aprobación)
  admin_notes        text,
  created_at         timestamptz not null default now(),
  resolved_at        timestamptz,
  resolved_by        uuid references auth.users(id) on delete set null,
  unique (contract_id, period_month)
);

alter table abono_requests enable row level security;

drop policy if exists "admin_all_abono_requests" on abono_requests;
create policy "admin_all_abono_requests" on abono_requests
  for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));

drop policy if exists "tenant_own_abono_requests_read" on abono_requests;
create policy "tenant_own_abono_requests_read" on abono_requests
  for select using (tenant_profile_id = auth.uid());

drop policy if exists "tenant_own_abono_requests_insert" on abono_requests;
create policy "tenant_own_abono_requests_insert" on abono_requests
  for insert with check (tenant_profile_id = auth.uid());

drop policy if exists "tenant_own_abono_requests_update" on abono_requests;
create policy "tenant_own_abono_requests_update" on abono_requests
  for update using (tenant_profile_id = auth.uid());  -- permite re-solicitar tras rechazo

create index if not exists idx_abono_requests_status on abono_requests(status);

-- Comprobantes de abono (varios por mes)
create table if not exists abono_payments (
  id                 uuid primary key default gen_random_uuid(),
  abono_request_id   uuid references abono_requests(id) on delete cascade not null,
  contract_id        uuid references contracts(id) on delete cascade not null,
  tenant_profile_id  uuid references tenant_profiles(id) on delete cascade not null,
  room_id            uuid references rooms(id) on delete cascade not null,
  period_month       text not null,
  amount             numeric(10,2) not null check (amount > 0),
  storage_path       text not null,
  file_hash          text,
  verified           boolean not null default false,
  rejected           boolean not null default false,
  rejection_reason   text,
  created_at         timestamptz not null default now(),
  registered_by      uuid references auth.users(id) on delete set null
);  -- SIN unique por mes: se permiten varios abonos para el mismo mes

alter table abono_payments enable row level security;

drop policy if exists "admin_all_abono_payments" on abono_payments;
create policy "admin_all_abono_payments" on abono_payments
  for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));

drop policy if exists "tenant_own_abono_payments_read" on abono_payments;
create policy "tenant_own_abono_payments_read" on abono_payments
  for select using (tenant_profile_id = auth.uid());

drop policy if exists "tenant_own_abono_payments_insert" on abono_payments;
create policy "tenant_own_abono_payments_insert" on abono_payments
  for insert with check (tenant_profile_id = auth.uid());

create index if not exists idx_abono_payments_request on abono_payments(abono_request_id);

commit;
