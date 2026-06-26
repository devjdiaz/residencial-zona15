-- Migración aditiva — aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql).
-- Desacopla el precio del tipo de habitación: cada habitación tiene su propio precio
-- de lista (editable por el admin). El tipo (room_types) pasa a ser solo etiqueta.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

begin;

-- Precio de lista por habitación (nullable). Es el que se muestra en el front office
-- y el que prellena la renta al crear un contrato.
alter table rooms add column if not exists price int;

-- Backfill: copiar el precio del tipo actual para no perder los precios que hoy
-- muestra el sitio público. Solo habitaciones con tipo y sin precio aún.
update rooms r
set price = rt.price
from room_types rt
where r.type_id = rt.id and r.price is null;

commit;

-- Nota: room_types.price queda sin uso en la app (huérfano). No se borra ahora para
-- no arriesgar producción; se puede limpiar en una migración futura.
