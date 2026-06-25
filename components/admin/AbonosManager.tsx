"use client"
import { useEffect, useState } from "react"
import type { AbonoPayment, AbonoRequest, AbonoStatus } from "@/lib/supabase/types"
import { logAudit } from "@/lib/audit"

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
function periodLabel(period: string) {
  const [year, month] = period.split("-")
  return `${MONTHS[Number(month) - 1] ?? period} ${year}`
}

type RequestRow = AbonoRequest & {
  room?: { identifier: string } | null
  tenant_profile?: { name: string } | null
}

const STATUS_META: Record<AbonoStatus, { label: string; badge: string }> = {
  pending:    { label: "Pendiente",  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  authorized: { label: "Autorizado", badge: "bg-green-50 text-green-700 border-green-200" },
  rejected:   { label: "Rechazado",  badge: "bg-red-50 text-red-600 border-red-200" },
}

const FILTERS: { key: AbonoStatus | "all"; label: string }[] = [
  { key: "pending", label: "Pendientes" },
  { key: "authorized", label: "Autorizados" },
  { key: "rejected", label: "Rechazados" },
  { key: "all", label: "Todos" },
]

// roomId: filtra a una sola habitación (módulo Historial). Sin prop, muestra todas.
export default function AbonosManager({ roomId }: { roomId?: string } = {}) {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [payments, setPayments] = useState<AbonoPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AbonoStatus | "all">("pending")

  async function load() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { setLoading(false); return }
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    let query = sb
      .from("abono_requests")
      .select("*, room:rooms(identifier), tenant_profile:tenant_profiles!abono_requests_tenant_profile_id_fkey(name)")
      .order("created_at", { ascending: false })
    if (roomId) query = query.eq("room_id", roomId)
    const { data } = await query
    const reqs = (data as RequestRow[]) ?? []
    setRequests(reqs)

    if (reqs.length > 0) {
      const { data: pays } = await sb
        .from("abono_payments")
        .select("*")
        .in("abono_request_id", reqs.map((r) => r.id))
        .order("created_at", { ascending: true })
      setPayments((pays as AbonoPayment[]) ?? [])
    } else {
      setPayments([])
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [roomId])

  async function patchRequest(r: RequestRow, patch: Partial<AbonoRequest>, auditMsg: string) {
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const full = { ...patch, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any).from("abono_requests").update(full).eq("id", r.id)
    if (error) { console.error("abono_requests update", error); alert(`Error: ${error.message}${error.code ? ` [${error.code}]` : ""}`); return }
    setRequests((p) => p.map((x) => x.id === r.id ? { ...x, ...full } : x))
    logAudit(`${auditMsg} — Hab. ${r.room?.identifier ?? ""} · ${r.period_month}`, "abono", r.room?.identifier)
  }

  function authorize(r: RequestRow) {
    patchRequest(r, { status: "authorized", authorized_amount: r.requested_amount }, `Autorizó abono Q${r.requested_amount.toLocaleString()}`)
  }

  function counteroffer(r: RequestRow) {
    const input = window.prompt(`Monto autorizado para el abono (el inquilino pidió Q${r.requested_amount.toLocaleString()}):`, String(r.requested_amount))
    if (input === null) return
    const amount = Number(input)
    if (!(amount > 0)) { alert("Monto inválido"); return }
    patchRequest(r, { status: "authorized", authorized_amount: amount }, `Autorizó abono (contraoferta) Q${amount.toLocaleString()}`)
  }

  function editAuthorized(r: RequestRow) {
    const input = window.prompt("Modificar monto autorizado:", String(r.authorized_amount ?? r.requested_amount))
    if (input === null) return
    const amount = Number(input)
    if (!(amount > 0)) { alert("Monto inválido"); return }
    patchRequest(r, { authorized_amount: amount }, `Modificó monto autorizado del abono a Q${amount.toLocaleString()}`)
  }

  function reject(r: RequestRow) {
    const reason = window.prompt("Motivo del rechazo (opcional):", "")
    if (reason === null) return
    patchRequest(r, { status: "rejected", admin_notes: reason || null }, `Rechazó abono${reason ? ` (${reason})` : ""}`)
  }

  async function viewPayment(storagePath: string) {
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const { data, error } = await sb.storage.from("receipts").createSignedUrl(storagePath, 300)
    if (error || !data) { console.error("createSignedUrl receipts (abono)", error); alert(`No se pudo abrir el comprobante${error ? `: ${error.message}` : ""}`); return }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  async function verifyPayment(ap: AbonoPayment, r: RequestRow) {
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()

    // Leer el pago acumulado del mes (si existe) y sumarle este abono
    const { data: existing } = await sb
      .from("monthly_payments")
      .select("amount, source")
      .eq("contract_id", ap.contract_id)
      .eq("period_month", ap.period_month)
      .maybeSingle()

    if (existing && existing.source !== "abono") {
      if (!confirm(`Este mes ya tiene un pago registrado como "${existing.source}" (Q${existing.amount.toLocaleString()}). Sumar este abono lo convertirá en pago por abonos. ¿Continuar?`)) return
    }

    const prevTotal = existing?.amount ?? 0
    const newTotal = prevTotal + ap.amount
    const monthTotal = r.month_total ?? 0
    if (monthTotal > 0 && newTotal > monthTotal) {
      if (!confirm(`Con este abono el total cobrado del mes (Q${newTotal.toLocaleString()}) supera el total esperado (Q${monthTotal.toLocaleString()}). ¿Continuar?`)) return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: payErr } = await (sb as any).from("monthly_payments").upsert({
      contract_id: ap.contract_id,
      room_id: ap.room_id,
      period_month: ap.period_month,
      amount: newTotal,
      source: "abono",
      receipt_id: null,
      registered_by: user?.id ?? null,
      notes: "Pago por abonos",
    }, { onConflict: "contract_id,period_month" })
    if (payErr) { console.error("monthly_payments upsert", payErr); alert(`Error al registrar el abono: ${payErr.message}${payErr.code ? ` [${payErr.code}]` : ""}`); return }

    const { error: apErr } = await sb.from("abono_payments")
      .update({ verified: true, rejected: false, rejection_reason: null, registered_by: user?.id ?? null })
      .eq("id", ap.id)
    if (apErr) { console.error("abono_payments update", apErr); alert(`Error al marcar verificado: ${apErr.message}${apErr.code ? ` [${apErr.code}]` : ""}`); return }
    setPayments((p) => p.map((x) => x.id === ap.id ? { ...x, verified: true, rejected: false, rejection_reason: null } : x))
    logAudit(`Verificó abono Q${ap.amount.toLocaleString()} — Hab. ${r.room?.identifier ?? ""} · ${ap.period_month} (acumulado Q${newTotal.toLocaleString()})`, "abono", r.room?.identifier)
  }

  async function rejectPayment(ap: AbonoPayment, r: RequestRow) {
    const reason = window.prompt("Motivo del rechazo (opcional):", "")
    if (reason === null) return
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    await sb.from("abono_payments")
      .update({ verified: false, rejected: true, rejection_reason: reason || null })
      .eq("id", ap.id)
    setPayments((p) => p.map((x) => x.id === ap.id ? { ...x, verified: false, rejected: true, rejection_reason: reason || null } : x))
    logAudit(`Rechazó abono Q${ap.amount.toLocaleString()} — Hab. ${r.room?.identifier ?? ""} · ${ap.period_month}${reason ? ` (${reason})` : ""}`, "abono", r.room?.identifier)
  }

  const shown = filter === "all" ? requests : requests.filter((r) => r.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? requests.length : requests.filter((r) => r.status === f.key).length
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key ? "bg-[#b64532] text-white" : "text-gray-600 hover:bg-gray-50"
              }`}>
              {f.label}{count > 0 ? ` (${count})` : ""}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Sin solicitudes de abono en esta vista.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const reqPays = payments.filter((p) => p.abono_request_id === r.id)
            const abonado = reqPays.filter((p) => p.verified).reduce((s, p) => s + p.amount, 0)
            const monthTotal = r.month_total ?? 0
            const restante = Math.max(0, monthTotal - abonado)
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Hab. {r.room?.identifier ?? "—"}</span>
                    <span className="text-xs text-gray-400 ml-2">{r.tenant_profile?.name ?? ""} · {periodLabel(r.period_month)}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_META[r.status].badge}`}>
                    {STATUS_META[r.status].label}
                  </span>
                </div>

                <div className="text-sm text-gray-700">
                  Propone abonar <span className="font-medium">Q{r.requested_amount.toLocaleString()}</span>
                  {monthTotal > 0 && <span className="text-gray-400"> · total del mes Q{monthTotal.toLocaleString()}</span>}
                </div>
                {r.status === "authorized" && (
                  <div className="text-xs text-green-700 mt-0.5">
                    Autorizado: Q{(r.authorized_amount ?? r.requested_amount).toLocaleString()}
                  </div>
                )}
                {r.status === "rejected" && r.admin_notes && (
                  <div className="text-xs text-red-500 mt-0.5">Motivo: {r.admin_notes}</div>
                )}

                {/* Acciones de la solicitud */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                  <span className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {r.status === "pending" && (
                      <>
                        <button onClick={() => authorize(r)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                          Autorizar
                        </button>
                        <button onClick={() => counteroffer(r)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                          Contraoferta
                        </button>
                        <button onClick={() => reject(r)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                          Rechazar
                        </button>
                      </>
                    )}
                    {r.status === "authorized" && (
                      <button onClick={() => editAuthorized(r)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                        Modificar monto autorizado
                      </button>
                    )}
                    {r.status === "rejected" && (
                      <button onClick={() => authorize(r)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                        Autorizar
                      </button>
                    )}
                  </div>
                </div>

                {/* Comprobantes de abono (cuando está autorizado o ya hay) */}
                {(r.status === "authorized" || reqPays.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    {monthTotal > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Abonado Q{abonado.toLocaleString()} de Q{monthTotal.toLocaleString()}</span>
                          <span>Restante Q{restante.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: `${monthTotal > 0 ? Math.min(100, (abonado / monthTotal) * 100) : 0}%` }} />
                        </div>
                      </div>
                    )}
                    {reqPays.length === 0 ? (
                      <p className="text-xs text-gray-400">El inquilino aún no ha subido comprobantes de abono.</p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {reqPays.map((ap) => (
                          <div key={ap.id} className="py-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-sm text-gray-800">Q{ap.amount.toLocaleString()}</span>
                              <span className="text-xs text-gray-400 ml-2">{new Date(ap.created_at).toLocaleDateString("es-GT")}</span>
                              {ap.rejected && ap.rejection_reason && (
                                <p className="text-xs text-red-500">Motivo: {ap.rejection_reason}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => viewPayment(ap.storage_path)} className="text-xs text-[#24577a] hover:underline">Ver</button>
                              {ap.verified ? (
                                <span className="text-xs text-green-600 font-medium">✓ Verificado</span>
                              ) : (
                                <>
                                  <button onClick={() => verifyPayment(ap, r)}
                                    className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                                    Aceptar
                                  </button>
                                  <button onClick={() => rejectPayment(ap, r)}
                                    className={`text-xs px-2 py-1 rounded border ${ap.rejected ? "bg-red-100 text-red-700 border-red-300" : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"}`}>
                                    {ap.rejected ? "Rechazado" : "Rechazar"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
