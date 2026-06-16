---
tags: [decisiones, auth, roles]
fecha: 2026-06-16
---

# Rol "guardian" — acceso solo a Reportes (2026-06-16)

Volver a [[00-Indice]] · [[roles-en-user-metadata]].

## Por qué
El cliente tiene un trabajador (Julio) que hace mantenimiento/multiusos en las habitaciones — arregla daños, pinta, soluciona problemas. Necesita iniciar sesión y ver los reportes que suben los inquilinos desde su portal para ir a solucionarlos, pero sin acceso a finanzas, contratos, cuartos ni personal.

## Decisión
Nuevo rol `guardian` en `user_metadata.role`, con su propia área `/guardian` (login + dashboard único), siguiendo el mismo patrón ya usado para separar `/admin` de `/tenant` — no se reutilizó el panel admin con nav recortada porque eso solo oculta enlaces en la UI, no bloquea el acceso real a la URL.

- **Alcance**: ve los reportes de **ambas propiedades** (El Maestro y Tecún), sin filtro — igual que ve un admin. Se eligió así por simplicidad; no hay modelo de "propiedad asignada" a un guardián.
- **Permisos en `issue_reports`**: solo `select` + `update` (lee y cambia status: abierto → en proceso → resuelto). No puede `insert` (no crea reportes) ni `delete`.
- **Quién lo crea**: solo `super_admin`, vía el mismo flujo de `create-staff` que ya usa para crear `admin` (ahora con un selector de rol en `StaffManager`).
- **Reutilización de UI**: el dashboard de `/guardian` monta `ReportsManager` (el mismo componente que usa `/admin/reportes`) sin modificarlo — ya soporta listar, filtrar por estado y cambiar status.
- **Auditoría**: se amplió la policy `audit_insert` para incluir `guardian`, así sus cambios de estado quedan en `audit_log` igual que los de un admin.

## Implementación
- `proxy.ts`: tercer bloque de protección de rutas, igual al de `/tenant`.
- `app/guardian/{layout,login/page,dashboard/page}.tsx` (nuevos).
- Migración `supabase/migrations/2026-06-16_guardian-role.sql`: `guardian_read_issues`, `guardian_update_issues` en `issue_reports`; `alter policy audit_insert` para sumar `guardian`.
- `app/api/admin/create-staff/route.ts`: acepta `role: "admin" | "guardian"` (antes hardcodeado a `"admin"`).
- `app/api/admin/list-staff/route.ts`: incluye `guardian` en el filtro de listado.
- `components/admin/StaffManager.tsx`: selector de rol al crear cuenta, badge visual distinto para guardián.

## Estado
Código completo. `tsc --noEmit` limpio; `eslint` limpio salvo un error preexistente no relacionado en `StaffManager.tsx` (`react-hooks/set-state-in-effect`, ya existía antes de este cambio). Migración pendiente de aplicar en producción por el usuario. Rama `feature/rol-guardian`, sin commit todavía.
