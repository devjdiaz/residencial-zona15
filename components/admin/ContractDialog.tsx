"use client"
import { useState } from "react"
import type { Room } from "@/lib/supabase/types"

interface Props {
  room: Room & { room_type?: { label: string; price: number } }
  onClose: () => void
  onCreated: (credentials: { email: string; password: string }) => void
}

function generatePassword(length = 12) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#"
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => chars[b % chars.length])
    .join("")
}

export default function ContractDialog({ room, onClose, onCreated }: Props) {
  const today = new Date().toISOString().split("T")[0]
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [startDate, setStartDate] = useState(today)
  const [durationMonths, setDurationMonths] = useState(6)
  const [paymentDay, setPaymentDay] = useState(new Date().getDate())
  const [waTemplate, setWaTemplate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const email = `hab${room.identifier.toLowerCase()}-${Date.now()}@residencial.local`
    const password = generatePassword()

    const start = new Date(startDate)
    const end = new Date(start)
    end.setMonth(end.getMonth() + durationMonths)
    const endDate = end.toISOString().split("T")[0]

    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      // Create tenant auth user via admin API (requires service key — fallback: just save profile)
      // For now we save the profile and show credentials to admin
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: "tenant" } },
      })
      if (authErr) throw authErr

      const tenantId = authData.user?.id
      if (!tenantId) throw new Error("No se pudo crear el usuario")

      // Create contract first (tenant_profile_id will be updated after)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: contractData, error: contractErr } = await (supabase as any)
        .from("contracts")
        .insert({
          room_id: room.id,
          tenant_profile_id: tenantId,
          start_date: startDate,
          duration_months: durationMonths,
          end_date: endDate,
          payment_day: paymentDay,
          whatsapp_template: waTemplate || null,
          status: "active",
        })
        .select()
        .single()
      if (contractErr) throw contractErr

      // Create tenant profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileErr } = await (supabase as any).from("tenant_profiles").insert({
        id: tenantId,
        room_id: room.id,
        contract_id: contractData.id,
        name,
        phone,
      })
      if (profileErr) throw profileErr

      // Mark room occupied
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("rooms").update({ status: "occupied" }).eq("id", room.id)

      onCreated({ email, password })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear contrato")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Nuevo contrato — Hab. {room.identifier}
          </h2>
          {room.room_type && (
            <p className="text-sm text-gray-500">{room.room_type.label} · Q{room.room_type.price.toLocaleString()}/mes</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del inquilino</label>
              <input
                required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                placeholder="Nombre completo"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp / Teléfono</label>
              <input
                required value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                placeholder="+502 XXXX-XXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de inicio</label>
              <input
                type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duración (meses)</label>
              <input
                type="number" min={1} max={24} required value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Día de corte de pago (día del mes)
              </label>
              <input
                type="number" min={1} max={31} required value={paymentDay}
                onChange={(e) => setPaymentDay(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
              />
              <p className="text-xs text-gray-400 mt-1">
                Ej: si firmó el 5, el pago vence cada mes el día 5.
              </p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Mensaje de recordatorio WhatsApp (opcional)
              </label>
              <textarea
                rows={3} value={waTemplate}
                onChange={(e) => setWaTemplate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40 resize-none"
                placeholder="Hola [nombre], tu pago vence el día [día]…"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors disabled:opacity-60">
              {loading ? "Creando…" : "Crear contrato"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
