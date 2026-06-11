---
tags: [decision, rls, storage, fix]
fecha: 2026-06-08
estado: aplicado
---

# Fix: RLS de fotos bloqueaba subida desde el backoffice

Volver a [[00-Indice]] · [[modelo-datos]].

## Síntoma
Al subir/borrar foto desde el panel admin: `new row violates row-level security policy`. El admin sí entraba al panel (middleware OK), pero la operación de foto fallaba.

## Causa raíz (en dos capas)
1. **El error venía de `storage.objects`, no de la tabla `room_photos`.** `RoomPhotoDialog.tsx` sube primero el archivo al bucket; esa línea fallaba antes de llegar al insert en la tabla.
2. La única policy de escritura del bucket `room-photos` chequeaba el rol con `auth.jwt()->'user_metadata'->>'role'` → leía el **JWT del browser desactualizado** (el rol se había asignado después de emitir el token) → `NULL in (...)` = false → RLS violation.
3. Un intento intermedio con `exists (select 1 from auth.users ...)` directo en la policy **también falla**: el rol `authenticated` no tiene acceso al schema `auth`.

## Solución aplicada
1. Función `SECURITY DEFINER` que lee el rol fresco de `auth.users`:
   ```sql
   create or replace function public.current_user_role()
   returns text language sql security definer stable
   set search_path = public as $$
     select raw_user_meta_data->>'role' from auth.users where id = auth.uid()
   $$;
   ```
2. Policies en `storage.objects` para el bucket `room-photos` (insert/delete/update admin + select público) usando `current_user_role()`.
3. Misma corrección en la policy de la tabla `room_photos`.
4. Borradas las viejas `admin_storage_insert` / `admin_storage_delete` (usaban el JWT roto).

Todo reflejado en `supabase/schema.sql`. Aplicado en prod vía SQL Editor (atómico).

## Lección
- "Bucket público" = solo lectura. Subir/borrar pasa por RLS de `storage.objects`.
- No leer `auth.users` directo en una policy; usar función `SECURITY DEFINER`.
- Relacionado: [[roles-en-user-metadata]].
