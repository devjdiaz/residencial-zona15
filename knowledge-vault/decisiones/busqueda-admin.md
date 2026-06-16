---
tags: [decisiones, admin, ux]
fecha: 2026-06-16
---

# Búsqueda global de inquilinos/contratos (2026-06-16)

Volver a [[00-Indice]].

## Por qué
Para corroborar o modificar un dato de un inquilino (teléfono, DPI, vehículo, etc.) el admin tenía que saber primero en qué cuarto y propiedad vivía, para buscarlo en Habitaciones. Con los campos agregados esta misma sesión (persona adicional, vehículo de parqueo — ver [[reforma-contrato-2026-06]]) hay cada vez más datos dispersos por contrato.

## Decisión
Página nueva `/admin/buscar` (`components/admin/SearchView.tsx`), visible para `admin` y `super_admin`:

- **Carga client-side, sin endpoint dedicado**: una sola query a `contracts` (sin filtrar por `status` ni por propiedad) con los embeds de `tenant_profile`/`room`/`property`/`room_type`, y se filtra en memoria. Se eligió así por el tamaño del negocio (~53 cuartos, pocas decenas de contratos históricos) — mismo patrón ya usado en `ReportsManager`/`RoomGrid`. No se construyó una query dinámica multi-columna en Postgres porque no aporta a esta escala.
- **Matching por tokens**: el texto buscado se separa en palabras; cada palabra debe aparecer en algún campo del contrato (nombre, teléfonos, DPI, correo, cuarto, propiedad, persona adicional, vehículo). Así "Mario 1" encuentra a Mario en el cuarto 1 sin importar el orden de las palabras.
- **Incluye contratos activos y terminados** (búsqueda histórica completa) — decisión explícita del cliente, no solo los activos.
- **Acceso al perfil sin navegar**: cada resultado tiene un botón "Ver contrato" que abre el mismo `ContractInfoDialog` que ya usa Habitaciones (editar todo, reset de contraseña, enviar credenciales, marcar firmado), montado directamente en la página de Buscar. Se descartó el deep-link a Habitaciones (cambiar de tab de propiedad + abrir el diálogo desde ahí) porque hubiera requerido tocar `RoomGrid`/`RoomsView`, y reutilizar el diálogo tal cual ya cubre el caso de uso sin ese trabajo extra.
- **Botón WhatsApp** en la tarjeta de resultado (no dentro del diálogo): abre el chat con el teléfono del inquilino principal sin mensaje precargado, vía el mismo helper `waLink()` de `lib/whatsapp.ts` ya usado en `RoomGrid`/`ContractInfoDialog`.

No hizo falta ninguna migración ni cambio de RLS — es una feature 100% de lectura sobre datos que ya estaban accesibles para admin/super_admin (`admin_all_contracts`, `admin_all_profiles`).

## Implementación
- `components/admin/SearchView.tsx` (nuevo)
- `app/admin/buscar/page.tsx` (nuevo)
- `components/admin/AdminHeader.tsx` — link "Buscar" en nav desktop y móvil

## Estado
Completo. `tsc --noEmit`/`eslint` limpios. Rama `feature/busqueda-admin`, commit `5e83401`. **PR #11 mergeado a `main`** el 2026-06-16 (merge commit `c7198fa`).
