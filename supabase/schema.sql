-- =============================================================
-- Residencial El Maestro — Supabase Schema
-- Run in the Supabase SQL editor (Settings > SQL Editor)
-- =============================================================

-- ── Drop existing tables (safe re-run) ─────────────────────
drop table if exists issue_reports      cascade;
drop table if exists audit_log          cascade;
drop table if exists recurring_charges  cascade;
drop table if exists income_extras      cascade;
drop table if exists payment_receipts   cascade;
drop table if exists expenses           cascade;
drop table if exists contracts          cascade;
drop table if exists tenant_profiles    cascade;
drop table if exists room_photos        cascade;
drop table if exists rooms              cascade;
drop table if exists room_types         cascade;
drop table if exists properties         cascade;

-- ── Properties ─────────────────────────────────────────────
create table properties (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text not null default ''
);

insert into properties (name, slug, address) values ('El Maestro', 'el-maestro', 'Zona 15, Ciudad de Guatemala');
insert into properties (name, slug, address) values ('Tecun', 'tecun', 'Zona 15, Ciudad de Guatemala');

-- ── Room types ─────────────────────────────────────────────
create table room_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug in ('pequena','estandar','grande','loft')),
  label       text not null,
  price       int  not null,
  description text not null default ''
);

insert into room_types (slug, label, price, description) values ('pequena',  'Habitacion Pequena',  1600, 'Pequena y economica');
insert into room_types (slug, label, price, description) values ('estandar', 'Habitacion Estandar', 2000, 'Estandar');
insert into room_types (slug, label, price, description) values ('grande',   'Habitacion Grande',   2500, 'Grande con bano privado');
insert into room_types (slug, label, price, description) values ('loft',     'Loft de 2 Niveles',   3000, 'Loft dos niveles');

-- ── Rooms ──────────────────────────────────────────────────
create table rooms (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid references properties on delete cascade not null,
  identifier  text not null,
  type_id     uuid references room_types on delete set null,
  status      text not null default 'available'
              check (status in ('available','occupied','expiring_soon','renovation')),
  sort_order  int  not null default 0,
  unique (property_id, identifier)
);

-- Seed El Maestro rooms (1-20 + lofts A-G)
do $$
declare
  p_id uuid := (select id from properties where slug = 'el-maestro');
  i int;
  loft_ids text[] := array['A','B','C','D','E','F','G'];
begin
  for i in 1..20 loop
    insert into rooms (property_id, identifier, sort_order)
    values (p_id, i::text, i);
  end loop;
  for i in 1..array_length(loft_ids, 1) loop
    insert into rooms (property_id, identifier, sort_order)
    values (p_id, loft_ids[i], 20 + i);
  end loop;
end $$;

-- Seed Tecun rooms (1-26)
do $$
declare
  p_id uuid := (select id from properties where slug = 'tecun');
  i int;
begin
  for i in 1..26 loop
    insert into rooms (property_id, identifier, sort_order)
    values (p_id, i::text, i);
  end loop;
end $$;

-- ── Room photos (managed by admin via Storage) ──────────────
create table room_photos (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid references rooms on delete cascade not null,
  storage_path  text not null,
  display_order int  not null default 0,
  created_at    timestamptz not null default now()
);

-- ── Tenant profiles ────────────────────────────────────────
create table tenant_profiles (
  id          uuid primary key references auth.users on delete cascade,
  room_id     uuid references rooms on delete set null,
  contract_id uuid,
  name        text not null,
  phone       text not null default '',
  email       text not null default ''  -- copia del email de auth.users (login); se sincroniza vía /api/admin/update-tenant-email
);

-- ── Contracts ──────────────────────────────────────────────
create table contracts (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid references rooms on delete cascade not null,
  tenant_profile_id  uuid references tenant_profiles on delete cascade not null,
  start_date         date not null,
  duration_months    int  not null default 6,
  end_date           date not null,
  payment_day        int  not null default 1 check (payment_day between 1 and 31),
  whatsapp_template  text,
  status             text not null default 'active' check (status in ('active','ended')),
  signed_at          timestamptz,  -- contrato firmado recibido (null = aún no)
  monthly_rent       numeric(10,2),  -- renta negociada; null = precio de lista del tipo
  notes              text,
  contract_file_path text   -- archivo firmado en bucket 'contracts'
);

