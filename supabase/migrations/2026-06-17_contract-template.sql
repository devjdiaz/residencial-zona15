-- Migración aditiva — aplicar en el SQL Editor de Supabase (NO re-ejecutar schema.sql).
-- Crea la tabla contract_template para almacenar el texto fijo del contrato
-- (arrendadora, cuentas bancarias, cláusulas) de forma editable desde el panel admin.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

begin;

create table if not exists contract_template (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table contract_template enable row level security;

drop policy if exists "template_admin_select" on contract_template;
create policy "template_admin_select" on contract_template
  for select using (
    (auth.jwt()->'user_metadata'->>'role') in ('admin', 'super_admin')
  );

-- Seed: datos de la arrendadora
insert into contract_template (key, value) values (
  'landlord',
  '{"name":"ETHIA DE LOS ANGELES HURTADO COUTIÑO","dpi":"2648237371001","signature_name":"Ethia de los Ángeles Hurtado Coutiño"}'::jsonb
) on conflict (key) do nothing;

-- Seed: cuentas bancarias por propiedad
insert into contract_template (key, value) values (
  'banks',
  '{"maestro":{"bank":"BAC","account":"904890928","holder":"ETHIA HURTADO","type":"Monetaria"},"tecun":{"bank":"BI","account":"8070001881","holder":"Dessire Oajaca","type":"Monetaria"}}'::jsonb
) on conflict (key) do nothing;

-- Seed: 14 cláusulas. La cláusula 7 tiene dos variantes (con/sin depósito).
-- {AMOUNT} en text_with_deposit se reemplaza en tiempo de generación con el monto real.
insert into contract_template (key, value) values (
  'clauses',
  '[
    {"num":"1.","text":"USO: La habitación será utilizada exclusivamente como vivienda personal del arrendatario. Queda prohibido su uso comercial."},
    {"num":"2.","text":"PROHIBICIONES: Se prohíbe subarrendar, ceder el presente contrato, realizar modificaciones estructurales o introducir animales sin autorización escrita de la arrendadora."},
    {"num":"3.","text":"MANTENIMIENTO Y LIMPIEZA: El arrendatario debe mantener la habitación en buen estado, conservar los baños limpios, y entregarla en las mismas condiciones de limpieza en que la recibió."},
    {"num":"4.","text":"HUÉSPEDES: No se permite alojar personas de manera permanente ni recibir huéspedes por más de 2 noches consecutivas sin autorización previa y por escrito de la arrendadora."},
    {"num":"5.","text":"PROHIBICIÓN DE FUMAR: Queda prohibido fumar cualquier tipo de sustancia dentro de las habitaciones o en las áreas comunes. Su incumplimiento es causal de terminación inmediata del contrato y de la no devolución del depósito de garantía."},
    {"num":"6.","text":"CONVIVENCIA: El arrendatario debe respetar el descanso de los demás ocupantes, evitando ruidos excesivos, fiestas o cualquier actividad que perturbe la tranquilidad del inmueble."},
    {"num":"7.","text_with_deposit":"DEPÓSITO: El arrendatario entregó un depósito de garantía por la cantidad de Q{AMOUNT}, reembolsable al término del contrato, sujeto al estado del inmueble y al cumplimiento de las obligaciones contraídas.","text_without_deposit":"DEPÓSITO: El arrendatario no entregó depósito de garantía al inicio del presente contrato."},
    {"num":"8.","text":"NO DEVOLUCIÓN DEL DEPÓSITO POR SALIDA ANTICIPADA: Si el arrendatario abandona la habitación antes de cumplir el plazo pactado en este contrato, el depósito de garantía no será devuelto."},
    {"num":"9.","text":"TERMINACIÓN ANTICIPADA: Cualquiera de las partes puede dar por terminado el contrato notificando con al menos 30 días de anticipación por escrito."},
    {"num":"10.","text":"CAUSALES DE TERMINACIÓN INMEDIATA: La arrendadora podrá dar por terminado el contrato de forma inmediata, sin necesidad del aviso previo señalado en la cláusula anterior, ante cualquiera de las siguientes causas: falta de pago de la renta, daños al inmueble, realización de actividades ilícitas, incumplimiento reiterado de las normas de convivencia, o subarrendamiento no autorizado."},
    {"num":"11.","text":"IMPAGO REITERADO: El incumplimiento de dos pagos de renta consecutivos o alternos faculta a la arrendadora para dar por terminado el contrato y exigir la desocupación del inmueble conforme a la ley."},
    {"num":"12.","text":"DAÑOS: El arrendatario es responsable de los daños causados al inmueble durante su ocupación y deberá reportarlos inmediatamente a la administración."},
    {"num":"13.","text":"ENTREGA DE LLAVES: Al finalizar el contrato, el arrendatario debe entregar todas las llaves del inmueble. La no devolución de las llaves autoriza a la arrendadora a descontar del depósito el costo del cambio de cerraduras."},
    {"num":"14.","text":"GARITA: La renta mensual no incluye el servicio de garita."}
  ]'::jsonb
) on conflict (key) do nothing;

commit;
