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
}

export default function ReceiptsDialog({ contract, roomIdentifier, onClose }: Props) {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [recurringCharges, setRecurringCharges] = useState<{ amount: number }[]>([])
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

      // Cargos recurrentes (para calcular monto al aprobar)
      const { data: rcData } = await supabase
        .from("recurring_charges")
        .select("amount")
        .eq("contract_id", contract.id)
      setRecurringCharges(rcData ?? [])

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
    if (error || !data) { alert("No se pudo abrir el comprobante"); return }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  async function verifyReceipt(receipt: PaymentReceipt) {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Marcar comprobante como verificado
    await supabase.from("payment_receipts")
      .update({ verified: true, rejected: false, rejection_reason: null })
      .eq("id", receipt.id)

    // 2. Calcular monto = renta mensual + cargos recurrentes
    const base = contract.monthly_rent ?? 0
    const rcTotal = recurringCharges.reduce((s, r) => s + r.amount, 0)
    const totalAmount = base + rcTotal

    // 3. Registrar el ingreso confirmado en monthly_payments
    await supabase.from("monthly_payments").upsert({
      contract_id: contract.id,
      room_id: contract.room_id,
      period_month: receipt.period_month,
      amount: totalAmount,
      source: "receipt",
      receipt_id: receipt.id,
      registered_by: user?.id ?? null,
      notes: null,
    }, { onConflict: "contract_id,period_month" })

    setReceipts((prev) => prev.map((r) =>
      r.id === receipt.id ? { ...r, verified: true, rejected: false, rejection_reason: null } : r
    ))
    logAudit(
      `Aceptó comprobante — Hab. ${roomIdentifier} · ${receipt.period_month} · Q${totalAmount.toLocaleString()}`,
      "receipt", roomIdentifier
    )
  }

  async function rejectReceipt(receipt: PaymentReceipt) {
    const reason = window.prompt("Motivo del rechazo (opcional):", "")
    if (reason === null) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("payment_receipts")
      .update({ verified: false, rejected: true, rejection_reason: reason || null })
      .eq("id", receipt.id)
    setReceipts((prev) => prev.map((r) => r.id === receipt.id
      ? { ...r, verified: false, rejected: true, rejection_reason: reason || null }
      : r))
    logAudit(`Rechazó comprobante — Hab. ${roomIdentifier} · ${receipt.period_month}${reason ? ` (${reason})` : ""}`, "receipt", roomIdentifier)
  }

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
            {receipts.map((r) => (
              <div key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                <div className="min-w-0">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{periodLabel(r.period_month)}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      subido el {new Date(r.uploaded_at).toLocaleDateString("es-GT")}
                    </span>
                  </div>

                  {/* Alerta de fraude — archivo duplicado entre inquilinos */}
                  {r.file_hash && (duplicateWarnings[r.file_hash]?.length ?? 0) > 0 && (
                    <div className="mt-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs font-semibold text-red-700">⚠️ Archivo duplicado detectado:</p>
                      {duplicateWarnings[r.file_hash].map((w, i) => (
                        <p key={i} className="text-xs text-red-600">
                          {w.tenantName} · {periodLabel(w.periodMonth)}
                        </p>
                      ))}
                    </div>
                  )}

                  {r.rejected && r.rejection_reason && (
                    <p className="text-xs text-red-500 mt-0.5">Motivo: {r.rejection_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => viewReceipt(r.storage_path)}
                    className="text-xs text-[#24577a] hover:underline">Ver</button>
                  {r.verified ? (
                    <span className="text-xs text-green-600 font-medium">✓ Verificado</span>
                  ) : (
                    <>
                      <button onClick={() => verifyReceipt(r)}
                        className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200">
                        Aceptar
                      </button>
                      <button onClick={() => rejectReceipt(r)}
                        className={`text-xs px-2 py-1 rounded transition-colors border ${r.rejected ? "bg-red-100 text-red-700 border-red-300" : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"}`}>
                        {r.rejected ? "Rechazado" : "Rechazar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
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
