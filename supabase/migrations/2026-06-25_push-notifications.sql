-- Migración aditiva — notificaciones push al admin (PWA + Web Push) e historial de avisos.
--
-- NO aplicar todavía: pendiente de validación. Crea dos tablas:
--   push_subscriptions  — suscripciones Web Push del admin (un registro por dispositivo).
--   notifications       — historial de avisos para el "centro de avisos" del panel.
-- Idempotente donde es posible. Reflejada en schema.sql.

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,            -- receipt | abono_request | abono_payment | issue
  title       text not null,
  body        text,
  url         text,                     -- a dónde lleva al tocar (/admin/historial, etc.)
  room_id     uuid,
  contract_id uuid,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_unread_idx on notifications (read, created_at desc);

alter table push_subscriptions enable row level security;
alter table notifications      enable row level security;

-- push_subscriptions: el admin gestiona las suyas.
drop policy if exists "push_subs_admin_own" on push_subscriptions;
create policy "push_subs_admin_own" on push_subscriptions
  for all to authenticated
  using ( user_id = auth.uid() and public.current_user_role() in ('super_admin','admin') )
  with check ( user_id = auth.uid() and public.current_user_role() in ('super_admin','admin') );

-- notifications: el admin lee/actualiza/borra; el insert lo hace el endpoint con service-role.
drop policy if exists "notifications_admin_all" on notifications;
create policy "notifications_admin_all" on notifications
  for all to authenticated
  using ( public.current_user_role() in ('super_admin','admin') )
  with check ( public.current_user_role() in ('super_admin','admin') );
