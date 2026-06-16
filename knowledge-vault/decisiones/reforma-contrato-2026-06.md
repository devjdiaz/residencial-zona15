---
tags: [decisiones, contrato]
fecha: 2026-06-16
---

# Reforma del contrato de arrendamiento (2026-06-16)

Volver a [[00-Indice]].

## Qué cambió y por qué
El cliente (arrendadora) decidió que ya no se puede cobrar mora, así que se eliminó esa cláusula de `components/ContractPDF.tsx` (era el único lugar donde existía — no había campo de BD ni lógica de cálculo). Además se confirmaron varios cambios de producto al contrato:

1. **Depósito visible en el PDF**: la cláusula de depósito ahora es dinámica — muestra el monto exacto si se pagó (lee `income_extras` tipo `deposit`) o aclara que no se pagó. Se agregó una cláusula nueva: si el inquilino se va antes de cumplir el plazo pactado, el depósito no se devuelve.
2. **Persona adicional con datos propios**: se reutilizó el checkbox existente "Persona adicional (mensual)" (antes solo activaba un cargo recurrente sin identidad) para que, al marcarlo, también pida nombre/DPI/teléfono/teléfono alterno de esa persona — igual que al inquilino principal, pero **sin correo**, porque **nunca tiene credenciales ni acceso al portal** (solo el inquilino principal inicia sesión). Estos datos viven en `contracts` (no en `tenant_profiles`, que es 1:1 con `auth.users`).
3. **Cancelación anticipada**: 15 → 30 días de aviso.
4. **Cláusulas nuevas**: mantenimiento/limpieza, huéspedes (máx. 2 noches sin autorización), prohibición de fumar (causal de terminación + no devolución de depósito), convivencia, causales de terminación inmediata, impago reiterado (2 pagos consecutivos o alternos), entrega de llaves (cambio de cerraduras se descuenta del depósito), y aclaración de que la renta no incluye garita.

Numeración final de cláusulas del contrato: 1-USO, 2-PROHIBICIONES, 3-MANTENIMIENTO Y LIMPIEZA, 4-HUÉSPEDES, 5-PROHIBICIÓN DE FUMAR, 6-CONVIVENCIA, 7-DEPÓSITO (dinámico), 8-NO DEVOLUCIÓN POR SALIDA ANTICIPADA, 9-TERMINACIÓN ANTICIPADA (30 días), 10-CAUSALES DE TERMINACIÓN INMEDIATA, 11-IMPAGO REITERADO, 12-DAÑOS, 13-ENTREGA DE LLAVES, 14-GARITA.

## Implementación
- Migración aditiva: `supabase/migrations/2026-06-16_contract-additional-person.sql` (`contracts.has_additional_person` + 4 columnas de texto). Ver [[modelo-datos]].
- `lib/supabase/types.ts`, `components/admin/ContractDialog.tsx` (crear), `components/admin/ContractInfoDialog.tsx` (editar), `app/api/contracts/[contractId]/pdf/route.ts` (lee el depósito real de `income_extras` y las columnas nuevas), `components/ContractPDF.tsx` (sección "PERSONA ADICIONAL AUTORIZADA" condicional + las 14 cláusulas).
- No se tocó `app/api/admin/create-tenant/route.ts` — sigue siendo solo para el inquilino principal.

## Estado (parte 1: mora/depósito/persona adicional/cláusulas)
`tsc --noEmit` y `eslint` limpios (verificado solo en los archivos tocados; el resto del repo ya tenía errores de lint preexistentes no relacionados — `FinancesPanel.tsx`, `HistorialView.tsx`, `ReportsManager.tsx`, `RoomGrid.tsx`, `StaffManager.tsx`, todos por la regla `react-hooks/set-state-in-effect`).

Migración `2026-06-16_contract-additional-person.sql` **aplicada en producción** por el usuario vía SQL Editor. PDF de ejemplo generado contra un contrato real (sin persona adicional) y revisado: sin mora, depósito dinámico, 30 días, 14 cláusulas, paginación correcta (2 páginas, sin cortes). Falta probar en el navegador el flujo de crear/editar contrato marcando "Persona adicional".

## Parte 2: vehículo en el parqueo (mismo día)
Mismo patrón, ahora para el checkbox existente "Parqueo (mensual)": al marcarlo, pide tipo de vehículo (selector cerrado **moto/carro**), marca, línea, color y placa — sin acceso a la plataforma (es solo dato del contrato, no de una persona con cuenta).
- Migración: `supabase/migrations/2026-06-16_contract-parking-vehicle.sql` (`contracts.has_parking` + `parking_vehicle_type/brand/line/color/plate`; `parking_vehicle_type` con `check` en `('', 'moto', 'carro')`).
- Misma sección condicional en el PDF: "VEHÍCULO AUTORIZADO (PARQUEO)", justo después de "PERSONA ADICIONAL AUTORIZADA".
- Estado: código completo, `tsc --noEmit`/`eslint` limpios, migración aplicada en producción por el usuario. PDF de ejemplo regenerado tras aplicar y confirma 200 OK (este contrato de prueba no tiene parqueo, así que la sección no aparece — falta probar en el navegador el caso con parqueo activo).

Rama: `feature/historial-module`. Sin commit todavía — pendiente de autorización del usuario.
