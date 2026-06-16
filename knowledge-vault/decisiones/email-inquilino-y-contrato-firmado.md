---
tags: [decision]
fecha: 2026-06-12
---

# Email del inquilino, contrato firmado y flujo WhatsApp

Volver a [[00-Indice]]. Relacionado: [[modelo-datos]], [[2026-06-12]], [[editar-contrato-cobros]].

## Contexto
El ciclo del contrato se cierra por WhatsApp: (1) al crear el contrato se envía la plantilla para que el inquilino la llene, (2) cuando entrega el contrato firmado se le envían sus credenciales del portal. Además el admin necesita ver/editar el email del inquilino, que hasta ahora vivía solo en `auth.users` (invisible para el backoffice).

## Decisiones

### 1. Email: columna copia en `tenant_profiles`, fuente de verdad en `auth.users`
- Se agregó `tenant_profiles.email` (migración aditiva con backfill desde `auth.users`).
- **Por qué columna y no API de lectura:** `RoomGrid` ya trae el perfil embebido en la query de contratos — cero requests extra; las RLS existentes de la tabla ya cubren la columna.
- **Sincronización:** la única vía de escritura es `/api/admin/update-tenant-email`, que actualiza primero `auth.users` (`updateUserById` con `email_confirm: true` → el nuevo email es la credencial de login de inmediato, sin email de confirmación) y luego el perfil. Si auth falla (email duplicado), no se toca nada. En `ContractInfoDialog.handleSave` el email va PRIMERO: si falla, se aborta todo el guardado.

### 2. Contrato firmado: `contracts.signed_at timestamptz`
- `null` = no recibido. Timestamp (no boolean) para mostrar "recibido el …".
- Checkbox manual en "Ver contrato". Marcarlo habilita "Enviar credenciales por WhatsApp".

### 3. Credenciales por WhatsApp = contraseña nueva
- La contraseña no es recuperable (Supabase guarda hash). El botón genera una nueva con `generatePassword()` + `/api/admin/reset-tenant-password` (API sin cambios — recibe la pwd del cliente) y abre `wa.me` con portal + email + contraseña. El bloque verde de "nueva contraseña" queda como respaldo visual.

### 4. Plantilla del contrato: bucket público `contract-templates`
- Un solo archivo en la raíz (la plantilla vigente). Reemplazar = borrar el anterior + subir el nuevo (el nombre/extensión puede variar; se descubre con `list("")`).
- **Público para lectura** porque el inquilino descarga desde el link de WhatsApp sin sesión y un signed URL expiraría; la plantilla en blanco no es dato sensible. Escritura solo admin vía `current_user_role()` (mismo patrón que `room-photos`, ver [[2026-06-08-rls-fotos-storage]]).
- UI: botón "📄 Plantilla de contrato" en `/admin/rooms` (`RoomsView` → `ContractTemplateDialog`).
- El envío post-creación vive en `CredentialsDialog` (botón verde); degrada con hints si no hay plantilla subida o el inquilino no tiene teléfono.

## Archivos clave
- `supabase/migrations/2026-06-12_email-signed-template.sql`
- `app/api/admin/update-tenant-email/route.ts`
- `lib/whatsapp.ts` (`waLink`, `tenantPortalUrl`)
- `components/admin/CredentialsDialog.tsx`, `ContractInfoDialog.tsx`, `ContractDialog.tsx`, `RoomsView.tsx`

## Superseded — punto 4 removido (2026-06-15)
La plantilla en blanco (`contract-templates`) se descartó: una vez que existe el **PDF autogenerado por contrato** (ver [[renta-por-contrato]]), enviar un formulario en blanco para llenar a mano es estrictamente peor — el PDF ya llega con los datos del inquilino. Se eliminó `ContractTemplateDialog.tsx`, `getContractTemplateUrl`, el botón en `RoomsView`, y el bucket + policies en producción (migración `2026-06-15_remove-contract-template-bucket.sql`; el bucket/objetos se borraron vía Storage API porque Supabase no permite `delete` directo sobre `storage.objects`/`storage.buckets` por SQL). `CredentialsDialog` ahora solo tiene "Enviar contrato por WhatsApp" (el PDF). Detalle en [[2026-06-15]].
