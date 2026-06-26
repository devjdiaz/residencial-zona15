"use client"
import { useEffect, useState } from "react"
import type { Contract, PaymentReceipt, TenantProfile } from "@/lib/supabase/types"
import { logAudit } from "@/lib/audit"

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function periodLabel(period: string) {
  const [year, month] = period.split("-")
  return `${MONTHS[Number(month) - 1] ?? period} ${year}`
}

interface Props {
  contract: Contract & { tenant_profile?: TenantProfile }
  roomIdentifier: string
  onClose: () => void
  onPendingChange?: (pendingCount: number) => void
}

const countPending = (rows: PaymentReceipt[]) => rows.filter((r) => !r.verified && !r.rejected).length

export default function ReceiptsDialog({ contract, roomIdentifier, onClose, onPendingChange }: Props) {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [recurringCharges, setRecurringCharges] = useState<{ amount: number }[]>([])
  // Precio de lista del tipo de habitación: fallback cuando el contrato no tiene renta negociada
  const [listPrice, setListPrice] = useState(0)
  const [duplicateWarnings, setDuplicateWarnings] = useState<
    Record<string, { tenantName: string; periodMonth: string }[]>
  >({})

  useEffect(() => {
    async function load() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      // Comprobantes de este contrato
      const { data } = await supabase
        .from("payment_receipts")
        .select("*")
        .eq("contract_id", contract.id)
        .order("period_month", { ascending: false })
      setReceipts(data ?? [])
      onPendingChange?.(countPending(data ?? []))

      // Cargos recurrentes (para calcular monto al aprobar)
      const { data: rcData } = await supabase
        .from("recurring_charges")
        .select("amount")
        .eq("contract_id", contract.id)
      setRecurringCharges(rcData ?? [])

      // Precio de lista de la habitación (fallback si monthly_rent es null)
      const { data: room } = await supabase
        .from("rooms")
        .select("price")
        .eq("id", contract.room_id)
        .single()
      setListPrice((room as { price?: number | null } | null)?.price ?? 0)

      // Detección de comprobantes duplicados entre todos los inquilinos
      const hashes = (data ?? []).map((r) => r.file_hash).filter(Boolean) as string[]
      if (hashes.length > 0) {
        const { data: dupes } = await supabase
          .from("payment_receipts")
          .select("file_hash, period_month, tenant_profile:tenant_profiles!payment_receipts_tenant_profile_id_fkey(name)")
          .in("file_hash", hashes)
          .neq("contract_id", contract.id)
        const warnings: Record<string, { tenantName: string; periodMonth: string }[]> = {}
        for (const d of dupes ?? []) {
          const hash = d.file_hash as string
          const name = (d.tenant_profile as { name?: string } | null)?.name ?? "Desconocido"
          if (!warnings[hash]) warnings[hash] = []
          warnings[hash].push({ tenantName: name, periodMonth: d.period_month })
        }
        setDuplicateWarnings(warnings)
      }

      setLoading(false)
    }
    load()
  }, [contract.id])

  async function viewReceipt(storagePath: string) {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(storagePath, 300)
    if (error || !data) { console.error("createSignedUrl receipts", error); alert(`No se pudo abrir el comprobante${error ? `: ${error.message}` : ""}`); return }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  // Verifica uno o varios meses (una transferencia puede cubrir varios meses con el mismo archivo)
  async function verifyRows(rows: PaymentReceipt[]) {
    if (rows.length === 0) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const ids = rows.map((r) => r.id)

    // 1. Marcar comprobantes como verificados
    await supabase.from("payment_receipts")
      .update({ verified: true, rejected: false, rejection_reason: null })
      .in("id", ids)

    // 2. Monto por mes = renta (negociada o precio de lista) + cargos recurrentes
    const base = contract.monthly_rent ?? listPrice ?? 0
    const rcTotal = recurringCharges.reduce((s, r) => s + r.amount, 0)
    const monthAmount = base + rcTotal

    // 3. Registrar un ingreso confirmado por cada mes cubierto
    await supabase.from("monthly_payments").upsert(
      rows.map((r) => ({
        contract_id: contract.id,
        room_id: contract.room_id,
        period_month: r.period_month,
        amount: monthAmount,
        source: "receipt",
        receipt_id: r.id,
        registered_by: user?.id ?? null,
        notes: null,
      })),
      { onConflict: "contract_id,period_month" }
    )

    const idSet = new Set(ids)
    const next = receipts.map((r) =>
      idSet.has(r.id) ? { ...r, verified: true, rejected: false, rejection_reason: null } : r
    )
    setReceipts(next)
    onPendingChange?.(countPending(next))
    const periods = rows.map((r) => r.period_month).sort().join(", ")
    logAudit(
      `Aceptó comprobante — Hab. ${roomIdentifier} · ${periods} · Q${(monthAmount * rows.length).toLocaleString()}`,
      "receipt", roomIdentifier
    )
  }

  async function rejectRows(rows: PaymentReceipt[]) {
    if (rows.length === 0) return
    const reason = window.prompt("Motivo del rechazo (opcional):", "")
    if (reason === null) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const ids = rows.map((r) => r.id)
    await supabase.from("payment_receipts")
      .update({ verified: false, rejected: true, rejection_reason: reason || null })
      .in("id", ids)
    const idSet = new Set(ids)
    const next = receipts.map((r) => idSet.has(r.id)
      ? { ...r, verified: false, rejected: true, rejection_reason: reason || null }
      : r)
    setReceipts(next)
    onPendingChange?.(countPending(next))
    const periods = rows.map((r) => r.period_month).sort().join(", ")
    logAudit(`Rechazó comprobante — Hab. ${roomIdentifier} · ${periods}${reason ? ` (${reason})` : ""}`, "receipt", roomIdentifier)
  }

  // Monto confirmado por mes (renta negociada o precio de lista + recurrentes)
  const monthAmount = (contract.monthly_rent ?? listPrice ?? 0) + recurringCharges.reduce((s, r) => s + r.amount, 0)

  // Agrupa los comprobantes: una transferencia multi-mes (mismo payment_group_id) se muestra
  // como una sola unidad; los pagos de un mes quedan individuales.
  const units = (() => {
    const seen = new Set<string>()
    const out: { key: string; rows: PaymentReceipt[] }[] = []
    for (const r of receipts) {
      if (r.payment_group_id) {
        if (seen.has(r.payment_group_id)) continue
        seen.add(r.payment_group_id)
        const rows = receipts
          .filter((x) => x.payment_group_id === r.payment_group_id)
          .sort((a, b) => a.period_month.localeCompare(b.period_month))
        out.push({ key: r.payment_group_id, rows })
      } else {
        out.push({ key: r.id, rows: [r] })
      }
    }
    return out
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Comprobantes — Hab. {roomIdentifier}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {contract.tenant_profile?.name ?? ""} · {receipts.filter((r) => r.verified).length}/{receipts.length} verificados
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : receipts.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">El inquilino aún no ha subido comprobantes.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {units.map((u) => {
              const isGroup = u.rows.length > 1
              const first = u.rows[0]
              const last = u.rows[u.rows.length - 1]
              const allVerified = u.rows.every((r) => r.verified)
              const anyRejected = u.rows.some((r) => r.rejected)
              const pending = u.rows.filter((r) => !r.verified && !r.rejected)
              const hash = first.file_hash
              return (
                <div key={u.key} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                  <div className="min-w-0">
                    <div>
                      {isGroup ? (
                        <>
                          <span className="text-sm font-medium text-gray-800">
                            {periodLabel(first.period_month)} – {periodLabel(last.period_month)}
                          </span>
                          <span className="text-[11px] text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-1.5 py-0.5 ml-2">
                            1 transferencia · {u.rows.length} meses
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-medium text-gray-800">{periodLabel(first.period_month)}</span>
                      )}
                      <span className="text-xs text-gray-400 ml-2">
                        subido el {new Date(first.uploaded_at).toLocaleDateString("es-GT")}
                      </span>
                    </div>

                    {isGroup && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Cubre {u.rows.map((r) => periodLabel(r.period_month)).join(", ")} · Total Q{(monthAmount * u.rows.length).toLocaleString()}
                      </p>
                    )}

                    {/* Alerta de fraude — archivo duplicado entre inquilinos */}
                    {hash && (duplicateWarnings[hash]?.length ?? 0) > 0 && (
                      <div className="mt-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs font-semibold text-red-700">⚠️ Archivo duplicado detectado:</p>
                        {duplicateWarnings[hash].map((w, i) => (
                          <p key={i} className="text-xs text-red-600">
                            {w.tenantName} · {periodLabel(w.periodMonth)}
                          </p>
                        ))}
                      </div>
                    )}

                    {anyRejected && first.rejection_reason && (
                      <p className="text-xs text-red-500 mt-0.5">Motivo: {first.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => viewReceipt(first.storage_path)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#24577a]/10 text-[#24577a] border border-[#24577a]/30 hover:bg-[#24577a]/20 transition-colors font-medium">
                      👁 Ver
                    </button>
                    {allVerified ? (
                      <span className="text-xs text-green-600 font-medium sm:ml-2">✓ Verificado</span>
                    ) : (
                      <div className="flex items-center gap-1.5 sm:ml-2 sm:pl-2 sm:border-l sm:border-gray-200">
                        <button onClick={() => verifyRows(pending.length ? pending : u.rows)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200">
                          {isGroup ? "Aceptar todo" : "Aceptar"}
                        </button>
                        <button onClick={() => rejectRows(u.rows)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors border ${anyRejected ? "bg-red-100 text-red-700 border-red-300" : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"}`}>
                          {anyRejected ? "Rechazado" : "Rechazar"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <button onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  )
}
