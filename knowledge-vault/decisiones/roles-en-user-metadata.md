---
tags: [decision, auth, roles]
fecha: 2026-06-08
estado: vigente
---

# Decisión: roles en `user_metadata`

Volver a [[00-Indice]] · [[arquitectura]].

## Contexto
El sistema necesita roles: `super_admin`, `admin`, `tenant` y (desde 2026-06-16) `guardian`.

## Decisión
Guardar el rol en `auth.users.user_metadata.role`. Se asigna al crear el usuario (ver `app/api/admin/create-staff` —ahora acepta `role: "admin" | "guardian"`— y `create-tenant`, que sigue fijo a `"tenant"`).

El rol `guardian` se agregó para Julio (mantenimiento): necesitaba ver y actualizar reportes de daños sin acceso al resto del panel admin. No se reutilizó `admin` con una vista recortada porque eso solo oculta enlaces en la UI — la URL seguiría siendo accesible. Se siguió el mismo patrón ya usado para separar `/admin` de `/tenant`: una tercera área `/guardian` con su propio login, protegida por middleware + RLS propia (`guardian_read_issues`/`guardian_update_issues` en `issue_reports`, sin policy en ninguna otra tabla). Detalle: [[rol-guardian]].

## Consecuencias
- ✅ Simple: el rol viaja en el JWT y en `auth.users`.
- ✅ El middleware `proxy.ts` lo lee con `getUser()` (siempre fresco).
- ⚠️ **Trampa:** RLS con `auth.jwt()->'user_metadata'->>'role'` lee el **JWT del browser**, que puede estar viejo si el rol se asignó después de emitir el token. Esto causó el bug de fotos → [[2026-06-08-rls-fotos-storage]].
- 🔧 Mitigación: para checks RLS sensibles usar `current_user_role()` (lee `auth.users` directo). Ver [[modelo-datos]].

## Alternativas descartadas
- Tabla `roles` separada → más joins, no aporta para 3 roles fijos.
- Custom claims vía hook de auth → más complejidad de la necesaria por ahora.
