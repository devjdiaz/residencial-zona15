-- Migración aditiva — aplicar en el SQL Editor de Supabase.
-- Marca cuándo se enviaron las credenciales por primera vez, para que el botón
-- "Enviar credenciales por WhatsApp" NO resetee la contraseña en reenvíos.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

begin;

alter table contracts add column if not exists credentials_sent_at timestamptz;

commit;
