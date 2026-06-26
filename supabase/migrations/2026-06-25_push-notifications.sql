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

-- Grants (las tablas nuevas no heredan el grant global de schema.sql).
grant all on table push_subscriptions to anon, authenticated, service_role;
grant all on table notifications      to anon, authenticated, service_role;

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

-- =============================================================
-- Disparo automático: cuando el inquilino crea un evento → POST a /api/notify
-- (que decide si notificar y manda el Web Push). Usa pg_net (async).
-- El cuerpo va envuelto en un EXCEPTION que traga cualquier error para que
-- una falla de notificación NUNCA bloquee el insert del inquilino.
-- Reemplazar __NOTIFY_WEBHOOK_SECRET__ por el valor real (no versionado).
-- =============================================================
create extension if not exists pg_net;

create or replace function public.notify_admin_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform net.http_post(
      url := 'https://residencial-zona15.vercel.app/api/notify',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '__NOTIFY_WEBHOOK_SECRET__'),
      body := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'record', to_jsonb(NEW))
    );
  exception when others then
    null; -- nunca bloquear el insert por un fallo de notificación
  end;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_receipt    on payment_receipts;
drop trigger if exists trg_notify_abono_req  on abono_requests;
drop trigger if exists trg_notify_abono_pay  on abono_payments;
drop trigger if exists trg_notify_issue      on issue_reports;

create trigger trg_notify_receipt   after insert or update on payment_receipts for each row execute function public.notify_admin_event();
create trigger trg_notify_abono_req after insert            on abono_requests   for each row execute function public.notify_admin_event();
create trigger trg_notify_abono_pay after insert            on abono_payments   for each row execute function public.notify_admin_event();
create trigger trg_notify_issue     after insert            on issue_reports    for each row execute function public.notify_admin_event();
