---
tags: [decision]
fecha: 2026-06-10
---

# Editar contrato: cobros únicos vs. mensuales

Volver a [[00-Indice]]. Relacionado: [[modelo-datos]], [[2026-06-10]].

## Contexto
Al agregar la edición de contratos (`ContractInfoDialog`, modo editar), el primer intento trató los 4 cobros como checkboxes idénticos y los reconciliaba igual (insert/update/**delete** según el toggle). Eso era peligroso para los cobros únicos.

## Cómo lee finanzas cada cobro (`FinancesPanel.tsx`)
- **Únicos** (`income_extras`: `deposit`, `contract_signing`) — tienen campo `date`. Finanzas los suma **solo en el mes de esa fecha** (`.like("date","YYYY-MM%")`). Es un **registro histórico** del mes de inicio. El tenant dashboard también los muestra en el primer mes.
- **Mensuales** (`recurring_charges`: `additional_person`, `parking`) — sin fecha. Finanzas los suma **todos los meses** mientras el contrato esté activo.

## Decisión
Editar NO trata ambos igual:
- **Mensuales**: checkbox con add/edit/**delete**. Quitar = "dejar de cobrar a futuro" (acción esperada y reversible).
- **Únicos**: nunca se borran ni se les cambia `date` al editar.
  - Si ya existe (precarga trae `id`) → solo se **actualiza el monto** (corregir typo). Se muestra como "registrado el {date}", sin checkbox para desmarcar.
  - Si no existe → checkbox "Agregar …" para registrarlo con la fecha de inicio del contrato.

## Por qué
Evitar que, al editar el contrato por otra razón (teléfono, agregar parqueo), el admin **borre o duplique por accidente** un ingreso ya registrado en finanzas de un mes pasado. La confusión "¿tengo que volver a marcar el depósito?" desaparece: los únicos ya registrados aparecen como tales y solo permiten corregir el monto.
