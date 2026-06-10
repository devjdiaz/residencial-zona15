---
tags: [runbook, ops]
actualizado: 2026-06-10
---

# Runbook

Volver a [[00-Indice]].

## Correr local
```bash
npm install
npm run dev      # http://localhost:3000
```
Otros scripts: `npm run build` · `npm run start` · `npm run lint`.

La BD local apunta al **mismo Supabase de producción** (no hay instancia separada). Cuidado al probar — los datos son reales. Ver [[constraints-produccion]].

## Variables de entorno (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # solo server-side, nunca exponer
```
Se obtienen en: Supabase Dashboard → Settings → API. Plantilla en `.env.local.example`.

## Deploy
- **Vercel** (`vercel.json`). Push a `main` → deploy automático.
- Las mismas 3 env vars deben estar configuradas en Vercel.

> [!todo] Completar
> - Link al proyecto en Vercel
> - Confirmar si hay preview deploys por PR

## Aplicar cambios de SQL en producción (seguro)
1. **Nunca** correr `supabase/schema.sql` completo (tiene `drop ... cascade`).
2. Escribir migración **aditiva** (`alter table`, `create policy`, `create function`...).
3. Envolver en `begin; ... commit;` para que sea atómico.
4. Probar en el SQL Editor de Supabase.
5. Reflejar el mismo cambio en `supabase/schema.sql` (para entornos nuevos) en una rama → PR.

Ejemplo real: el fix de RLS de fotos en [[2026-06-08-rls-fotos-storage]].

## Diagnóstico útil
```sql
-- rol actual de un usuario
select email, raw_user_meta_data->>'role' from auth.users where email = '...';

-- policies de storage
select policyname, cmd, qual, with_check
from pg_policies where schemaname='storage' and tablename='objects';
```
