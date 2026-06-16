import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const BANK_ACCOUNTS = {
  maestro: { bank: "BAC", account: "904890928", holder: "ETHIA HURTADO", type: "Monetaria" },
  tecun:   { bank: "BI",  account: "8070001881", holder: "Dessire Oajaca", type: "Monetaria" },
} as const

type PropertySlug = keyof typeof BANK_ACCOUNTS

const s = StyleSheet.create({
  page:      { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a", lineHeight: 1.5 },
  title:     { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 4 },
  subtitle:  { fontSize: 10, textAlign: "center", marginBottom: 20 },
  section:   { marginBottom: 12 },
  heading:   { fontFamily: "Helvetica-Bold", marginBottom: 4, textDecoration: "underline" },
  row:       { flexDirection: "row", marginBottom: 3 },
  label:     { fontFamily: "Helvetica-Bold", width: 120 },
  value:     { flex: 1 },
  blankLine: { borderBottomWidth: 1, borderBottomColor: "#999", flex: 1, marginBottom: 2 },
  clauseRow: { flexDirection: "row", marginBottom: 6 },
  clauseNum: { fontFamily: "Helvetica-Bold", width: 24 },
  clauseText:{ flex: 1 },
  bankBox:   { backgroundColor: "#f5f5f5", padding: 10, borderRadius: 4, marginTop: 4 },
  signRow:   { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  signBlock: { width: "44%" },
  signLine:  { borderBottomWidth: 1, borderBottomColor: "#333", marginBottom: 4 },
  signLabel: { fontSize: 9, color: "#555" },
  footer:    { marginTop: 8, fontSize: 8, color: "#888", textAlign: "center" },
})

interface ContractPDFProps {
  contractId: string
  tenantName: string
  tenantDpi: string
  tenantPhone: string
  tenantPhoneAlt: string
  tenantEmail: string
  roomIdentifier: string
  propertyName: string
  propertySlug: string
  startDate: string
  endDate: string
  durationMonths: number
  paymentDay: number
  monthlyPrice: number
  depositPaid: boolean
  depositAmount: number
  hasAdditionalPerson: boolean
  additionalPersonName: string
  additionalPersonDpi: string
  additionalPersonPhone: string
  additionalPersonPhoneAlt: string
  hasParking: boolean
  parkingVehicleType: string
  parkingVehicleBrand: string
  parkingVehicleLine: string
  parkingVehicleColor: string
  parkingVehiclePlate: string
}

function fmt(isoDate: string) {
  const [y, m, d] = isoDate.split("-")
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
  return `${parseInt(d)} de ${months[parseInt(m)-1]} de ${y}`
}

export default function ContractPDF({
  tenantName, tenantDpi, tenantPhone, tenantPhoneAlt, tenantEmail,
  roomIdentifier, propertyName, propertySlug,
  startDate, endDate, durationMonths, paymentDay, monthlyPrice,
  depositPaid, depositAmount,
  hasAdditionalPerson, additionalPersonName, additionalPersonDpi,
  additionalPersonPhone, additionalPersonPhoneAlt,
  hasParking, parkingVehicleType, parkingVehicleBrand,
  parkingVehicleLine, parkingVehicleColor, parkingVehiclePlate,
}: ContractPDFProps) {
  const slug = (propertySlug as PropertySlug) in BANK_ACCOUNTS ? propertySlug as PropertySlug : "maestro"
  const bank = BANK_ACCOUNTS[slug]
  const today = fmt(new Date().toISOString().split("T")[0])

  const vehicleTypeLabel = parkingVehicleType === "moto" ? "Moto" : parkingVehicleType === "carro" ? "Carro" : ""

  const depositClauseText = depositPaid
    ? `DEPÓSITO: El arrendatario entregó un depósito de garantía por la cantidad de Q${depositAmount.toLocaleString("es-GT")}, reembolsable al término del contrato, sujeto al estado del inmueble y al cumplimiento de las obligaciones contraídas.`
    : "DEPÓSITO: El arrendatario no entregó depósito de garantía al inicio del presente contrato."

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Text style={s.title}>CONTRATO DE ARRENDAMIENTO DE HABITACIÓN</Text>
        <Text style={s.subtitle}>Ciudad de Guatemala, {today}</Text>

        {/* Partes */}
        <View style={s.section}>
          <Text style={s.heading}>COMPARECEN</Text>
          <View style={s.row}>
            <Text style={s.label}>ARRENDADORA:</Text>
            <Text style={s.value}>ETHIA DE LOS ANGELES HURTADO COUTIÑO, identificada con DPI 2648237371001.</Text>
          </View>
          <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 4 }}>ARRENDATARIO/A:</Text>
          <View style={s.row}>
            <Text style={s.label}>Nombre completo:</Text>
            <Text style={s.value}>{tenantName || "________________________________"}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>DPI:</Text>
            <Text style={s.value}>{tenantDpi || "________________________________"}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Teléfono:</Text>
            <Text style={s.value}>{tenantPhone || "________________"}{"   "}Alt: {tenantPhoneAlt || "_____________"}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Correo electrónico:</Text>
            <Text style={s.value}>{tenantEmail || "________________________________"}</Text>
          </View>
        </View>

        {/* Persona adicional autorizada (sin acceso al portal) */}
        {hasAdditionalPerson && (
          <View style={s.section}>
            <Text style={s.heading}>PERSONA ADICIONAL AUTORIZADA</Text>
            <View style={s.row}>
              <Text style={s.label}>Nombre completo:</Text>
              <Text style={s.value}>{additionalPersonName || "________________________________"}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>DPI:</Text>
              <Text style={s.value}>{additionalPersonDpi || "________________________________"}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Teléfono:</Text>
              <Text style={s.value}>{additionalPersonPhone || "________________"}{"   "}Alt: {additionalPersonPhoneAlt || "_____________"}</Text>
            </View>
            <Text style={{ marginTop: 4, fontSize: 9, color: "#555" }}>
              Esta persona queda autorizada a residir en la habitación junto al arrendatario principal, pero no cuenta con credenciales de acceso al portal de inquilinos ni es parte firmante de este contrato.
            </Text>
          </View>
        )}

        {/* Vehículo autorizado en el parqueo */}
        {hasParking && (
          <View style={s.section}>
            <Text style={s.heading}>VEHÍCULO AUTORIZADO (PARQUEO)</Text>
            <View style={s.row}>
              <Text style={s.label}>Tipo:</Text>
              <Text style={s.value}>{vehicleTypeLabel || "________________________________"}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Marca:</Text>
              <Text style={s.value}>{parkingVehicleBrand || "________________________________"}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Línea:</Text>
              <Text style={s.value}>{parkingVehicleLine || "________________________________"}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Color:</Text>
              <Text style={s.value}>{parkingVehicleColor || "________________________________"}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Placa:</Text>
              <Text style={s.value}>{parkingVehiclePlate || "________________________________"}</Text>
            </View>
          </View>
        )}

        {/* Objeto */}
        <View style={s.section}>
          <Text style={s.heading}>OBJETO DEL CONTRATO</Text>
          <Text>
            La arrendadora da en arrendamiento la habitación Nº {roomIdentifier} de la residencia {propertyName},
            por el período comprendido del {fmt(startDate)} al {fmt(endDate)} ({durationMonths} {durationMonths === 1 ? "mes" : "meses"}),
            con un precio mensual de Q{monthlyPrice.toLocaleString("es-GT")}, pagadero el día {paymentDay} de cada mes.
          </Text>
        </View>

        {/* Pago */}
        <View style={s.section}>
          <Text style={s.heading}>FORMA DE PAGO</Text>
          <View style={s.bankBox}>
            <View style={s.row}>
              <Text style={s.label}>Banco:</Text>
              <Text style={s.value}>{bank.bank}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Número de cuenta:</Text>
              <Text style={s.value}>{bank.account}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Titular:</Text>
              <Text style={s.value}>{bank.holder}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Tipo de cuenta:</Text>
              <Text style={s.value}>{bank.type}</Text>
            </View>
          </View>
          <Text style={{ marginTop: 6 }}>El arrendatario deberá enviar comprobante de pago a la administración el mismo día del depósito.</Text>
        </View>

        {/* Cláusulas */}
        <View style={s.section}>
          <Text style={s.heading}>CLÁUSULAS</Text>
          {[
            ["1.",  "USO: La habitación será utilizada exclusivamente como vivienda personal del arrendatario. Queda prohibido su uso comercial."],
            ["2.",  "PROHIBICIONES: Se prohíbe subarrendar, ceder el presente contrato, realizar modificaciones estructurales o introducir animales sin autorización escrita de la arrendadora."],
            ["3.",  "MANTENIMIENTO Y LIMPIEZA: El arrendatario debe mantener la habitación en buen estado, conservar los baños limpios, y entregarla en las mismas condiciones de limpieza en que la recibió."],
            ["4.",  "HUÉSPEDES: No se permite alojar personas de manera permanente ni recibir huéspedes por más de 2 noches consecutivas sin autorización previa y por escrito de la arrendadora."],
            ["5.",  "PROHIBICIÓN DE FUMAR: Queda prohibido fumar cualquier tipo de sustancia dentro de las habitaciones o en las áreas comunes. Su incumplimiento es causal de terminación inmediata del contrato y de la no devolución del depósito de garantía."],
            ["6.",  "CONVIVENCIA: El arrendatario debe respetar el descanso de los demás ocupantes, evitando ruidos excesivos, fiestas o cualquier actividad que perturbe la tranquilidad del inmueble."],
            ["7.",  depositClauseText],
            ["8.",  "NO DEVOLUCIÓN DEL DEPÓSITO POR SALIDA ANTICIPADA: Si el arrendatario abandona la habitación antes de cumplir el plazo pactado en este contrato, el depósito de garantía no será devuelto."],
            ["9.",  "TERMINACIÓN ANTICIPADA: Cualquiera de las partes puede dar por terminado el contrato notificando con al menos 30 días de anticipación por escrito."],
            ["10.", "CAUSALES DE TERMINACIÓN INMEDIATA: La arrendadora podrá dar por terminado el contrato de forma inmediata, sin necesidad del aviso previo señalado en la cláusula anterior, ante cualquiera de las siguientes causas: falta de pago de la renta, daños al inmueble, realización de actividades ilícitas, incumplimiento reiterado de las normas de convivencia, o subarrendamiento no autorizado."],
            ["11.", "IMPAGO REITERADO: El incumplimiento de dos pagos de renta consecutivos o alternos faculta a la arrendadora para dar por terminado el contrato y exigir la desocupación del inmueble conforme a la ley."],
            ["12.", "DAÑOS: El arrendatario es responsable de los daños causados al inmueble durante su ocupación y deberá reportarlos inmediatamente a la administración."],
            ["13.", "ENTREGA DE LLAVES: Al finalizar el contrato, el arrendatario debe entregar todas las llaves del inmueble. La no devolución de las llaves autoriza a la arrendadora a descontar del depósito el costo del cambio de cerraduras."],
            ["14.", "GARITA: La renta mensual no incluye el servicio de garita."],
          ].map(([num, text]) => (
            <View key={num} style={s.clauseRow}>
              <Text style={s.clauseNum}>{num}</Text>
              <Text style={s.clauseText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Firmas */}
        <Text style={[s.heading, { marginTop: 8 }]}>FIRMAS</Text>
        <Text style={{ marginBottom: 16 }}>
          Leído y aceptado el presente contrato, las partes lo firman en señal de conformidad.
        </Text>
        <View style={s.signRow}>
          <View style={s.signBlock}>
            <View style={s.signLine} />
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>ARRENDADORA</Text>
            <Text style={s.signLabel}>Ethia de los Ángeles Hurtado Coutiño</Text>
            <Text style={s.signLabel}>DPI: 2648237371001</Text>
          </View>
          <View style={s.signBlock}>
            <View style={s.signLine} />
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>ARRENDATARIO/A</Text>
            <Text style={s.signLabel}>Nombre: ___________________________</Text>
            <Text style={s.signLabel}>Fecha: _____________________________</Text>
          </View>
        </View>

        <Text style={s.footer}>Residencial Zona 15 — {propertyName}</Text>
      </Page>
    </Document>
  )
}
