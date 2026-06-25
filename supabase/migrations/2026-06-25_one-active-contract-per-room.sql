-- Migración aditiva — un solo contrato activo por habitación.
--
-- Causa raíz de los comprobantes "invisibles" en el panel admin: al recrear
-- inquilinos no se cerraba el contrato anterior, quedando 2 contratos 'active'
-- por habitación. El admin enlaza la habitación a UN contrato activo, así que
-- mostraba el equivocado y no veía el comprobante subido al otro.
--
-- Requisito: los datos ya deben estar limpios (ninguna habitación con >1 activo),
-- de lo contrario la creación del índice falla. Limpieza hecha el 2026-06-25.

create unique index if not exists contracts_one_active_per_room
  on contracts (room_id)
  where status = 'active';
