-- Migración aditiva — aplicar en el SQL Editor de Supabase.
-- Añade la clave body_json a contract_template con el contrato completo en
-- formato Prosemirror JSON (TipTap). Los placeholders {NOMBRE_INQUILINO} etc.
-- se reemplazan en tiempo de generación del PDF.
-- Usa ON CONFLICT DO UPDATE para sobreescribir si ya existe la clave.

begin;

insert into contract_template (key, value) values (
  'body_json',
  '{
    "type": "doc",
    "content": [
      {
        "type": "heading",
        "attrs": {"level": 1},
        "content": [{"type": "text", "text": "CONTRATO DE ARRENDAMIENTO DE HABITACIÓN"}]
      },
      {
        "type": "paragraph",
        "content": [{"type": "text", "text": "Ciudad de Guatemala, {FECHA_HOY}"}]
      },
      {
        "type": "heading",
        "attrs": {"level": 2},
        "content": [{"type": "text", "text": "COMPARECEN"}]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "ARRENDADORA:"},
          {"type": "text", "text": " {NOMBRE_ARRENDADORA}, identificada con DPI {DPI_ARRENDADORA}."}
        ]
      },
      {
        "type": "paragraph",
        "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "ARRENDATARIO/A:"}]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "Nombre completo:"},
          {"type": "text", "text": " {NOMBRE_INQUILINO}"}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "DPI:"},
          {"type": "text", "text": " {DPI_INQUILINO}"}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "Teléfono:"},
          {"type": "text", "text": " {TELEFONO_INQUILINO}   Alt: {TEL_ALT_INQUILINO}"}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "Correo electrónico:"},
          {"type": "text", "text": " {EMAIL_INQUILINO}"}
        ]
      },
      {
        "type": "heading",
        "attrs": {"level": 2},
        "content": [{"type": "text", "text": "OBJETO DEL CONTRATO"}]
      },
      {
        "type": "paragraph",
        "content": [{"type": "text", "text": "La arrendadora da en arrendamiento la habitación Nº {HABITACION} de la residencia {PROPIEDAD}, por el período comprendido del {FECHA_INICIO} al {FECHA_FIN} ({DURACION_MESES} meses), con un precio mensual de Q{RENTA}, pagadero el día {DIA_PAGO} de cada mes."}]
      },
      {
        "type": "heading",
        "attrs": {"level": 2},
        "content": [{"type": "text", "text": "FORMA DE PAGO"}]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "Banco:"},
          {"type": "text", "text": " {BANCO}"}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "Número de cuenta:"},
          {"type": "text", "text": " {NUM_CUENTA}"}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "Titular:"},
          {"type": "text", "text": " {TITULAR_CUENTA}"}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "Tipo de cuenta:"},
          {"type": "text", "text": " {TIPO_CUENTA}"}
        ]
      },
      {
        "type": "paragraph",
        "content": [{"type": "text", "text": "El arrendatario deberá enviar comprobante de pago a la administración el mismo día del depósito."}]
      },
      {
        "type": "heading",
        "attrs": {"level": 2},
        "content": [{"type": "text", "text": "CLÁUSULAS"}]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "1."},
          {"type": "text", "text": " USO: La habitación será utilizada exclusivamente como vivienda personal del arrendatario. Queda prohibido su uso comercial."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "2."},
          {"type": "text", "text": " PROHIBICIONES: Se prohíbe subarrendar, ceder el presente contrato, realizar modificaciones estructurales o introducir animales sin autorización escrita de la arrendadora."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "3."},
          {"type": "text", "text": " MANTENIMIENTO Y LIMPIEZA: El arrendatario debe mantener la habitación en buen estado, conservar los baños limpios, y entregarla en las mismas condiciones de limpieza en que la recibió."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "4."},
          {"type": "text", "text": " HUÉSPEDES: No se permite alojar personas de manera permanente ni recibir huéspedes por más de 2 noches consecutivas sin autorización previa y por escrito de la arrendadora."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "5."},
          {"type": "text", "text": " PROHIBICIÓN DE FUMAR: Queda prohibido fumar cualquier tipo de sustancia dentro de las habitaciones o en las áreas comunes. Su incumplimiento es causal de terminación inmediata del contrato y de la no devolución del depósito de garantía."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "6."},
          {"type": "text", "text": " CONVIVENCIA: El arrendatario debe respetar el descanso de los demás ocupantes, evitando ruidos excesivos, fiestas o cualquier actividad que perturbe la tranquilidad del inmueble."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "7."},
          {"type": "text", "text": " {CLAUSULA_DEPOSITO}"}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "8."},
          {"type": "text", "text": " NO DEVOLUCIÓN DEL DEPÓSITO POR SALIDA ANTICIPADA: Si el arrendatario abandona la habitación antes de cumplir el plazo pactado en este contrato, el depósito de garantía no será devuelto."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "9."},
          {"type": "text", "text": " TERMINACIÓN ANTICIPADA: Cualquiera de las partes puede dar por terminado el contrato notificando con al menos 30 días de anticipación por escrito."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "10."},
          {"type": "text", "text": " CAUSALES DE TERMINACIÓN INMEDIATA: La arrendadora podrá dar por terminado el contrato de forma inmediata, sin necesidad del aviso previo señalado en la cláusula anterior, ante cualquiera de las siguientes causas: falta de pago de la renta, daños al inmueble, realización de actividades ilícitas, incumplimiento reiterado de las normas de convivencia, o subarrendamiento no autorizado."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "11."},
          {"type": "text", "text": " IMPAGO REITERADO: El incumplimiento de dos pagos de renta consecutivos o alternos faculta a la arrendadora para dar por terminado el contrato y exigir la desocupación del inmueble conforme a la ley."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "12."},
          {"type": "text", "text": " DAÑOS: El arrendatario es responsable de los daños causados al inmueble durante su ocupación y deberá reportarlos inmediatamente a la administración."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "13."},
          {"type": "text", "text": " ENTREGA DE LLAVES: Al finalizar el contrato, el arrendatario debe entregar todas las llaves del inmueble. La no devolución de las llaves autoriza a la arrendadora a descontar del depósito el costo del cambio de cerraduras."}
        ]
      },
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "marks": [{"type": "bold"}], "text": "14."},
          {"type": "text", "text": " GARITA: La renta mensual no incluye el servicio de garita."}
        ]
      }
    ]
  }'::jsonb
) on conflict (key) do update set value = excluded.value, updated_at = now();

commit;
