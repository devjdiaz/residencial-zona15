import { NextRequest, NextResponse } from "next/server"
import ContractPDF from "@/components/ContractPDF"
import { createElement } from "react"
import { createServiceClient } from "@/lib/supabase/server"

// Supabase puede devolver relaciones embebidas como objeto o como array de un elemento.
function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params
  if (!contractId) return NextResponse.json({ error: "Missing contractId" }, { status: 400 })

  const sb = await createServiceClient()

  const { data: contract, error } = await sb
    .from("contracts")
    .select(`
      id, start_date, end_date, duration_months, payment_day, status, monthly_rent,
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

  const pdfElement = createElement(ContractPDF, {
    contractId,
    tenantName:      tenant?.name        ?? "",
    tenantDpi:       tenant?.dpi         ?? "",
    tenantPhone:     tenant?.phone       ?? "",
    tenantPhoneAlt:  tenant?.phone_alt   ?? "",
    tenantEmail:     tenant?.email       ?? "",
    roomIdentifier:  room?.identifier    ?? "",
    propertyName:    prop?.name          ?? "",
    propertySlug:    prop?.slug          ?? "maestro",
    startDate:       contract.start_date,
    endDate:         contract.end_date   ?? "",
    durationMonths:  contract.duration_months ?? 6,
    paymentDay:      contract.payment_day,
    monthlyPrice:    contract.monthly_rent ?? roomType?.price ?? 0,
  })

  const { renderToBuffer } = await import("@react-pdf/renderer")
  const buffer: Buffer = await renderToBuffer(pdfElement as Parameters<typeof renderToBuffer>[0])

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrato-${room?.identifier ?? contractId}.pdf"`,
    },
  })
}
