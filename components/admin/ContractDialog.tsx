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
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [startDate, setStartDate] = useState(today)
  const [durationMonths, setDurationMonths] = useState(6)
  const [paymentDay, setPaymentDay] = useState(new Date().getDate())
  const [waTemplate, setWaTemplate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extras al inicio del contrato
  const [extras, setExtras] = useState({
    deposit:           { on: true,  amount: 1000 },
    contract_signing:  { on: true,  amount: 150 },
    additional_person: { on: false, amount: 500 },
    parking:           { on: false, amount: 200 },
  })
  const EXTRA_LABELS: Record<keyof typeof extras, string> = {
    deposit: "Depósito (único)",
    contract_signing: "Firma de contrato (único)",
    additional_person: "Persona adicional (mensual)",
    parking: "Parqueo (mensual)",
  }
  function toggleExtra(key: keyof typeof extras) {
    setExtras((p) => ({ ...p, [key]: { ...p[key], on: !p[key].on } }))
  }
  function setExtraAmount(key: keyof typeof extras, amount: number) {
    setExtras((p) => ({ ...p, [key]: { ...p[key], amount } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const password = generatePassword()

    const start = new Date(startDate)
    const end = new Date(start)
    end.setMonth(end.getMonth() + durationMonths)
    const endDate = end.toISOString().split("T")[0]

    try {
      // Create tenant user server-side (avoids replacing admin session)
      const res = await fetch("/api/admin/create-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error ?? "No se pudo crear el usuario")
      const tenantId: string = resData.userId

      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      // 1. Create tenant profile first (contract_id set after)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileErr } = await (supabase as any).from("tenant_profiles").insert({
        id: tenantId,
        room_id: room.id,
        contract_id: null,
        name,
        phone,
      })
      if (profileErr) throw profileErr

      // 2. Create contract (tenant_profile now exists)
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

      // 3. Link contract back to profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("tenant_profiles").update({ contract_id: contractData.id }).eq("id", tenantId)

      // 4a. One-time charges (deposit, signing) → income_extras at start date
      const oneTimeTypes = ["deposit", "contract_signing"] as const
      const oneTimeRows = oneTimeTypes
        .filter((t) => extras[t].on && extras[t].amount > 0)
        .map((type) => ({ contract_id: contractData.id, room_id: room.id, type, amount: extras[type].amount, date: startDate }))
      if (oneTimeRows.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: e1 } = await (supabase as any).from("income_extras").insert(oneTimeRows)
        if (e1) throw e1
      }

      // 4b. Recurring charges (extra person, parking) → recurring_charges (billed monthly)
      const recurringTypes = ["additional_person", "parking"] as const
      const recurringRows = recurringTypes
        .filter((t) => extras[t].on && extras[t].amount > 0)
        .map((type) => ({ contract_id: contractData.id, room_id: room.id, type, amount: extras[type].amount }))
      if (recurringRows.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: e2 } = await (supabase as any).from("recurring_charges").insert(recurringRows)
        if (e2) throw e2
      }

      // Mark room occupied
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("rooms").update({ status: "occupied" }).eq("id", room.id)

      onCreated({ email, password })
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? JSON.stringify(err)
      setError(msg || "Error al crear contrato")
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                placeholder="inquilino@gmail.com"
              />
              <p className="text-xs text-gray-400 mt-1">Se usará para iniciar sesión en el portal de inquilinos.</p>
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
            {/* Extras / cobros iniciales */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Cobros al inicio del contrato
              </label>
              <div className="space-y-2">
                {(Object.keys(extras) as (keyof typeof extras)[]).map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExtra(key)}
                      className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        extras[key].on ? "bg-[#b64532] border-[#b64532]" : "bg-white border-gray-300"
                      }`}
                    >
                      {extras[key].on && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                    <span className="text-sm text-gray-700 flex-1">{EXTRA_LABELS[key]}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">Q</span>
                      <input
                        type="number" min={0} value={extras[key].amount}
                        disabled={!extras[key].on}
                        onChange={(e) => setExtraAmount(key, Number(e.target.value))}
                        className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#b64532]/40 disabled:opacity-40"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Único: se cobra una vez al iniciar. Mensual: se suma a los ingresos cada mes.
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