alter table tenant_profiles
  add constraint fk_contract foreign key (contract_id) references contracts on delete set null;

-- ── Payment receipts ───────────────────────────────────────
create table payment_receipts (
  id                 uuid primary key default gen_random_uuid(),
  tenant_profile_id  uuid references tenant_profiles on delete cascade not null,
  contract_id        uuid references contracts on delete cascade not null,
  period_month       text not null,   -- 'YYYY-MM'
  storage_path       text not null,
  file_hash          text,
  uploaded_at        timestamptz not null default now(),
  rejected           boolean not null default false,
  rejection_reason   text,
  verified           boolean not null default false,
  unique (contract_id, period_month)
);

-- ── Expenses ───────────────────────────────────────────────
create table expenses (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid references properties on delete cascade,  -- null = shared
  category    text not null check (category in ('guardian_salary','commission','internet','iusi','electricity','water')),
  type        text not null check (type in ('fixed','variable')),
  amount      numeric(10,2) not null,
  period      text not null,  -- 'YYYY-MM'
  notes       text
);

-- ── Income extras (one-time charges) ───────────────────────
create table income_extras (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts on delete cascade not null,
  room_id     uuid references rooms on delete cascade not null,
  type        text not null check (type in ('additional_person','parking','contract_signing','deposit')),
  amount      numeric(10,2) not null,
  date        date not null default current_date,
  notes       text
);

-- ── Recurring charges (monthly, billed with rent) ──────────
create table recurring_charges (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts on delete cascade not null,
  room_id     uuid references rooms on delete cascade not null,
  type        text not null check (type in ('additional_person','parking')),
  amount      numeric(10,2) not null,
  created_at  timestamptz not null default now()
);

-- ── Audit log (bitácora — append only, super_admin reads) ──
create table audit_log (
  ticket      bigint generated always as identity primary key,
  actor_id    uuid,
  actor_email text,
  actor_role  text,
  action      text not null,
  entity      text,
  entity_ref  text,
  created_at  timestamptz not null default now()
);

-- ── Issue reports (tenant-reported damages → backoffice tasks)
create table issue_reports (
  id                uuid primary key default gen_random_uuid(),
  contract_id       uuid references contracts on delete cascade,
  tenant_profile_id uuid references tenant_profiles on delete set null,
  room_id           uuid references rooms on delete cascade not null,
  property_id       uuid references properties on delete cascade not null,
  tenant_name       text,
  description       text not null,
  status            text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

-- =============================================================
-- Row Level Security
-- =============================================================

alter table properties      enable row level security;
alter table room_types      enable row level security;
alter table room_photos     enable row level security;
alter table rooms           enable row level security;
alter table contracts       enable row level security;
alter table tenant_profiles enable row level security;
alter table payment_receipts enable row level security;
alter table expenses        enable row level security;
alter table income_extras   enable row level security;
alter table recurring_charges enable row level security;
alter table audit_log       enable row level security;
alter table issue_reports   enable row level security;

-- Grant table-level access to Supabase roles
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Helper: read current user role from auth.users (SECURITY DEFINER bypasses auth schema restriction)
create or replace function public.current_user_role()
returns text language sql security definer stable
set search_path = public as $$
  select raw_user_meta_data->>'role' from auth.users where id = auth.uid()
$$;

-- Public read for rooms (front office availability)
create policy "rooms_public_read"   on rooms           for select using (true);
create policy "types_public_read"   on room_types      for select using (true);
create policy "photos_public_read"  on room_photos     for select using (true);
create policy "props_public_read"   on properties      for select using (true);

-- Admin full access (role super_admin or admin in user_metadata)
create policy "admin_all_rooms"     on rooms           for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));
create policy "admin_all_contracts" on contracts       for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));
create policy "admin_all_profiles"  on tenant_profiles for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));
create policy "admin_all_receipts"  on payment_receipts for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));
create policy "admin_all_expenses"  on expenses        for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));
create policy "admin_all_extras"    on income_extras   for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));
create policy "admin_all_recurring" on recurring_charges for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));
create policy "admin_all_photos"    on room_photos     for all
  using      (public.current_user_role() in ('super_admin','admin'))
  with check (public.current_user_role() in ('super_admin','admin'));

