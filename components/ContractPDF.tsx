import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

// ── Prosemirror types ────────────────────────────────────────────────────────

interface PmMark { type: string }
interface PmNode {
  type: string
  attrs?: Record<string, unknown>
  marks?: PmMark[]
  text?: string
  content?: PmNode[]
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:       { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a", lineHeight: 1.5 },
  h1:         { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 4, marginTop: 8 },
  h2:         { fontFamily: "Helvetica-Bold", textDecoration: "underline", marginBottom: 4, marginTop: 10 },
  h3:         { fontFamily: "Helvetica-Bold", marginBottom: 2, marginTop: 6 },
  paragraph:  { marginBottom: 4, lineHeight: 1.5 },
  listItem:   { flexDirection: "row", marginBottom: 3 },
  listBullet: { width: 14 },
  listBody:   { flex: 1 },
  section:    { marginBottom: 12 },
  signRow:    { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  signBlock:  { width: "44%" },
  signLine:   { borderBottomWidth: 1, borderBottomColor: "#333", marginBottom: 4 },
  signLabel:  { fontSize: 9, color: "#555" },
  footer:     { marginTop: 8, fontSize: 8, color: "#888", textAlign: "center" },
  heading:    { fontFamily: "Helvetica-Bold", marginBottom: 4, textDecoration: "underline" },
  row:        { flexDirection: "row", marginBottom: 3 },
  label:      { fontFamily: "Helvetica-Bold", width: 120 },
  value:      { flex: 1 },
})

// ── Placeholder replacement ───────────────────────────────────────────────────

type Vars = Record<string, string>

function replacePlaceholders(node: PmNode, vars: Vars): PmNode {
  if (node.type === "text" && node.text) {
    let t = node.text
    for (const [k, v] of Object.entries(vars)) {
      t = t.split(k).join(v)
    }
    return { ...node, text: t }
  }
  if (node.content) {
    return { ...node, content: node.content.map((n) => replacePlaceholders(n, vars)) }
  }
  return node
}

// ── Inline renderer (handles text marks within a paragraph/heading) ──────────

function renderInline(nodes: PmNode[] | undefined): React.ReactNode[] {
  return (nodes ?? []).map((node, i) => {
    if (node.type === "text") {
      const bold   = node.marks?.some((m) => m.type === "bold")   ?? false
      const italic = node.marks?.some((m) => m.type === "italic") ?? false
      return (
        <Text
          key={i}
          style={{
            fontFamily: bold ? "Helvetica-Bold" : italic ? "Helvetica-Oblique" : "Helvetica",
          }}
        >
          {node.text ?? ""}
        </Text>
      )
    }
    if (node.type === "hardBreak") return <Text key={i}>{"\n"}</Text>
    return null
  })
}

// ── Block renderer ────────────────────────────────────────────────────────────

function renderPmNode(node: PmNode, key: number | string): React.ReactNode {
  switch (node.type) {
    case "doc":
      return (
        <View key={key}>
          {(node.content ?? []).map((child, i) => renderPmNode(child, i))}
        </View>
      )

    case "heading": {
      const level = (node.attrs?.level as number) ?? 2
      const style = level === 1 ? s.h1 : level === 2 ? s.h2 : s.h3
      return (
        <Text key={key} style={style}>
          {renderInline(node.content)}
        </Text>
      )
    }

    case "paragraph":
      return (
        <Text key={key} style={s.paragraph}>
          {renderInline(node.content)}
        </Text>
      )

    case "bulletList":
    case "orderedList":
      return (
        <View key={key} style={{ marginBottom: 6 }}>
          {(node.content ?? []).map((child, i) => renderPmNode(child, i))}
        </View>
      )

    case "listItem":
      return (
        <View key={key} style={s.listItem}>
          <Text style={s.listBullet}>•</Text>
          <View style={s.listBody}>
            {(node.content ?? []).map((child, i) => renderPmNode(child, i))}
          </View>
        </View>
      )

    case "hardBreak":
      return <Text key={key}>{"\n"}</Text>

    default:
      return null
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ContractPDFProps {
  contractId: string
  bodyJson: PmNode | null
  landlordSignatureName: string
  landlordDpi: string
  propertyName: string
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

export default function ContractPDF({
  bodyJson,
  landlordSignatureName,
  landlordDpi,
  propertyName,
  hasAdditionalPerson,
  additionalPersonName,
  additionalPersonDpi,
  additionalPersonPhone,
  additionalPersonPhoneAlt,
  hasParking,
  parkingVehicleType,
  parkingVehicleBrand,
  parkingVehicleLine,
  parkingVehicleColor,
  parkingVehiclePlate,
}: ContractPDFProps) {
  const vehicleTypeLabel = parkingVehicleType === "moto" ? "Moto" : parkingVehicleType === "carro" ? "Carro" : ""

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* Cuerpo editable (desde TipTap JSON) */}
        {bodyJson ? renderPmNode(bodyJson, "body") : null}

        {/* Persona adicional — siempre estructurado y auto-añadido */}
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

        {/* Vehículo autorizado — siempre estructurado y auto-añadido */}
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

        {/* Firmas — siempre fijo al final */}
        <Text style={[s.heading, { marginTop: 12 }]}>FIRMAS</Text>
        <Text style={{ marginBottom: 16 }}>
          Leído y aceptado el presente contrato, las partes lo firman en señal de conformidad.
        </Text>
        <View style={s.signRow}>
          <View style={s.signBlock}>
            <View style={s.signLine} />
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>ARRENDADORA</Text>
            <Text style={s.signLabel}>{landlordSignatureName}</Text>
            <Text style={s.signLabel}>DPI: {landlordDpi}</Text>
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

export { replacePlaceholders }
export type { PmNode, Vars }
