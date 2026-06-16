"use client"
import { useEffect, useState } from "react"
import type { Contract, PaymentReceipt, TenantProfile } from "@/lib/supabase/types"
import { logAudit } from "@/lib/audit"

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

// 'YYYY-MM' → 'Junio 2026'
function periodLabel(period: string) {
  const [year, month] = period.split("-")
  return `${MONTHS[Number(month) - 1] ?? period} ${year}`
}

interface Props {
  contract: Contract & { tenant_profile?: TenantProfile }
  roomIdentifier: string
  onClose: () => void
}

// Registro cronológico de comprobantes del contrato activo, con la
// verificación (Ver/Aceptar/Rechazar) que antes vivía en Finanzas.
export default function ReceiptsDialog({ contract, roomIdentifier, onClose }: Props) {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase
        .from("payment_receipts")
        .select("*")
        .eq("contract_id", contract.id)
        .order("period_month", { ascending: false })
      setReceipts(data ?? [])
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
    await supabase.from("payment_receipts").update({ verified: true, rejected: false, rejection_reason: null }).eq("id", receipt.id)
    setReceipts((prev) => prev.map((r) => r.id === receipt.id ? { ...r, verified: true, rejected: false, rejection_reason: null } : r))
    logAudit(`Aceptó comprobante — Hab. ${roomIdentifier} · ${receipt.period_month}`, "receipt", roomIdentifier)
  }

  async function rejectReceipt(receipt: PaymentReceipt) {
    const reason = window.prompt("Motivo del rechazo (opcional):", "")
    if (reason === null) return // cancelled
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
