-- =============================================================
-- Residencial El Maestro — Supabase Schema
-- Run in the Supabase SQL editor (Settings > SQL Editor)
-- =============================================================

-- ── Properties ─────────────────────────────────────────────
create table properties (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text not null default ''
);

insert into properties (name, slug, address) values
  ('El Maestro', 'el-maestro', '17 Avenida D 0-22, Zona 15, Colonia El Maestro, Ciudad de Guatemala'),
  ('Tecún',      'tecun',      'Zona 15, Ciudad de Guatemala');

-- ── Room types ─────────────────────────────────────────────
create table room_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug in ('pequena','estandar','grande','loft')),
  label       text not null,
  price       int  not null,
  description text not null default ''
);

insert into room_types (slug, label, price, description) values
  ('pequena',  'Habitación Pequeña',  1600, 'Compacta y cálida, con todo lo necesario.'),
  ('estandar', 'Habitación Estándar', 2000, 'El equilibrio perfecto: buen tamaño, bien ventilada.'),
  ('grande',   'Habitación Grande',   2500, 'La más amplia. Baño propio y cama matrimonial.'),
  ('loft',     'Loft de 2 Niveles',   3000, 'Espacio en dos niveles, ideal para trabajar desde casa.');

-- ── Room photos (managed by admin via Storage) ──────────────
create table room_photos (
  id            uuid primary key default gen_random_uuid(),
  room_type_id  uuid references room_types on delete cascade,
  storage_path  text not null,
  display_order int  not null default 0,
  created_at    timestamptz not null default now()
);

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

-- Seed El Maestro rooms (1–20 + lofts A–G)
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

-- Seed Tecún rooms (1–21 + lofts 22–26)
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

-- ── Tenant profiles ────────────────────────────────────────
create table tenant_profiles (
  id          uuid primary key references auth.users on delete cascade,
  room_id     uuid references rooms on delete set null,
  contract_id uuid,
  name        text not null,
  phone       text not null default ''
);

-- ── Contracts ──────────────────────────────────────────────
create table contracts (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid references rooms on delete cascade not null,
  tenant_profile_id  uuid references tenant_profiles on delete cascade not null,
  start_date         date not null,
  duration_months    int  not null default 6,
  end_date           date not null generated always as (start_date + (duration_months || ' months')::interval)::date stored,
  payment_day        int  not null default 1 check (payment_day between 1 and 31),
  whatsapp_template  text,
  status             text not null default 'active' check (status in ('active','ended')),
  notes              text
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
  uploaded_at        timestamptz not null default now(),
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

-- ── Income extras ──────────────────────────────────────────
create table income_extras (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts on delete cascade not null,
  room_id     uuid references rooms on delete cascade not null,
  type        text not null check (type in ('additional_person','parking','contract_signing')),
  amount      numeric(10,2) not null,
  date        date not null default current_date,
  notes       text
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

-- Public read for rooms (front office availability)
create policy "rooms_public_read"   on rooms           for select using (true);
create policy "types_public_read"   on room_types      for select using (true);
create policy "photos_public_read"  on room_photos     for select using (true);
create policy "props_public_read"   on properties      for select using (true);

-- Admin full access (role = 'admin' in user_metadata)
create policy "admin_all_rooms"     on rooms           for all using ((auth.jwt()->'user_metadata'->>'role') = 'admin');
create policy "admin_all_contracts" on contracts       for all using ((auth.jwt()->'user_metadata'->>'role') = 'admin');
create policy "admin_all_profiles"  on tenant_profiles for all using ((auth.jwt()->'user_metadata'->>'role') = 'admin');
create policy "admin_all_receipts"  on payment_receipts for all using ((auth.jwt()->'user_metadata'->>'role') = 'admin');
create policy "admin_all_expenses"  on expenses        for all using ((auth.jwt()->'user_metadata'->>'role') = 'admin');
create policy "admin_all_extras"    on income_extras   for all using ((auth.jwt()->'user_metadata'->>'role') = 'admin');
create policy "admin_all_photos"    on room_photos     for all using ((auth.jwt()->'user_metadata'->>'role') = 'admin');

-- Tenant: read own profile and contract, insert receipt for own contract
create policy "tenant_own_profile"  on tenant_profiles  for select using (auth.uid() = id);
create policy "tenant_own_contract" on contracts         for select using (
  tenant_profile_id = auth.uid()
);
create policy "tenant_own_receipts_read"   on payment_receipts for select using (tenant_profile_id = auth.uid());
create policy "tenant_own_receipts_insert" on payment_receipts for insert with check (tenant_profile_id = auth.uid());
create policy "tenant_own_receipts_update" on payment_receipts for update using (tenant_profile_id = auth.uid());

-- =============================================================
-- Storage buckets (create in Supabase dashboard or via CLI)
-- bucket: room-photos  (public)
-- bucket: receipts     (private, tenant-scoped)
-- =============================================================
