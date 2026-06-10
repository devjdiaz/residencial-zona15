---
tags: [decision, auth, roles]
fecha: 2026-06-08
estado: vigente
---

# Decisión: roles en `user_metadata`

Volver a [[00-Indice]] · [[arquitectura]].

## Contexto
El sistema necesita tres roles: `super_admin`, `admin`, `tenant`.

## Decisión
Guardar el rol en `auth.users.user_metadata.role`. Se asigna al crear el usuario (ver `app/api/admin/create-staff` y `create-tenant`).

## Consecuencias
- ✅ Simple: el rol viaja en el JWT y en `auth.users`.
- ✅ El middleware `proxy.ts` lo lee con `getUser()` (siempre fresco).
- ⚠️ **Trampa:** RLS con `auth.jwt()->'user_metadata'->>'role'` lee el **JWT del browser**, que puede estar viejo si el rol se asignó después de emitir el token. Esto causó el bug de fotos → [[2026-06-08-rls-fotos-storage]].
- 🔧 Mitigación: para checks RLS sensibles usar `current_user_role()` (lee `auth.users` directo). Ver [[modelo-datos]].

## Alternativas descartadas
- Tabla `roles` separada → más joins, no aporta para 3 roles fijos.
- Custom claims vía hook de auth → más complejidad de la necesaria por ahora.
