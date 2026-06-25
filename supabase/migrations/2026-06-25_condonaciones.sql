-- Migración aditiva — Condonaciones (waive de cobros)
-- Aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql). Idempotente.
-- Permite al admin condonar/exonerar cualquier cobro de un inquilino (renta, depósito,
-- firma, parqueo, persona adicional u otro) para un mes específico. El cobro condonado
-- se descuenta del "total a pagar" del inquilino y del "por cobrar" en Finanzas.

begin;

create table if not exists charge_waivers (
  id                  uuid primary key default gen_random_uuid(),
  contract_id         uuid references contracts(id) on delete cascade not null,
  room_id             uuid references rooms(id) on delete cascade not null,
  period_month        text not null,                 -- 'YYYY-MM' del mes condonado
  concept             text not null check (concept in
                        ('rent','deposit','contract_signing','parking','additional_person','other')),
  recurring_charge_id uuid references recurring_charges(id) on delete set null,
  income_extra_id     uuid references income_extras(id) on delete set null,
  amount              numeric(10,2) not null check (amount >= 0),
  reason              text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

alter table charge_waivers enable row level security;

drop policy if exists "admin_all_charge_waivers" on charge_waivers;
create policy "admin_all_charge_waivers" on charge_waivers
  for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));

drop policy if exists "tenant_own_charge_waivers_read" on charge_waivers;
create policy "tenant_own_charge_waivers_read" on charge_waivers
  for select using (
    contract_id = (select contract_id from tenant_profiles where id = auth.uid())
  );

create index if not exists idx_charge_waivers_contract_period
  on charge_waivers(contract_id, period_month);

commit;
