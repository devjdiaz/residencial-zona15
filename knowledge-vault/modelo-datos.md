---
tags: [datos, supabase, rls]
actualizado: 2026-06-10
---

# Modelo de datos

Volver a [[00-Indice]]. Fuente: `supabase/schema.sql`.

> [!danger] No re-ejecutar `schema.sql` en producción
> Empieza con `drop table ... cascade`. Borraría todos los datos del cliente. Cambios en prod = migraciones aditivas. Ver [[constraints-produccion]].

## Tablas

| Tabla | Para qué | RLS |
|-------|----------|-----|
| `properties` | El Maestro, Tecun | lectura pública + admin todo |
| `room_types` | pequena/estandar/grande/loft + precio | lectura pública + admin todo |
| `rooms` | cuartos por propiedad, estado | lectura pública + admin todo |
| `room_photos` | fotos de cuartos (path en storage) | lectura pública + admin escribe |
| `tenant_profiles` | perfil inquilino (FK a `auth.users`) | dueño lee + admin todo |
| `contracts` | contrato: fechas, día de pago, estado | dueño lee + admin todo |
| `payment_receipts` | recibos mensuales, hash, rechazo, verificación | dueño CRUD propio + admin todo |
| `expenses` | gastos por propiedad/compartidos | admin todo |
| `income_extras` | cargos únicos (depósito, firma, persona extra, parqueo) | admin todo + dueño lee |
| `recurring_charges` | cargos mensuales recurrentes | admin todo + dueño lee |
| `audit_log` | bitácora append-only | admin inserta + **solo super_admin lee** |
| `issue_reports` | daños reportados por inquilino | dueño inserta/lee + admin todo |

## Patrón RLS de admin
La mayoría de policies de admin usan:
```sql
(auth.jwt()->'user_metadata'->>'role') in ('super_admin','admin')
```
⚠️ Esto lee el **JWT del browser** (puede estar desactualizado si el rol se asignó después de emitir el token).

## `current_user_role()` — patrón corregido
Función `SECURITY DEFINER` que lee el rol **fresco** de `auth.users` (no del JWT):
```sql
create or replace function public.current_user_role()
returns text language sql security definer stable
set search_path = public as $$
  select raw_user_meta_data->>'role' from auth.users where id = auth.uid()
$$;
```
Usada por las policies del bucket `room-photos`. El porqué: [[2026-06-08-rls-fotos-storage]].

## Storage buckets
- **`room-photos`** — público para lectura; escritura (insert/delete/update) solo admin vía `current_user_role()`. Path: `rooms/{roomId}/{timestamp}-{filename}`.
- **`receipts`** — privado, scoped por tenant. Path: `{user.id}/{periodo}/{filename}`.

> [!warning] Bucket público ≠ escritura pública
> "Público" solo da lectura. Subir/borrar pasa igual por RLS de `storage.objects`. Faltaban esas policies → causó el bug de fotos.
