import { NextRequest, NextResponse } from "next/server"
import ContractPDF, { replacePlaceholders } from "@/components/ContractPDF"
import type { PmNode, Vars } from "@/components/ContractPDF"
import { createElement } from "react"
import { createServiceRoleClient } from "@/lib/supabase/server"

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function fmt(isoDate: string) {
  const [y, m, d] = isoDate.split("-")
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
  return `${parseInt(d)} de ${months[parseInt(m)-1]} de ${y}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params
  if (!contractId) return NextResponse.json({ error: "Missing contractId" }, { status: 400 })

  // ?download=1 fuerza la descarga (attachment) en vez de mostrarlo inline en el iframe.
  // Útil sobre todo en móvil, donde la barra nativa del visor no siempre ofrece descargar.
  const forceDownload = _req.nextUrl.searchParams.get("download") === "1"

  // Cliente service_role REAL (sin cookies): el inquilino abre este link a veces
  // logueado en el portal; con un cliente basado en cookies, sus consultas usarían
  // su token de inquilino y el RLS bloquearía contract_template (solo-admin),
  // generando un contrato en blanco. Este cliente salta el RLS siempre.
  const sb = createServiceRoleClient()

  const { data: contract, error } = await sb
    .from("contracts")
    .select(`
      id, start_date, end_date, duration_months, payment_day, status, monthly_rent,
      has_additional_person, additional_person_name, additional_person_dpi,
      additional_person_phone, additional_person_phone_alt,
      has_parking, parking_vehicle_type, parking_vehicle_brand,
      parking_vehicle_line, parking_vehicle_color, parking_vehicle_plate,
      tenant_profile:tenant_profiles!contracts_tenant_profile_id_fkey(name, email, phone, phone_alt, dpi),
      room:rooms(identifier, room_type:room_types(price), property:properties(name, slug))
    `)
    .eq("id", contractId)
    .single()

  if (error || !contract) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 })
  }

  const tenant   = unwrap(contract.tenant_profile)
  const room     = unwrap(contract.room)
  const prop     = unwrap(room?.property)
  const roomType = unwrap(room?.room_type)
  const propSlug = prop?.slug ?? "maestro"

  // Depósito
  const { data: depositRows } = await sb
    .from("income_extras")
    .select("amount")
    .eq("contract_id", contractId)
    .eq("type", "deposit")
  const depositPaid   = (depositRows?.length ?? 0) > 0
  const depositAmount = depositPaid ? Number(depositRows![0].amount) : 0

  // Template desde DB
  const { data: templateRows } = await sb.from("contract_template").select("key, value")
  const tpl = Object.fromEntries((templateRows ?? []).map((r) => [r.key, r.value]))

  const landlord = (tpl.landlord as { name?: string; dpi?: string; signature_name?: string }) ?? {}
  const banks    = (tpl.banks    as Record<string, { bank: string; account: string; holder: string; type: string }>) ?? {}
  const bank     = banks[propSlug] ?? banks["maestro"] ?? { bank: "", account: "", holder: "", type: "" }
  const bodyJson = (tpl.body_json as PmNode | null) ?? null

  // Blindaje: si el cuerpo del contrato no está configurado en contract_template,
  // NO generamos un PDF en blanco (solo firmas). Mejor un error explícito para que
  // el inquilino no reciba un contrato vacío y el admin se entere.
  const bodyEmpty = !bodyJson || !(bodyJson.content?.length)
  if (bodyEmpty) {
    return NextResponse.json(
      { error: "Plantilla de contrato no configurada (body_json vacío). Avisar al administrador." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }

  // Cláusula de depósito dinámica
  const clausulaDeposito = depositPaid
    ? `DEPÓSITO: El arrendatario entregó un depósito de garantía por la cantidad de Q${depositAmount.toLocaleString("es-GT")}, reembolsable al término del contrato, sujeto al estado del inmueble y al cumplimiento de las obligaciones contraídas.`
    : "DEPÓSITO: El arrendatario no entregó depósito de garantía al inicio del presente contrato."

  // Variables para sustituir en el body_json
  const today = new Date().toISOString().split("T")[0]
  const vars: Vars = {
    "{FECHA_HOY}":          fmt(today),
    "{NOMBRE_ARRENDADORA}": landlord.name             ?? "",
    "{DPI_ARRENDADORA}":    landlord.dpi              ?? "",
    "{FIRMA_ARRENDADORA}":  landlord.signature_name   ?? "",
    "{NOMBRE_INQUILINO}":   tenant?.name              ?? "",
    "{DPI_INQUILINO}":      tenant?.dpi               ?? "",
    "{TELEFONO_INQUILINO}": tenant?.phone             ?? "",
    "{TEL_ALT_INQUILINO}":  tenant?.phone_alt         ?? "",
    "{EMAIL_INQUILINO}":    tenant?.email             ?? "",
    "{HABITACION}":         room?.identifier          ?? "",
    "{PROPIEDAD}":          prop?.name                ?? "",
    "{FECHA_INICIO}":       fmt(contract.start_date),
    "{FECHA_FIN}":          contract.end_date ? fmt(contract.end_date) : "",
    "{DURACION_MESES}":     String(contract.duration_months ?? 6),
    "{RENTA}":              (contract.monthly_rent ?? roomType?.price ?? 0).toLocaleString("es-GT"),
    "{DIA_PAGO}":           String(contract.payment_day),
    "{BANCO}":              bank.bank,
    "{NUM_CUENTA}":         bank.account,
    "{TITULAR_CUENTA}":     bank.holder,
    "{TIPO_CUENTA}":        bank.type,
    "{CLAUSULA_DEPOSITO}":  clausulaDeposito,
  }

  // Reemplazar placeholders en el cuerpo
  const filledBody = bodyJson ? replacePlaceholders(bodyJson, vars) : null

  const pdfElement = createElement(ContractPDF, {
    contractId,
    bodyJson: filledBody,
    landlordSignatureName:    landlord.signature_name   ?? "",
    landlordDpi:              landlord.dpi              ?? "",
    propertyName:             prop?.name                ?? "",
    hasAdditionalPerson:      contract.has_additional_person ?? false,
    additionalPersonName:     contract.additional_person_name ?? "",
    additionalPersonDpi:      contract.additional_person_dpi ?? "",
    additionalPersonPhone:    contract.additional_person_phone ?? "",
    additionalPersonPhoneAlt: contract.additional_person_phone_alt ?? "",
    hasParking:               contract.has_parking ?? false,
    parkingVehicleType:       contract.parking_vehicle_type ?? "",
    parkingVehicleBrand:      contract.parking_vehicle_brand ?? "",
    parkingVehicleLine:       contract.parking_vehicle_line ?? "",
    parkingVehicleColor:      contract.parking_vehicle_color ?? "",
    parkingVehiclePlate:      contract.parking_vehicle_plate ?? "",
  })

  const { renderToBuffer } = await import("@react-pdf/renderer")
  const buffer: Buffer = await renderToBuffer(pdfElement as Parameters<typeof renderToBuffer>[0])

  const disposition = forceDownload ? "attachment" : "inline"
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="contrato-${room?.identifier ?? contractId}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
