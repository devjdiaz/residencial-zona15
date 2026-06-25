import { NextResponse } from "next/server"
import webpush from "web-push"
import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
function periodLabel(period?: string | null) {
  if (!period) return ""
  const [y, m] = period.split("-")
  return `${MONTHS[Number(m) - 1] ?? period} ${y}`
}

type WebhookBody = {
  type: "INSERT" | "UPDATE" | "DELETE"
  table: string
  record: Record<string, unknown> | null
  old_record?: Record<string, unknown> | null
}

// Decide si un cambio amerita notificar al admin (solo eventos del inquilino).
function classify(body: WebhookBody) {
  const r = body.record ?? {}
  switch (body.table) {
    case "payment_receipts":
      if (r.verified === false && r.rejected === false) {
        return { type: "receipt", title: "Nuevo comprobante de pago", url: "/admin/historial" }
      }
      return null
    case "abono_requests":
      if (body.type === "INSERT" && r.status === "pending") {
        return { type: "abono_request", title: "Nueva solicitud de abono", url: "/admin/abonos" }
      }
      return null
    case "abono_payments":
      if (body.type === "INSERT") {
        return { type: "abono_payment", title: "Nuevo comprobante de abono", url: "/admin/abonos" }
      }
      return null
    case "issue_reports":
      if (body.type === "INSERT") {
        return { type: "issue", title: "Nuevo reporte de problema", url: "/admin/reportes" }
      }
      return null
    default:
      return null
  }
}

export async function POST(req: Request) {
  if (req.headers.get("x-webhook-secret") !== process.env.NOTIFY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as WebhookBody
  const event = classify(body)
  if (!event) return NextResponse.json({ ok: true, skipped: true })

  const service = await createServiceClient()
  const rec = body.record ?? {}
  const contractId = (rec.contract_id as string) ?? null
  let roomId = (rec.room_id as string) ?? null

  // Resolver contexto legible: Hab. + nombre del inquilino.
  let roomIdentifier = ""
  let tenantName = (rec.tenant_name as string) ?? ""
  if (contractId) {
    const { data: c } = await service
      .from("contracts")
      .select("room_id, tenant_profile_id, rooms(identifier), tenant_profiles(name)")
      .eq("id", contractId)
      .single()
    const cc = c as unknown as { room_id?: string; rooms?: { identifier?: string }; tenant_profiles?: { name?: string } } | null
    if (cc) {
      roomId = roomId ?? cc.room_id ?? null
      roomIdentifier = cc.rooms?.identifier ?? ""
      tenantName = tenantName || (cc.tenant_profiles?.name ?? "")
    }
  } else if (roomId) {
    const { data: room } = await service.from("rooms").select("identifier").eq("id", roomId).single()
    roomIdentifier = (room as { identifier?: string } | null)?.identifier ?? ""
  }

  const period = periodLabel(rec.period_month as string | undefined)
  const parts = [roomIdentifier && `Hab. ${roomIdentifier}`, tenantName?.trim(), period].filter(Boolean)
  let bodyText = parts.join(" · ")
  if (event.type === "issue" && rec.description) {
    bodyText = `${roomIdentifier ? `Hab. ${roomIdentifier} · ` : ""}${String(rec.description).slice(0, 80)}`
  }

  // 1) Guardar en el historial (centro de avisos).
  await service.from("notifications").insert({
    type: event.type,
    title: event.title,
    body: bodyText,
    url: event.url,
    room_id: roomId,
    contract_id: contractId,
  })

  // 2) Enviar Web Push a las suscripciones del admin.
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (pub && priv) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@elmaestro.gt", pub, priv)
    const { data: subs } = await service.from("push_subscriptions").select("*")
    const payload = JSON.stringify({ title: event.title, body: bodyText, url: event.url, tag: event.type })
    await Promise.all(
      (subs ?? []).map(async (s: Record<string, unknown>) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
            payload
          )
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode
          if (code === 404 || code === 410) {
            await service.from("push_subscriptions").delete().eq("endpoint", s.endpoint as string)
          } else {
            console.error("web-push", code, err)
          }
        }
      })
    )
  }

  return NextResponse.json({ ok: true })
}
