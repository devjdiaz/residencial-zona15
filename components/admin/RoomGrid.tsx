"use client"
import { useEffect, useState } from "react"
import type { Room, Contract, TenantProfile, RoomType } from "@/lib/supabase/types"
import ContractDialog from "./ContractDialog"
import ContractInfoDialog from "./ContractInfoDialog"
import CredentialsDialog from "./CredentialsDialog"
import RoomPhotoDialog from "./RoomPhotoDialog"

type RoomWithDetails = Room & {
  room_type?: RoomType | null
  contract?: (Contract & { tenant_profile?: TenantProfile }) | null
}

const STATUS_META = {
  available:     { label: "Disponible",    dot: "bg-green-500",  badge: "bg-green-50 text-green-700 border-green-200" },
  occupied:      { label: "Ocupada",       dot: "bg-red-500",    badge: "bg-red-50 text-red-700 border-red-200" },
  expiring_soon: { label: "Vence pronto",  dot: "bg-yellow-400", badge: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  renovation:    { label: "Remodelación",  dot: "bg-gray-800",   badge: "bg-gray-100 text-gray-800 border-gray-300" },
}

function daysUntilPayment(paymentDay: number): number {
  const today = new Date()
  const due = new Date(today.getFullYear(), today.getMonth(), paymentDay)
  if (due < today) due.setMonth(due.getMonth() + 1)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

function RoomCard({
  room, roomTypes, onStatusChange, onTypeChange, onContractCreated, onContractEnded,
}: {
  room: RoomWithDetails
  roomTypes: RoomType[]
  onStatusChange: (id: string, status: Room["status"]) => Promise<void>
  onTypeChange: (id: string, typeId: string | null) => Promise<void>
  onContractCreated: () => void
  onContractEnded: (roomId: string) => Promise<void>
}) {
  const meta = STATUS_META[room.status]
  const contract = room.contract
  const tenant = contract?.tenant_profile
  const [busy, setBusy] = useState(false)
  const [showContract, setShowContract] = useState(false)
  const [showContractInfo, setShowContractInfo] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)
  const [photoCount, setPhotoCount] = useState(room.room_photos?.length ?? 0)
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(null)

  const payDays = contract ? daysUntilPayment(contract.payment_day) : null
  const paymentDue = payDays !== null && payDays <= 3

  async function handleStatus(v: Room["status"]) {
    setBusy(true); await onStatusChange(room.id, v); setBusy(false)
  }
  async function handleType(v: string) {
    setBusy(true); await onTypeChange(room.id, v || null); setBusy(false)
  }
  function waReminder() {
    if (!tenant || !contract) return
    const msg = contract.whatsapp_template ??
      `Hola ${tenant.name}, te recordamos que tu pago de renta vence el día ${contract.payment_day}. Por favor realiza tu pago a tiempo. ¡Gracias!`
    window.open(`https://wa.me/${tenant.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank")
  }

  return (
    <>
      <div className={`bg-white rounded-xl border p-4 flex flex-col gap-3 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
              <span className="font-semibold text-gray-900 text-sm">Hab. {room.identifier}</span>
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${meta.badge}`}>
            {meta.label}
          </span>
        </div>

        {/* Type selector */}
        <select
          value={room.type_id ?? ""}
          onChange={(e) => handleType(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#b64532]/40 w-full"
        >
          <option value="">— Sin tipo asignado —</option>
          {roomTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.label} · Q{t.price.toLocaleString()}</option>
          ))}
        </select>

        {/* Tenant info */}
        {tenant && contract && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-0.5">
            <div className="font-medium text-gray-800">{tenant.name}</div>
            <div className="text-gray-500">
              {new Date(contract.start_date).toLocaleDateString("es-GT")} · {contract.duration_months} m
            </div>
            <div className={`font-medium ${paymentDue ? "text-amber-600" : "text-gray-500"}`}>
              Pago día {contract.payment_day}
              {payDays !== null && ` · ${payDays === 0 ? "¡hoy!" : payDays === 1 ? "mañana" : `en ${payDays}d`}`}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          <select
            value={room.status}
            onChange={(e) => handleStatus(e.target.value as Room["status"])}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none flex-1 min-w-0"
          >
            <option value="available">Disponible</option>
            <option value="occupied">Ocupada</option>
            <option value="expiring_soon">Vence pronto</option>
            <option value="renovation">Remodelación</option>
          </select>

          {room.status === "available" ? (
            <button onClick={() => setShowContract(true)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-[#b64532] text-white font-medium hover:bg-[#9a3727] transition-colors">
              + Contrato
            </button>
          ) : contract && (
            <button onClick={() => setShowContractInfo(true)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              Ver contrato
            </button>
          )}
          {contract && (
            <button onClick={async () => {
              if (!confirm(`¿Terminar contrato de ${tenant?.name}?`)) return
              await onContractEnded(room.id)
            }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
              Terminar
            </button>
          )}
        </div>

        {/* Photo button */}
        <button
          onClick={() => setShowPhotos(true)}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 w-full"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          Fotos{photoCount > 0 ? ` (${photoCount})` : ""}
        </button>

        {paymentDue && tenant && (
          <button onClick={waReminder}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-1 w-full">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.6.2-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.5-.8-2.1-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3z"/>
              <path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.3c-1.5 0-3-.4-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3C4 15.1 3.6 13.6 3.6 12 3.6 7.4 7.4 3.6 12 3.6S20.4 7.4 20.4 12 16.6 20.3 12 20.3z"/>
            </svg>
            Recordar pago
          </button>
        )}
      </div>

      {showContractInfo && contract && (
        <ContractInfoDialog
          contract={contract}
          roomIdentifier={room.identifier}
          onClose={() => setShowContractInfo(false)}
        />
      )}
      {showContract && (
        <ContractDialog room={{ ...room, room_type: room.room_type ?? undefined }}
          onClose={() => setShowContract(false)}
          onCreated={(creds) => { setShowContract(false); setNewCredentials(creds); setShowCredentials(true); onContractCreated() }} />
      )}
      {showCredentials && newCredentials && (
        <CredentialsDialog credentials={newCredentials} roomIdentifier={room.identifier}
          onClose={() => { setShowCredentials(false); setNewCredentials(null) }} />
      )}
      {showPhotos && (
        <RoomPhotoDialog
          roomId={room.id}
          roomIdentifier={room.identifier}
          onClose={(newCount) => { setShowPhotos(false); setPhotoCount(newCount) }}
        />
      )}
    </>
  )
}

// ─── Main grid ────────────────────────────────────────────────────────────────

export default function RoomGrid({ propertyId }: { propertyId: string }) {
  const [rooms, setRooms] = useState<RoomWithDetails[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)

  async function loadRooms() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { setLoading(false); return }
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()

    const { data: types } = await sb.from("room_types").select("*").order("price")
    setRoomTypes((types as RoomType[]) ?? [])

    const { data: allRooms } = await sb
      .from("rooms")
      .select("*, room_type:room_types(*), room_photos(*)")
      .eq("property_id", propertyId)
      .order("sort_order")

    const roomIds = (allRooms ?? []).map((r) => r.id)
    const { data: contracts } = await sb
      .from("contracts")
      .select("*, tenant_profile:tenant_profiles!contracts_tenant_profile_id_fkey(*)")
      .in("room_id", roomIds)
      .eq("status", "active")

    const contractMap = new Map((contracts ?? []).map((c) => [c.room_id, c]))
    const merged = (allRooms ?? []).map((r) => ({ ...r, contract: contractMap.get(r.id) ?? null }))
    setRooms(merged as RoomWithDetails[])
    setLoading(false)
  }

  useEffect(() => { loadRooms() }, [propertyId])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatusChange(id: string, status: Room["status"]) {
    const { createClient } = await import("@/lib/supabase/client")
    await createClient().from("rooms").update({ status }).eq("id", id)
    setRooms((p) => p.map((r) => r.id === id ? { ...r, status } : r))
  }

  async function handleTypeChange(id: string, typeId: string | null) {
    const { createClient } = await import("@/lib/supabase/client")
    await createClient().from("rooms").update({ type_id: typeId }).eq("id", id)
    const type = roomTypes.find((t) => t.id === typeId) ?? null
    setRooms((p) => p.map((r) => r.id === id ? { ...r, type_id: typeId, room_type: type ?? undefined } : r))
  }

  async function handleContractEnded(roomId: string) {
    const room = rooms.find((r) => r.id === roomId)
    const contract = (room as RoomWithDetails)?.contract
    if (!contract) return
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const { data: receipts } = await sb.from("payment_receipts").select("storage_path").eq("contract_id", contract.id)
    if (receipts?.length) {
      await sb.storage.from("receipts").remove(receipts.map((r) => r.storage_path))
      await sb.from("payment_receipts").delete().eq("contract_id", contract.id)
    }
    await sb.from("contracts").update({ status: "ended" }).eq("id", contract.id)
    // Delete auth user (frees credentials for next tenant)
    if (contract.tenant_profile_id) {
      await fetch("/api/admin/delete-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: contract.tenant_profile_id }),
      })
      await sb.from("tenant_profiles").delete().eq("id", contract.tenant_profile_id)
    }
    await sb.from("rooms").update({ status: "available" }).eq("id", roomId)
    await loadRooms()
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <p className="text-sm text-gray-400 py-8 text-center">Configura las variables de Supabase en .env.local</p>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} roomTypes={roomTypes}
          onStatusChange={handleStatusChange} onTypeChange={handleTypeChange}
          onContractCreated={loadRooms} onContractEnded={handleContractEnded} />
      ))}
    </div>
  )
}
