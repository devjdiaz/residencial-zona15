"use client"
import { useEffect, useState } from "react"
import type { Contract, TenantProfile } from "@/lib/supabase/types"
import ContractFileManager from "./ContractFileManager"
import ReceiptsDialog from "./ReceiptsDialog"
import ReportsManager from "./ReportsManager"

interface Property { id: string; name: string; slug: string }
interface RoomRow { id: string; identifier: string; sort_order: number }
type ContractRow = Contract & { tenant_profile?: TenantProfile }

type DialogState =
  | { kind: "contract"; room: RoomRow; contract: ContractRow }
  | { kind: "receipts"; room: RoomRow; contract: ContractRow }
  | { kind: "reports"; room: RoomRow }
  | null

export default function HistorialView({ properties }: { properties: Property[] }) {
  const [activeId, setActiveId] = useState(properties[0]?.id ?? "")
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [pendingByContract, setPendingByContract] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogState>(null)

  const notConfigured = !process.env.NEXT_PUBLIC_SUPABASE_URL

  useEffect(() => {
    if (!activeId || notConfigured) { setLoading(false); return }
    setLoading(true)
    async function load() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data: roomRows } = await supabase
        .from("rooms")
        .select("id, identifier, sort_order")
        .eq("property_id", activeId)
        .order("sort_order")
      const roomIds = (roomRows ?? []).map((r) => r.id)

      const { data: contractRows } = await supabase
        .from("contracts")
        .select("*, tenant_profile:tenant_profiles!contracts_tenant_profile_id_fkey(*)")
        .in("room_id", roomIds.length ? roomIds : ["none"])
        .eq("status", "active") as { data: ContractRow[] | null }

      // Comprobantes pendientes de autorizar (subidos, sin verificar ni rechazar) por contrato
      const contractIds = (contractRows ?? []).map((c) => c.id)
      const { data: pendingRows } = await supabase
        .from("payment_receipts")
        .select("contract_id")
        .in("contract_id", contractIds.length ? contractIds : ["none"])
        .eq("verified", false)
        .eq("rejected", false)
      const pending: Record<string, number> = {}
      for (const row of pendingRows ?? []) {
        const cid = (row as { contract_id: string }).contract_id
        pending[cid] = (pending[cid] ?? 0) + 1
      }

      setRooms(roomRows ?? [])
      setContracts(contractRows ?? [])
      setPendingByContract(pending)
      setLoading(false)
    }
    load()
  }, [activeId, notConfigured])

  function contractFor(roomId: string) {
    return contracts.find((c) => c.room_id === roomId) ?? null
  }

  function updateContractFile(contractId: string, newPath: string) {
    setContracts((prev) => prev.map((c) => c.id === contractId ? { ...c, contract_file_path: newPath } : c))
  }

  if (notConfigured) {
    return <p className="text-sm text-gray-400 py-8 text-center">Configura Supabase para ver el historial.</p>
  }

  const actionBtn = "text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"

  return (
    <>
      {/* Property tabs — client toggle, no reload */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit max-w-full overflow-x-auto mb-6">
        {properties.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              p.id === activeId ? "bg-[#b64532] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Sin habitaciones en esta propiedad.</p>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => {
            const contract = contractFor(room.id)
            const pending = contract ? (pendingByContract[contract.id] ?? 0) : 0
            return (
              <div key={room.id} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-900">Hab. {room.identifier}</span>
                  {contract?.tenant_profile?.name ? (
                    <span className="block text-xs text-gray-400 truncate">{contract.tenant_profile.name}</span>
                  ) : (
                    <span className="block text-xs text-gray-400 italic">Sin contrato activo</span>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    disabled={!contract}
                    onClick={() => contract && setDialog({ kind: "contract", room, contract })}
                    className={`${actionBtn} border-gray-200 text-gray-600 hover:bg-gray-50`}
                  >
                    📄 Contrato
                  </button>
                  <button
                    disabled={!contract}
                    onClick={() => contract && setDialog({ kind: "receipts", room, contract })}
                    className={`${actionBtn} relative ${pending > 0 ? "border-amber-300 bg-amber-50 text-amber-800 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  >
                    🧾 Comprobantes
                    {pending > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold align-middle">
                        {pending}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setDialog({ kind: "reports", room })}
                    className={`${actionBtn} border-gray-200 text-gray-600 hover:bg-gray-50`}
                  >
                    🛠️ Reportes
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Contrato firmado */}
      {dialog?.kind === "contract" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDialog(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Contrato — Hab. {dialog.room.identifier}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{dialog.contract.tenant_profile?.name ?? ""}</p>
            </div>
            <ContractFileManager
              contractId={dialog.contract.id}
              roomIdentifier={dialog.room.identifier}
              filePath={dialog.contract.contract_file_path ?? null}
              onUpdated={(newPath) => updateContractFile(dialog.contract.id, newPath)}
            />
            <button onClick={() => setDialog(null)}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Comprobantes mes a mes */}
      {dialog?.kind === "receipts" && (
        <ReceiptsDialog
          contract={dialog.contract}
          roomIdentifier={dialog.room.identifier}
          onPendingChange={(count) =>
            setPendingByContract((prev) => ({ ...prev, [dialog.contract.id]: count }))
          }
          onClose={() => setDialog(null)}
        />
      )}

      {/* Reportes de la habitación */}
      {dialog?.kind === "reports" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDialog(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Reportes — Hab. {dialog.room.identifier}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Reportes del inquilino para esta habitación</p>
            </div>
            <ReportsManager roomId={dialog.room.id} />
            <button onClick={() => setDialog(null)}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
