---
tags: [reglas, produccion]
actualizado: 2026-06-10
---

# Constraints de producción

Volver a [[00-Indice]].

> [!danger] El cliente ya usa el sistema y paga por él
> No se puede romper la BD ni perder datos ingresados desde el backoffice.

## Reglas innegociables
1. **Trabajar siempre en rama feature** (`feature/...` o `docs/...`). Nunca commitear directo a `main` sin razón.
2. **PR a `main`** para revisar antes de mergear. (Excepción puntual: fixes urgentes ya validados, con cuidado.)
3. **Nunca re-ejecutar `supabase/schema.sql`** en producción — hace `drop table ... cascade`. Solo migraciones **aditivas**.
4. Cambios SQL en prod: `begin; ... commit;` (atómicos), probados en SQL Editor.
5. **No tocar roles ni autenticación** sin necesidad — ya funcionan (super_admin/admin/tenant).
6. **No tocar código que ya funciona** si no es parte de la tarea.
7. La BD local = la de producción. Probar con datos reales con cuidado; limpiar datos de prueba.

## Estilo de trabajo con el cliente/dev
- Respuestas **breves y directas** — solo la solución salvo que se pida más.
- No inventar: lo que no se sabe se marca como `[!todo]` y se confirma.

## Obsidian
- El folder `.obsidian/` **no se versiona** (está en `.gitignore`). Solo las notas `.md`.

Relacionado: [[runbook]] · [[modelo-datos]].
