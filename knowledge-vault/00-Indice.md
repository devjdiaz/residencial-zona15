---
tags: [moc, indice]
proyecto: residencial-zona15
estado: produccion
actualizado: 2026-06-10
---

# 🏠 Residencial Zona 15 — Índice

> [!info] Punto de entrada del vault
> Este es el mapa del proyecto. Empieza aquí cada sesión. Las notas se enlazan entre sí con `[[wikilinks]]`.

## Qué es
Webapp de **gestión de residencias de alquiler** para un cliente en Zona 15, Ciudad de Guatemala. Administra dos propiedades — **El Maestro** y **Tecun** — con cuartos, contratos, inquilinos, recibos de pago, gastos, reportes de daños y bitácora de auditoría.

> [!warning] En producción
> El cliente ya usa el sistema y paga por él. Toda modificación sigue las reglas de [[constraints-produccion]].

## Estado actual
- **Productivo y en uso** por el cliente.
- Deploy en **Vercel**, backend en **Supabase**.
- Última feature grande: roles (super_admin/admin), bitácora de auditoría, reportes de daños, contratos con extras.
- Último fix: RLS de fotos en storage → ver [[2026-06-08-rls-fotos-storage]].

## Mapa de notas
- [[arquitectura]] — rutas, roles, componentes, clientes Supabase, middleware.
- [[modelo-datos]] — tablas, RLS, función `current_user_role()`, buckets de storage.
- [[runbook]] — correr local, env vars, deploy, cómo aplicar SQL en producción sin romper nada.
- [[constraints-produccion]] — reglas innegociables al tocar producción.
- **Decisiones:** [[roles-en-user-metadata]] · [[2026-06-08-rls-fotos-storage]] · [[editar-contrato-cobros]] · [[email-inquilino-y-contrato-firmado]] · [[2026-06-12-historial-y-archivo-contrato]] · [[renta-por-contrato]] · [[reforma-contrato-2026-06]] · [[rol-guardian]] · [[busqueda-admin]]
- **Bitácora de sesiones:** [[2026-06-08]] · [[2026-06-10]] · [[2026-06-12]] · [[2026-06-13]] · [[2026-06-15]] · [[2026-06-16]] · [[2026-06-25]]

## Enlaces externos
- Repo: `github.com/devjdiaz/residencial-zona15`
- Stack: Next.js · Supabase · Vercel · `@base-ui/react`

> [!todo] Completar
> - URL de producción (dominio del cliente)
> - Ref del proyecto Supabase
> - Link al dashboard de Vercel