-- Audit log: any admin can append; only super_admin can read; immutable
create policy "audit_insert" on audit_log for insert with check ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));
create policy "audit_super_read" on audit_log for select using ((auth.jwt()->'user_metadata'->>'role') = 'super_admin');

-- Issue reports: admin full access
create policy "admin_all_issues" on issue_reports for all using ((auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin'));

-- Tenant: read own profile and contract, insert receipt for own contract
create policy "tenant_own_profile"  on tenant_profiles  for select using (auth.uid() = id);
create policy "tenant_own_contract" on contracts         for select using (
  tenant_profile_id = auth.uid()
);
create policy "tenant_own_receipts_read"   on payment_receipts for select using (tenant_profile_id = auth.uid());
create policy "tenant_own_receipts_insert" on payment_receipts for insert with check (tenant_profile_id = auth.uid());
create policy "tenant_own_receipts_update" on payment_receipts for update using (tenant_profile_id = auth.uid());

-- Tenant: read own charges (to show total to pay)
create policy "tenant_own_extras_read" on income_extras for select using (
  contract_id = (select contract_id from tenant_profiles where id = auth.uid())
);
create policy "tenant_own_recurring_read" on recurring_charges for select using (
  contract_id = (select contract_id from tenant_profiles where id = auth.uid())
);

-- Tenant: report issues and read own reports
create policy "tenant_own_issues_insert" on issue_reports for insert with check (tenant_profile_id = auth.uid());
create policy "tenant_own_issues_read"   on issue_reports for select using (tenant_profile_id = auth.uid());

-- =============================================================
-- Storage buckets (create in Supabase dashboard or via CLI)
-- bucket: room-photos        (public)
-- bucket: receipts           (private, tenant-scoped)
-- bucket: contracts          (private, admin-only)
-- =============================================================

-- Storage policies for room-photos: public read, admin write.
-- Uploading/deleting goes through RLS on storage.objects even for a
-- public bucket — public only grants read.
drop policy if exists "room_photos_public_read"   on storage.objects;
drop policy if exists "room_photos_admin_insert"  on storage.objects;
drop policy if exists "room_photos_admin_delete"  on storage.objects;
drop policy if exists "room_photos_admin_update"  on storage.objects;

create policy "room_photos_public_read"
  on storage.objects for select
  using ( bucket_id = 'room-photos' );

create policy "room_photos_admin_insert"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'room-photos' and public.current_user_role() in ('super_admin','admin') );

create policy "room_photos_admin_delete"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'room-photos' and public.current_user_role() in ('super_admin','admin') );

create policy "room_photos_admin_update"
  on storage.objects for update to authenticated
  using ( bucket_id = 'room-photos' and public.current_user_role() in ('super_admin','admin') );

-- Storage policies for contracts (signed contract files): admin-only.
drop policy if exists "contracts_admin_read"   on storage.objects;
drop policy if exists "contracts_admin_insert" on storage.objects;
drop policy if exists "contracts_admin_update" on storage.objects;
drop policy if exists "contracts_admin_delete" on storage.objects;

create policy "contracts_admin_read"
  on storage.objects for select to authenticated
  using ( bucket_id = 'contracts' and public.current_user_role() in ('super_admin','admin') );

create policy "contracts_admin_insert"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'contracts' and public.current_user_role() in ('super_admin','admin') );

create policy "contracts_admin_update"
  on storage.objects for update to authenticated
  using ( bucket_id = 'contracts' and public.current_user_role() in ('super_admin','admin') )
  with check ( bucket_id = 'contracts' and public.current_user_role() in ('super_admin','admin') );

create policy "contracts_admin_delete"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'contracts' and public.current_user_role() in ('super_admin','admin') );
