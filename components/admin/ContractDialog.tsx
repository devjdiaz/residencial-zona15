"use client"
import { useState } from "react"
import type { Room } from "@/lib/supabase/types"
import { logAudit } from "@/lib/audit"

interface Props {
  room: Room & { room_type?: { label: string } }
  onClose: () => void
  onCreated: (credentials: { email: string; password: string; name: string; phone: string; contractId: string }) => void
}

// Suma meses a una fecha 'YYYY-MM-DD' sin salirse del mes (31 ene + 1 mes = 28/29 feb).
function addMonths(isoDate: string, months: number) {
  const [y, m, d] = isoDate.split("-").map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, lastDay))
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`
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
  const [phoneAlt, setPhoneAlt] = useState("")
  const [dpi, setDpi] = useState("")
  const [startDate, setStartDate] = useState(today)
  const [durationMonths, setDurationMonths] = useState(6)
  // Fecha de fin explícita. Se autocalcula (inicio + duración) mientras la admin no
  // la edite a mano; en cuanto la toca, manda ella. Esto permite registrar inquilinos
  // antiguos (inicio histórico) sin que el contrato quede vencido.
  const [endDate, setEndDate] = useState(() => addMonths(today, 6))
  const [endDateTouched, setEndDateTouched] = useState(false)
  const [monthlyRent, setMonthlyRent] = useState(room.price ?? 0)
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

  // Datos de la persona adicional (solo si extras.additional_person.on) — sin email,
  // nunca tiene cuenta de login; se guardan en contracts, no en tenant_profiles.
  const [addPerson, setAddPerson] = useState({ name: "", dpi: "", phone: "", phoneAlt: "" })

  // Datos del vehículo (solo si extras.parking.on) — se guardan en contracts.
  const [vehicle, setVehicle] = useState({ type: "", brand: "", line: "", color: "", plate: "" })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (extras.additional_person.on) {
      if (!addPerson.name.trim() || !addPerson.dpi.trim() || !addPerson.phone.trim()) {
        setError("Completa nombre, DPI y teléfono de la persona adicional, o desmarca la casilla.")
        setLoading(false)
        return
      }
    }

    if (extras.parking.on) {
      if (!vehicle.type || !vehicle.brand.trim() || !vehicle.line.trim() || !vehicle.color.trim() || !vehicle.plate.trim()) {
        setError("Completa tipo, marca, línea, color y placa del vehículo, o desmarca la casilla de parqueo.")
        setLoading(false)
        return
      }
    }

    if (endDate < startDate) {
      setError("La fecha de fin no puede ser anterior a la fecha de inicio.")
      setLoading(false)
      return
    }

    const password = generatePassword()

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
        phone_alt: phoneAlt,
        email,
        dpi,
      })
      if (profileErr) throw profileErr

      // 2. Cerrar cualquier contrato activo previo de esta habitación para que
      //    nunca queden dos activos a la vez (causaba comprobantes "invisibles").
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: previousContracts } = await (supabase as any).from("contracts")
        .select("id, tenant_profile_id")
        .eq("room_id", room.id)
        .eq("status", "active")

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("contracts")
        .update({ status: "ended" })
        .eq("room_id", room.id)
        .eq("status", "active")

      // 2b. Bloquear el login del inquilino saliente (no se borra: conserva su
      // historial/recibos, pero evita que quede una cuenta huérfana con acceso
      // vigente — causaba reportes de "no puedo subir comprobante" con la cuenta vieja).
      for (const prev of (previousContracts ?? []) as { id: string; tenant_profile_id: string }[]) {
        if (prev.tenant_profile_id === tenantId) continue
        await fetch("/api/admin/ban-tenant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: prev.tenant_profile_id }),
        })
      }

      // 3. Create contract (tenant_profile now exists)
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
          monthly_rent: monthlyRent,
          whatsapp_template: waTemplate || null,
          status: "active",
          has_additional_person: extras.additional_person.on,
          additional_person_name: extras.additional_person.on ? addPerson.name.trim() : "",
          additional_person_dpi: extras.additional_person.on ? addPerson.dpi.trim() : "",
          additional_person_phone: extras.additional_person.on ? addPerson.phone.trim() : "",
          additional_person_phone_alt: extras.additional_person.on ? addPerson.phoneAlt.trim() : "",
          has_parking: extras.parking.on,
          parking_vehicle_type: extras.parking.on ? vehicle.type : "",
          parking_vehicle_brand: extras.parking.on ? vehicle.brand.trim() : "",
          parking_vehicle_line: extras.parking.on ? vehicle.line.trim() : "",
          parking_vehicle_color: extras.parking.on ? vehicle.color.trim() : "",
          parking_vehicle_plate: extras.parking.on ? vehicle.plate.trim() : "",
        })
        .select()
        .single()
      if (contractErr) throw contractErr

      // 4. Link contract back to profile
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

      logAudit(`Creó contrato — Hab. ${room.identifier} (${name})`, "contract", room.identifier)
      onCreated({ email, password, name, phone, contractId: contractData.id })
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
          {(room.room_type?.label || room.price != null) && (
            <p className="text-sm text-gray-500">
              {room.room_type?.label}
              {room.room_type?.label && room.price != null ? " · " : ""}
              {room.price != null ? `Q${room.price.toLocaleString()}/mes` : ""}
            </p>
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
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono alternativo (opcional)</label>
              <input
                value={phoneAlt} onChange={(e) => setPhoneAlt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                placeholder="+502 XXXX-XXXX"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">DPI</label>
              <input
                value={dpi} onChange={(e) => setDpi(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                placeholder="0000 00000 0000"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Renta mensual (Q)</label>
              <input
                type="number" min={0} required value={monthlyRent}
                onChange={(e) => setMonthlyRent(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
              />
              <p className="text-xs text-gray-400 mt-1">
                Prellenado con el precio de la habitación{room.price != null ? ` (Q${room.price.toLocaleString()})` : ""} — ajústalo si este inquilino paga diferente.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de inicio</label>
              <input
                type="date" required value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (!endDateTouched && e.target.value) setEndDate(addMonths(e.target.value, durationMonths))
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
              />
              <p className="text-xs text-gray-400 mt-1">
                Desde cuándo vive aquí el inquilino. Puede ser anterior al sistema.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de fin</label>
              <input
                type="date" required value={endDate}
                min={startDate}
                onChange={(e) => { setEndDate(e.target.value); setEndDateTouched(true) }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
              />
              <p className="text-xs text-gray-400 mt-1">
                Hasta cuándo vence el contrato en curso. Define hasta qué mes puede pagar el inquilino.
              </p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Duración del contrato en curso (meses)</label>
              <input
                type="number" min={1} max={120} required value={durationMonths}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setDurationMonths(n)
                  if (!endDateTouched && startDate && n > 0) setEndDate(addMonths(startDate, n))
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
              />
              <p className="text-xs text-gray-400 mt-1">
                Plazo del contrato vigente. Cuenta hacia atrás desde la fecha de fin para saber
                qué meses puede pagar el inquilino en su portal.
                {!endDateTouched && " Mientras no edites la fecha de fin, se recalcula sola."}
              </p>
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

            {extras.additional_person.on && (
              <div className="col-span-2 bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                <p className="text-xs font-medium text-gray-600">Datos de la persona adicional</p>
                <input
                  required value={addPerson.name}
                  onChange={(e) => setAddPerson((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                  placeholder="Nombre completo"
                />
                <input
                  required value={addPerson.dpi}
                  onChange={(e) => setAddPerson((p) => ({ ...p, dpi: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                  placeholder="DPI"
                />
                <input
                  required value={addPerson.phone}
                  onChange={(e) => setAddPerson((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                  placeholder="Teléfono"
                />
                <input
                  value={addPerson.phoneAlt}
                  onChange={(e) => setAddPerson((p) => ({ ...p, phoneAlt: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                  placeholder="Teléfono alternativo (opcional)"
                />
                <p className="text-xs text-gray-400">Esta persona no tendrá acceso al portal ni credenciales propias.</p>
              </div>
            )}

            {extras.parking.on && (
              <div className="col-span-2 bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                <p className="text-xs font-medium text-gray-600">Datos del vehículo</p>
                <select
                  required value={vehicle.type}
                  onChange={(e) => setVehicle((p) => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                >
                  <option value="">Tipo de vehículo…</option>
                  <option value="moto">Moto</option>
                  <option value="carro">Carro</option>
                </select>
                <input
                  required value={vehicle.brand}
                  onChange={(e) => setVehicle((p) => ({ ...p, brand: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                  placeholder="Marca"
                />
                <input
                  required value={vehicle.line}
                  onChange={(e) => setVehicle((p) => ({ ...p, line: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                  placeholder="Línea"
                />
                <input
                  required value={vehicle.color}
                  onChange={(e) => setVehicle((p) => ({ ...p, color: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                  placeholder="Color"
                />
                <input
                  required value={vehicle.plate}
                  onChange={(e) => setVehicle((p) => ({ ...p, plate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                  placeholder="Placa"
                />
              </div>
            )}

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
