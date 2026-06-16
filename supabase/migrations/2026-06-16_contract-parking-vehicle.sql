-- Migración aditiva — aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql).
-- Agrega a contracts los datos del vehículo autorizado en el parqueo (tipo, marca,
-- línea, color, placa). Vive en contracts, igual que la persona adicional, por ser
-- información del contrato y no de una cuenta de usuario. Reutiliza el checkbox
-- existente "Parqueo (mensual)" de ContractDialog/ContractInfoDialog.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

begin;

alter table contracts add column if not exists has_parking boolean not null default false;
alter table contracts add column if not exists parking_vehicle_type text not null default '' check (parking_vehicle_type in ('', 'moto', 'carro'));
alter table contracts add column if not exists parking_vehicle_brand text not null default '';
alter table contracts add column if not exists parking_vehicle_line text not null default '';
alter table contracts add column if not exists parking_vehicle_color text not null default '';
alter table contracts add column if not exists parking_vehicle_plate text not null default '';

commit;
