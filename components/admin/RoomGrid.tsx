"use client"
import { useEffect, useRef, useState } from "react"
import type { Room, Contract, TenantProfile, RoomType } from "@/lib/supabase/types"
import ContractDialog from "./ContractDialog"
import CredentialsDialog from "./CredentialsDialog"

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
  const [showCredentials, setShowCredentials] = useState(false)
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
            <button onClick={async () => {
              if (!confirm(`¿Terminar contrato de ${tenant?.name}?`)) return
              await onContractEnded(room.id)
            }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
              Terminar
            </button>
          )}
        </div>

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

      {showContract && (
        <ContractDialog room={{ ...room, room_type: room.room_type ?? undefined }}
          onClose={() => setShowContract(false)}
          onCreated={(creds) => { setShowContract(false); setNewCredentials(creds); setShowCredentials(true); onContractCreated() }} />
      )}
      {showCredentials && newCredentials && (
        <CredentialsDialog credentials={newCredentials} roomIdentifier={room.identifier}
          onClose={() => { setShowCredentials(false); setNewCredentials(null) }} />
      )}
    </>
  )
}

// ─── Photo Manager ────────────────────────────────────────────────────────────

interface PhotoRecord { id: string; storage_path: string; display_order: number }

function PhotoManager({ roomTypes }: { roomTypes: RoomType[] }) {
  const [activeType, setActiveType] = useState<string>("")
  const [photos, setPhotos] = useState<PhotoRecord[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (roomTypes.length && !activeType) setActiveType(roomTypes[0].id)
  }, [roomTypes, activeType])

  useEffect(() => {
    if (!activeType) return
    async function load() {
      const { createClient } = await import("@/lib/supabase/client")
      const sb = createClient()
      const { data } = await sb.from("room_photos").select("*").eq("room_type_id", activeType).order("display_order")
      setPhotos((data as PhotoRecord[]) ?? [])
    }
    load()
  }, [activeType])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true); setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const sb = createClient()
      let order = photos.length
      for (const file of files) {
        const path = `${activeType}/${Date.now()}-${file.name}`
        const { error: uploadErr } = await sb.storage.from("room-photos").upload(path, file, { upsert: false })
        if (uploadErr) throw uploadErr
        const { data } = await sb.from("room_photos").insert({ room_type_id: activeType, storage_path: path, display_order: order++ }).select().single()
        if (data) setPhotos((p) => [...p, data as PhotoRecord])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al subir")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleDelete(photo: PhotoRecord) {
    if (!confirm("¿Borrar esta foto?")) return
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    await sb.storage.from("room-photos").remove([photo.storage_path])
    await sb.from("room_photos").delete().eq("id", photo.id)
    setPhotos((p) => p.filter((x) => x.id !== photo.id))
  }

  function photoUrl(path: string) {
    return `https://murcjxwahkgwaauibgsu.supabase.co/storage/v1/object/public/room-photos/${path}`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="font-medium text-gray-900 text-sm">Fotos por tipo de habitación</h3>
        <div className="flex gap-1 bg-gray-50 border border-gray-100 rounded-xl p-1">
          {roomTypes.map((t) => (
            <button key={t.id} onClick={() => setActiveType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${t.id === activeType ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {t.label.replace("Habitación ", "").replace("Loft de ", "Loft ")}
            </button>
          ))}
        </div>
      </div>

      {/* Upload */}
      <div className="mb-4">
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-4 py-2 rounded-lg bg-[#b64532] text-white text-xs font-medium hover:bg-[#9a3727] transition-colors disabled:opacity-60">
          {uploading ? "Subiendo…" : "＋ Agregar fotos"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        <p className="text-xs text-gray-400 mt-1">
          Estas fotos se muestran en el carrusel del sitio público.
          {photos.length === 0 && " Sin fotos aún — el sitio usa las fotos locales por defecto."}
        </p>
      </div>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {photos.map((p, i) => (
            <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(p.storage_path)} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              <button onClick={() => handleDelete(p)}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
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

    // Load room types
    const { data: types } = await sb.from("room_types").select("*").order("price")
    setRoomTypes((types as RoomType[]) ?? [])

    // Load all rooms for this property
    const { data: allRooms } = await sb
      .from("rooms").select("*, room_type:room_types(*)").eq("property_id", propertyId).order("sort_order")

    // Load active contracts
    const roomIds = (allRooms ?? []).map((r) => r.id)
    const { data: contracts } = await sb
      .from("contracts").select("*, tenant_profile:tenant_profiles(*)")
      .in("room_id", roomIds).eq("status", "active")

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
    if (contract.tenant_profile_id) await sb.from("tenant_profiles").delete().eq("id", contract.tenant_profile_id)
    await sb.from("rooms").update({ status: "available" }).eq("id", roomId)
    await loadRooms()
  }

  if (loading) {
    return (
      <>
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </>
    )
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <p className="text-sm text-gray-400 py-8 text-center">Configura las variables de Supabase en .env.local</p>
  }

  return (
    <>
      <PhotoManager roomTypes={roomTypes} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} roomTypes={roomTypes}
            onStatusChange={handleStatusChange} onTypeChange={handleTypeChange}
            onContractCreated={loadRooms} onContractEnded={handleContractEnded} />
        ))}
      </div>
    </>
  )
}
