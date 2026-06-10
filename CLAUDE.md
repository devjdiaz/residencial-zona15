@AGENTS.md

# Knowledge vault (Obsidian)

Este proyecto está **en producción**. El contexto, arquitectura, modelo de datos, runbook y decisiones viven en `knowledge-vault/` (vault de Obsidian, solo las notas `.md` se versionan).

- **Al inicio de la sesión:** leer `knowledge-vault/00-Indice.md` para retomar contexto. Es el punto de entrada y enlaza al resto.
- **Antes de tocar producción:** revisar `knowledge-vault/constraints-produccion.md` (reglas innegociables: ramas + PR, nunca re-ejecutar `schema.sql`, migraciones aditivas).
- **Al terminar trabajo relevante:** crear/actualizar `knowledge-vault/bitacora-sesiones/AAAA-MM-DD.md` (qué se hizo, estado al cerrar, pendientes) y actualizar la nota afectada (`arquitectura.md`, `modelo-datos.md`, o una nueva en `decisiones/`). Usar wikilinks `[[...]]` para conectar.
