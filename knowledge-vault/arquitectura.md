---
tags: [arquitectura]
actualizado: 2026-06-10
---

# Arquitectura

Volver a [[00-Indice]].

## Stack
- **Next.js** — ⚠️ versión con breaking changes vs. lo conocido. Ver `AGENTS.md`: leer `node_modules/next/dist/docs/` antes de escribir código.
- **Supabase** (`@supabase/ssr`) — auth, Postgres, storage.
- **@base-ui/react** — componentes UI.
- **Vercel** — deploy (`vercel.json`).

## Roles
Guardados en `auth.users.user_metadata.role`. Tres valores:

| Rol | Acceso |
|-----|--------|
| `super_admin` | Todo + gestiona personal (admins) + lee bitácora |
| `admin` | Gestión operativa (cuartos, contratos, recibos, inquilinos) |
| `tenant` | Su propio perfil, contrato, recibos, reportar daños |

Verificación en dos capas:
- **Middleware** `proxy.ts` → `supabase.auth.getUser()` (fresco, vía API). Protege `/admin/*` y `/tenant/*`.
- **RLS** en Postgres → ver [[modelo-datos]]. Para fotos usa `current_user_role()`; ver [[2026-06-08-rls-fotos-storage]] del por qué.

## Rutas
- **Sitio público** — disponibilidad de cuartos.
- **`/admin/*`** (super_admin, admin): `login`, `rooms`, `bitacora`, `personal`, `reportes`.
- **`/tenant/*`** (tenant): `login`, `dashboard`.

## API routes (`app/api/admin/`)
Server-side, usan el **service role** (`createServiceClient`) para operaciones privilegiadas:
- `create-staff` / `delete-staff` / `list-staff` — gestión de admins (solo super_admin).
- `create-tenant` / `delete-tenant` / `reset-tenant-password` — gestión de inquilinos.

## Clientes Supabase (`lib/supabase/`)
- `client.ts` — **browser**, anon key + sesión del usuario. Sujeto a RLS.
- `server.ts` — `createClient()` (server, anon) y `createServiceClient()` (service role, **bypasea RLS**).
- `proxy.ts` (raíz) — middleware de protección de rutas.
- `lib/audit.ts` — `logAudit()` escribe en `audit_log` (append-only). Falla en silencio, nunca rompe la acción principal.

## Componentes admin clave (`components/admin/`)
`RoomGrid` · `RoomsView` · `RoomPhotoDialog` (sube/borra fotos a storage) · `ContractDialog` · `FinancesPanel` · `ReportsManager` · `StaffManager` · `AccountDialog` · `AdminHeader`.
