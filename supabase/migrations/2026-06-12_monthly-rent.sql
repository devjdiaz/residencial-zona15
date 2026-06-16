-- Migración aditiva — aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql).
-- Agrega contracts.monthly_rent: renta mensual negociada por contrato.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

begin;

-- Renta mensual negociada por contrato. null = usar precio de lista del tipo.
alter table contracts add column if not exists monthly_rent numeric(10,2);

-- Backfill: congelar el precio de lista actual en los contratos existentes
-- (después el admin corrige los de inquilinos antiguos a su precio real).
update contracts c
set monthly_rent = rt.price
from rooms r
join room_types rt on rt.id = r.type_id
where r.id = c.room_id and c.monthly_rent is null;

commit;
