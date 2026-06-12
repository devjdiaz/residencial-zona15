---
tags: [decision, historial, storage]
fecha: 2026-06-12
---

# Módulo Historial + archivo del contrato firmado

Volver a [[00-Indice]]. Relacionado: [[modelo-datos]] · [[2026-06-08-rls-fotos-storage]] · [[email-inquilino-y-contrato-firmado]].

## Contexto
Los comprobantes de pago vivían dentro de Finanzas mezclados con KPIs, y el **archivo** del contrato firmado no existía en el sistema (solo el checkbox `signed_at`). El cliente quería los archivos mejor administrados, por habitación.

## Decisiones
1. **Módulo nuevo `/admin/historial`**: tabs por propiedad (El Maestro / Tecun), una fila por habitación con 3 botones en modales — Contrato (archivo firmado), Comprobantes (cronológico mes a mes) y Reportes (mismo flujo del módulo Reportes, filtrado por habitación).
2. **La verificación de comprobantes (Ver/Aceptar/Rechazar) se movió completa de Finanzas a Historial.** Finanzas ya no toca `payment_receipts` (sus KPIs nunca dependieron de esa tabla).
3. **Archivo del contrato firmado**: columna aditiva `contracts.contract_file_path` + bucket privado `contracts` (policies solo-admin con `current_user_role()`, NO `auth.jwt()` — mismo motivo que [[2026-06-08-rls-fotos-storage]]). Path: `{contract_id}/{filename}`, lectura por signed URL (300s). Se sube/reemplaza desde **dos lugares**: el modal Contrato de Historial y "Ver contrato" de Habitaciones (componente compartido `ContractFileManager`).
4. **Alcance: solo contrato activo** por habitación (decisión del cliente). Habitación sin contrato activo: fila con Contrato/Comprobantes deshabilitados; Reportes siempre activo porque `issue_reports` cuelga de `room_id`.
5. **Reutilización**: `ReportsManager` ganó prop opcional `roomId` en vez de duplicar el componente.

## Limitación conocida
Por el `unique(contract_id, period_month)` solo existe **un** comprobante por mes (las re-subidas tras rechazo sobreescriben). No hay histórico intra-mes.

## Migración
`supabase/migrations/2026-06-12_historial-contract-file.sql` — aditiva, idempotente, atómica. Aplicar en SQL Editor antes de desplegar.
