"use client"
import { useEffect, useState } from "react"
import type { Room, Contract, TenantProfile, RoomType } from "@/lib/supabase/types"
import ContractDialog from "./ContractDialog"
import CredentialsDialog from "./CredentialsDialog"

type RoomWithDetails = Room & {
  room_type?: RoomType
  contract?: (Contract & { tenant_profile?: TenantProfile }) | null
}

const STATUS_META = {
  available: { label: "Disponible", dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
  occupied: { label: "Ocupada", dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
  expiring_soon: { label: "Vence pronto", dot: "bg-yellow-400", badge: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  renovation: { label: "Remodelación", dot: "bg-gray-800", badge: "bg-gray-100 text-gray-800 border-gray-300" },
}

function daysUntilPayment(paymentDay: number): number {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), paymentDay)
  if (thisMonth < today) thisMonth.setMonth(thisMonth.getMonth() + 1)
  return Math.ceil((thisMonth.getTime() - today.getTime()) / 86400000)
}

function RoomCard({
  room,
  onStatusChange,
  onContractCreated,
  onContractEnded,
}: {
  room: RoomWithDetails
  onStatusChange: (id: string, status: Room["status"]) => Promise<void>
  onContractCreated: () => void
  onContractEnded: (roomId: string) => Promise<void>
}) {
  const meta = STATUS_META[room.status]
  const contract = room.contract
  const tenant = contract?.tenant_profile
  const [statusChanging, setStatusChanging] = useState(false)
  const [showContract, setShowContract] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(null)

  const payDays = contract ? daysUntilPayment(contract.payment_day) : null
  const paymentDue = payDays !== null && payDays <= 3

  async function handleStatusChange(newStatus: Room["status"]) {
    setStatusChanging(true)
    await onStatusChange(room.id, newStatus)
    setStatusChanging(false)
  }

  async function handleEndContract() {
    if (!confirm(`¿Terminar contrato de ${tenant?.name}? Se borrarán sus comprobantes y se desactivará su acceso.`)) return
    await onContractEnded(room.id)
  }

  function waPaymentReminder() {
    if (!tenant) return
    const template = contract?.whatsapp_template ??
      `Hola ${tenant.name}, te recordamos que tu pago de renta vence el día ${contract?.payment_day}. Por favor realiza tu pago a tiempo. ¡Gracias!`
    window.open(`https://wa.me/${tenant.phone.replace(/\D/g, "")}?text=${encodeURIComponent(template)}`, "_blank")
  }

  return (
    <>
      <div className={`bg-white rounded-xl border p-4 flex flex-col gap-3 ${statusChanging ? "opacity-60" : ""}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
              <span className="font-semibold text-gray-900 text-sm">
                Hab. {room.identifier}
              </span>
            </div>
            {room.room_type && (
              <span className="text-xs text-gray-400 ml-4.5">{room.room_type.label}</span>
            )}
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${meta.badge}`}>
            {meta.label}
          </span>
        </div>

        {/* Tenant info when occupied */}
        {tenant && contract && (
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-600 space-y-1">
            <div className="font-medium text-gray-800">{tenant.name}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-gray-500">
              <span>Inicio: {new Date(contract.start_date).toLocaleDateString("es-GT")}</span>
              <span>{contract.duration_months} meses</span>
              <span>Vence: {new Date(contract.end_date).toLocaleDateString("es-GT")}</span>
            </div>
            <div className={`flex items-center gap-1 font-medium ${paymentDue ? "text-amber-600" : "text-gray-500"}`}>
              <span>Pago: día {contract.payment_day}</span>
              {payDays !== null && (
                <span>({payDays === 0 ? "hoy" : payDays === 1 ? "mañana" : `en ${payDays} días`})</span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-auto">
          {/* Status change */}
          <select
            value={room.status}
            onChange={(e) => handleStatusChange(e.target.value as Room["status"])}
            disabled={statusChanging}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#b64532]/40 cursor-pointer"
          >
            <option value="available">Disponible</option>
            <option value="occupied">Ocupada</option>
            <option value="expiring_soon">Vence pronto</option>
            <option value="renovation">Remodelación</option>
          </select>

          {/* Contract button */}
          {room.status === "available" ? (
            <button
              onClick={() => setShowContract(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#b64532] text-white font-medium hover:bg-[#9a3727] transition-colors"
            >
              + Contrato
            </button>
          ) : contract && (
            <button
              onClick={handleEndContract}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              Terminar contrato
            </button>
          )}

          {/* WA payment button */}
          {paymentDue && tenant && (
            <button
              onClick={waPaymentReminder}
              className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.6.2-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.5-.8-2.1-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.3c-1.5 0-3-.4-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3C4 15.1 3.6 13.6 3.6 12 3.6 7.4 7.4 3.6 12 3.6S20.4 7.4 20.4 12 16.6 20.3 12 20.3z"/>
              </svg>
              Recordar pago
            </button>
          )}
        </div>
      </div>

      {showContract && (
        <ContractDialog
          room={room}
          onClose={() => setShowContract(false)}
          onCreated={(creds) => {
            setShowContract(false)
            setNewCredentials(creds)
            setShowCredentials(true)
            onContractCreated()
          }}
        />
      )}

      {showCredentials && newCredentials && (
        <CredentialsDialog
          credentials={newCredentials}
          roomIdentifier={room.identifier}
          onClose={() => { setShowCredentials(false); setNewCredentials(null) }}
        />
      )}
    </>
  )
}

export default function RoomGrid({ propertyId }: { propertyId: string }) {
  const [rooms, setRooms] = useState<RoomWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  async function loadRooms() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setLoading(false)
      return
    }
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data } = await supabase
      .from("rooms")
      .select(`
        *,
        room_type:room_types(*),
        contract:contracts!inner(*, tenant_profile:tenant_profiles(*))
      `)
      .eq("property_id", propertyId)
      .in("contract.status", ["active"])
      .order("sort_order")

    // Also get rooms without contracts
    const { data: allRooms } = await supabase
      .from("rooms")
      .select(`*, room_type:room_types(*)`)
      .eq("property_id", propertyId)
      .order("sort_order")

    // Merge contract data
    const contractMap = new Map(
      (data ?? []).map((r) => [r.id, r.contract])
    )
    const merged = (allRooms ?? []).map((r) => ({
      ...r,
      contract: contractMap.get(r.id) ?? null,
    }))
    setRooms(merged)
    setLoading(false)
  }

  useEffect(() => { loadRooms() }, [propertyId])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatusChange(id: string, status: Room["status"]) {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("rooms").update({ status }).eq("id", id)
    setRooms((prev) => prev.map((r) => r.id === id ? { ...r, status } : r))
  }

  async function handleContractEnded(roomId: string) {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()

    const room = rooms.find((r) => r.id === roomId)
    const contract = (room as RoomWithDetails)?.contract
    if (!contract) return

    // Delete receipts from storage
    const { data: receipts } = await supabase
      .from("payment_receipts")
      .select("storage_path")
      .eq("contract_id", contract.id)

    if (receipts?.length) {
      await supabase.storage.from("receipts").remove(receipts.map((r) => r.storage_path))
      await supabase.from("payment_receipts").delete().eq("contract_id", contract.id)
    }

    // End contract
    await supabase.from("contracts").update({ status: "ended" }).eq("id", contract.id)

    // Disable tenant auth (via service role — done server-side ideally; here we just mark profile)
    if (contract.tenant_profile_id) {
      await supabase.from("tenant_profiles").delete().eq("id", contract.tenant_profile_id)
    }

    // Mark room available
    await supabase.from("rooms").update({ status: "available" }).eq("id", roomId)
    await loadRooms()
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">Configura las variables de entorno de Supabase para ver las habitaciones.</p>
        <p className="text-xs mt-1">NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          onStatusChange={handleStatusChange}
          onContractCreated={loadRooms}
          onContractEnded={handleContractEnded}
        />
      ))}
    </div>
  )
}
