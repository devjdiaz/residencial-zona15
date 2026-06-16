---
tags: [decision]
fecha: 2026-06-13
---

# Renta mensual por contrato (`contracts.monthly_rent`)

Volver a [[00-Indice]]. Relacionado: [[modelo-datos]], [[2026-06-13]].

## Contexto
Hay inquilinos antiguos que pagan menos que el precio de lista del tipo de habitación (Q1,000–1,300 vs. precio actual) y el cliente no les sube el alquiler. Hasta ahora el precio salía SIEMPRE de `room_types.price`, así que:
- Finanzas (`FinancesPanel.tsx`) inflaba los ingresos esperados de esos contratos.
- El portal del inquilino (`app/tenant/dashboard`) le mostraba una renta que no era la suya.
- El PDF del contrato leía `rooms.price` (columna inexistente) → fallaba.

## Decisión
El precio negociado vive **en el contrato**, no en la habitación: `contracts.monthly_rent numeric(10,2)`.
- **Sigue al inquilino**: si el inquilino antiguo se va, el contrato nuevo arranca con el precio de lista (editable al crear).
- `room_types.price` queda como **precio de lista** (sitio público + valor por defecto al crear un contrato).
- Patrón de lectura en todos los consumidores: **`monthly_rent ?? room_type.price ?? 0`** (la columna es nullable; `null` = usar precio de lista).

## Backfill
La migración congela el precio de lista actual en los contratos existentes (`update ... set monthly_rent = rt.price where monthly_rent is null`), para que ninguno quede en `null` y el admin luego baje manualmente los de inquilinos antiguos a su precio real.

## Dónde se aplica
- **Crear** (`ContractDialog`): campo "Renta mensual" prellenado con el precio de lista, editable.
- **Ver/editar** (`ContractInfoDialog`): se muestra en modo lectura y se edita en el form. Recibe `listPrice` (de `room_type.price`) desde `RoomGrid` como fallback.
- **Finanzas** (`FinancesPanel.tsx`): `fixedIncome` suma `monthly_rent ?? room_type.price`.
- **Portal inquilino** (`app/tenant/dashboard/page.tsx`): `info.price` usa `monthly_rent ?? room_type.price`.
- **PDF** (`app/api/contracts/[contractId]/pdf/route.ts`): `monthlyPrice` usa `monthly_rent ?? room_type.price`. De paso se corrigió el bug del select (`rooms.price` → `rooms.room_type:room_types(price)`), que hacía fallar la ruta.
- **NO se tocó** el sitio público (`components/front/*`) — sigue mostrando el precio de lista.

## Bugs adicionales encontrados en el E2E (2026-06-15)
La ruta del PDF seguía devolviendo 404 incluso después del fix anterior, por dos causas independientes:
1. `require("@react-pdf/renderer")` — el paquete es ESM puro; Next.js lo trata como externo y el `require()` fallaba en runtime. Cambiado a `await import("@react-pdf/renderer")` dentro del handler.
2. El select embebía `tenant_profiles` sin desambiguar: `contracts` tiene dos FK hacia/desde esa tabla (`contracts_tenant_profile_id_fkey` y `fk_contract` en sentido inverso desde `tenant_profiles.contract_id`). PostgREST no podía resolver el embed. Fix: `tenant_profiles!contracts_tenant_profile_id_fkey(...)`.

Con el `require()` removido, TypeScript dejó de tipar `renderToBuffer` como `any` y expuso un mismatch real (`ContractPDFProps` vs `DocumentProps` que espera la librería al pasar un componente wrapper en vez de un `<Document>` literal) — resuelto con un cast dirigido (`as Parameters<typeof renderToBuffer>[0]`), patrón común al envolver `<Document>` en un componente propio.

## Pendiente — 3 contratos sin `monthly_rent` tras el backfill
Cuartos **4, 5 y 6 de El Maestro** no tienen `type_id` asignado (nunca se les puso tipo de habitación), así que el backfill no pudo congelarles un precio — quedaron en `null`, lo que hoy evalúa a Q0 en la app. Son contratos **activos** (vigentes hasta 2026-12-05). Acción: el cliente debe asignarles tipo desde el backoffice (`RoomGrid` ya tiene el dropdown), y luego correr de nuevo el `update` del backfill solo para esos.

## DPI y teléfono alterno del inquilino (2026-06-15)
El componente `ContractPDF.tsx` ya esperaba `tenantDpi`/`tenantPhoneAlt` desde que se creó, pero la ruta del PDF los mandaba siempre como `""` (no existían en `tenant_profiles`) — el contrato salía con esas líneas en blanco. Se agregó `tenant_profiles.dpi` y `tenant_profiles.phone_alt` (migración `2026-06-15_tenant-dpi-phone-alt.sql`, columnas `text not null default ''`), con campos editables en `ContractDialog` (crear) y `ContractInfoDialog` (ver/editar, para completar contratos ya existentes). La ruta del PDF ahora los lee de la tabla en vez de hardcodearlos. Probado E2E por el cliente, PDF sale completo.
