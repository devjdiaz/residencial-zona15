"use client"
import { useEffect, useState } from "react"
import type { Contract, TenantProfile } from "@/lib/supabase/types"
import { logAudit } from "@/lib/audit"
import { waLink, tenantPortalUrl } from "@/lib/whatsapp"
import ContractFileManager from "./ContractFileManager"

interface Props {
  contract: Contract & { tenant_profile?: TenantProfile }
  roomIdentifier: string
  listPrice?: number | null  // precio de lista del tipo de habitación (fallback si el contrato no tiene renta propia)
  onClose: () => void
  onUpdated: () => void
}

function generatePassword(length = 12) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#"
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => chars[b % chars.length])
    .join("")
}

// Cobros únicos → income_extras (con fecha, ingreso histórico del mes de inicio)
const ONE_TIME_TYPES = ["deposit", "contract_signing"] as const
type OneTimeKey = (typeof ONE_TIME_TYPES)[number]
// Cobros mensuales → recurring_charges (se cobran cada mes mientras el contrato esté activo)
const RECURRING_TYPES = ["additional_person", "parking"] as const
type RecurringKey = (typeof RECURRING_TYPES)[number]

const ONE_TIME_LABELS: Record<OneTimeKey, string> = {
  deposit: "Depósito",
  contract_signing: "Firma de contrato",
}
const RECURRING_LABELS: Record<RecurringKey, string> = {
  additional_person: "Persona adicional",
  parking: "Parqueo",
}

// id presente = ya registrado en finanzas (no se borra al editar); id null = aún no cobrado
type OneTimeState = Record<OneTimeKey, { id: string | null; registeredDate: string | null; on: boolean; amount: number }>
type RecurringState = Record<RecurringKey, { on: boolean; amount: number }>

const DEFAULT_ONE_TIME: OneTimeState = {
  deposit:          { id: null, registeredDate: null, on: false, amount: 1000 },
  contract_signing: { id: null, registeredDate: null, on: false, amount: 150 },
}
const DEFAULT_RECURRING: RecurringState = {
  additional_person: { on: false, amount: 500 },
  parking:           { on: false, amount: 200 },
}

export default function ContractInfoDialog({ contract, roomIdentifier, listPrice, onClose, onUpdated }: Props) {
  const tenant = contract.tenant_profile
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [signedAt, setSignedAt] = useState<string | null>(contract.signed_at ?? null)
  const [togglingSigned, setTogglingSigned] = useState(false)
  const [sendingCreds, setSendingCreds] = useState(false)

  // ── Edit mode ──────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(tenant?.name ?? "")
  const [phone, setPhone] = useState(tenant?.phone ?? "")
  const [phoneAlt, setPhoneAlt] = useState(tenant?.phone_alt ?? "")
  const [email, setEmail] = useState(tenant?.email ?? "")
  const [dpi, setDpi] = useState(tenant?.dpi ?? "")
  const [startDate, setStartDate] = useState(contract.start_date)
  const [durationMonths, setDurationMonths] = useState(contract.duration_months)
  const [paymentDay, setPaymentDay] = useState(contract.payment_day)
  const [monthlyRent, setMonthlyRent] = useState(contract.monthly_rent ?? listPrice ?? 0)
  const [waTemplate, setWaTemplate] = useState(contract.whatsapp_template ?? "")
  const [oneTime, setOneTime] = useState<OneTimeState>(DEFAULT_ONE_TIME)
  const [recurring, setRecurring] = useState<RecurringState>(DEFAULT_RECURRING)

  // Precargar cobros existentes del contrato
  useEffect(() => {
    let active = true
    ;(async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const [oneTimeRes, recurringRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("income_extras").select("id, type, amount, date").eq("contract_id", contract.id).in("type", ONE_TIME_TYPES),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("recurring_charges").select("id, type, amount").eq("contract_id", contract.id).in("type", RECURRING_TYPES),
      ])
      if (!active) return
      setOneTime((prev) => {
        const next = { ...prev }
        for (const row of oneTimeRes.data ?? []) {
          const key = row.type as OneTimeKey
          if (key in next) next[key] = { id: row.id, registeredDate: row.date, on: true, amount: Number(row.amount) }
        }
        return next
      })
      setRecurring((prev) => {
        const next = { ...prev }
        for (const row of recurringRes.data ?? []) {
          const key = row.type as RecurringKey
          if (key in next) next[key] = { on: true, amount: Number(row.amount) }
        }
        return next
      })
    })()
    return () => { active = false }
  }, [contract.id])

  const startDateLabel = new Date(contract.start_date).toLocaleDateString("es-GT")
  const endDateLabel = new Date(contract.end_date).toLocaleDateString("es-GT")

  async function handleResetPassword() {
    setResetting(true)
    const pwd = generatePassword()
    try {
      const res = await fetch("/api/admin/reset-tenant-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: contract.tenant_profile_id, password: pwd }),
      })
      if (!res.ok) throw new Error("Error al resetear")
      setNewPassword(pwd)
      logAudit(`Reinició contraseña — Hab. ${roomIdentifier}${tenant?.name ? ` (${tenant.name})` : ""}`, "tenant", roomIdentifier)
    } catch {
      alert("Error al resetear la contraseña")
    } finally {
      setResetting(false)
    }
  }

  function copyCredentials() {
    if (!tenant) return
    const text = `Portal de pagos: ${tenantPortalUrl()}\nUsuario: ${tenant.email || "(sin email registrado)"}\nContraseña: ${newPassword ?? "(sin cambios)"}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function toggleSigned() {
    setTogglingSigned(true)
    const next = signedAt ? null : new Date().toISOString()
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: signedErr } = await (supabase as any).from("contracts").update({ signed_at: next }).eq("id", contract.id)
      if (signedErr) throw signedErr
      setSignedAt(next)
      logAudit(`${next ? "Marcó" : "Desmarcó"} contrato firmado — Hab. ${roomIdentifier}${tenant?.name ? ` (${tenant.name})` : ""}`, "contract", roomIdentifier)
      onUpdated()
    } catch {
      alert("Error al actualizar el estado de firma")
    } finally {
      setTogglingSigned(false)
    }
  }

  // Genera contraseña nueva (la actual no es recuperable) y abre WhatsApp con las credenciales
  async function sendCredentialsWhatsApp() {
    if (!tenant) return
    setSendingCreds(true)
    const pwd = generatePassword()
    try {
      const res = await fetch("/api/admin/reset-tenant-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: contract.tenant_profile_id, password: pwd }),
      })
      if (!res.ok) throw new Error("Error al generar la contraseña")
      setNewPassword(pwd)
      const msg = `Hola ${tenant.name}, tu contrato quedó registrado. 🏠\nEntra al portal de inquilinos para subir tus comprobantes de pago cada mes:\n${tenantPortalUrl()}\nUsuario: ${tenant.email}\nContraseña: ${pwd}`
      const link = waLink(tenant.phone, msg)
      if (link) window.open(link, "_blank")
      logAudit(`Envió credenciales por WhatsApp — Hab. ${roomIdentifier} (${tenant.name})`, "tenant", roomIdentifier)
    } catch {
      alert("Error al enviar las credenciales")
    } finally {
      setSendingCreds(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const start = new Date(startDate)
    const end = new Date(start)
    end.setMonth(end.getMonth() + durationMonths)
    const endDate = end.toISOString().split("T")[0]

    try {
      // 0. Email: actualiza la credencial de login en auth.users (y sincroniza el perfil).
      //    Va primero: si falla (email duplicado/inválido) se aborta sin guardar nada más.
      const emailChanged = email.trim() !== (tenant?.email ?? "")
      if (emailChanged) {
        const res = await fetch("/api/admin/update-tenant-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: contract.tenant_profile_id, email: email.trim() }),
        })
        const resData = await res.json()
        if (!res.ok) throw new Error(resData.error ?? "No se pudo actualizar el email")
        logAudit(`Cambió email de inquilino — Hab. ${roomIdentifier} (${name})`, "tenant", roomIdentifier)
      }

      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      // 1. Datos del inquilino (el email ya lo sincronizó la API)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileErr } = await (supabase as any).from("tenant_profiles").update({ name, phone, phone_alt: phoneAlt, dpi }).eq("id", contract.tenant_profile_id)
      if (profileErr) throw profileErr

      // 2. Datos del contrato
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: contractErr } = await (supabase as any).from("contracts").update({
        start_date: startDate,
        duration_months: durationMonths,
        end_date: endDate,
        payment_day: paymentDay,
        monthly_rent: monthlyRent,
        whatsapp_template: waTemplate || null,
      }).eq("id", contract.id)
      if (contractErr) throw contractErr

      // 3a. Cobros únicos (income_extras): NUNCA se borran ni se les cambia la fecha.
      //     Ya registrado → solo update del monto. No registrado y activado → insert con la fecha de inicio.
      for (const key of ONE_TIME_TYPES) {
        const c = oneTime[key]
        if (c.id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: e1 } = await (supabase as any).from("income_extras").update({ amount: c.amount }).eq("id", c.id)
          if (e1) throw e1
        } else if (c.on && c.amount > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: e2 } = await (supabase as any).from("income_extras").insert({ contract_id: contract.id, room_id: contract.room_id, type: key, amount: c.amount, date: startDate })
          if (e2) throw e2
        }
      }

      // 3b. Cobros mensuales (recurring_charges): on → update/insert; off → delete (deja de cobrarse a futuro)
      for (const key of RECURRING_TYPES) {
        const c = recurring[key]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase as any).from("recurring_charges").select("id").eq("contract_id", contract.id).eq("type", key)
        const rows: { id: string }[] = existing ?? []
        if (c.on && c.amount > 0) {
          if (rows.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: e3 } = await (supabase as any).from("recurring_charges").update({ amount: c.amount }).eq("id", rows[0].id)
            if (e3) throw e3
            if (rows.length > 1) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).from("recurring_charges").delete().in("id", rows.slice(1).map((r) => r.id))
            }
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: e4 } = await (supabase as any).from("recurring_charges").insert({ contract_id: contract.id, room_id: contract.room_id, type: key, amount: c.amount })
            if (e4) throw e4
          }
        } else if (rows.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: e5 } = await (supabase as any).from("recurring_charges").delete().eq("contract_id", contract.id).eq("type", key)
          if (e5) throw e5
        }
      }

      logAudit(`Editó contrato — Hab. ${roomIdentifier} (${name})`, "contract", roomIdentifier)
      onUpdated()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? JSON.stringify(err)
      setError(msg || "Error al guardar el contrato")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Contrato — Hab. {roomIdentifier}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {editing ? "Editar información del contrato" : "Información del inquilino y contrato activo"}
          </p>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del inquilino</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Nombre completo" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="inquilino@gmail.com" />
                <p className="text-xs text-gray-400 mt-1">Si lo cambias, el nuevo correo será su usuario para entrar al portal.</p>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp / Teléfono</label>
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+502 XXXX-XXXX" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono alternativo (opcional)</label>
                <input value={phoneAlt} onChange={(e) => setPhoneAlt(e.target.value)} className={inputCls} placeholder="+502 XXXX-XXXX" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">DPI</label>
                <input value={dpi} onChange={(e) => setDpi(e.target.value)} className={inputCls} placeholder="0000 00000 0000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de inicio</label>
                <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duración (meses)</label>
                <input type="number" min={1} max={24} required value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Día de corte de pago (día del mes)</label>
                <input type="number" min={1} max={31} required value={paymentDay} onChange={(e) => setPaymentDay(Number(e.target.value))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Renta mensual (Q)</label>
                <input type="number" min={0} required value={monthlyRent} onChange={(e) => setMonthlyRent(Number(e.target.value))} className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">
                  Lo que paga este inquilino{listPrice ? ` (precio de lista: Q${listPrice.toLocaleString()})` : ""}. Finanzas y el portal del inquilino usan este monto.
                </p>
              </div>

              {/* Cobros mensuales (recurrentes) */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-2">Cobros mensuales</label>
                <div className="space-y-2">
                  {RECURRING_TYPES.map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRecurring((p) => ({ ...p, [key]: { ...p[key], on: !p[key].on } }))}
                        className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                          recurring[key].on ? "bg-[#b64532] border-[#b64532]" : "bg-white border-gray-300"
                        }`}
                      >
                        {recurring[key].on && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                      <span className="text-sm text-gray-700 flex-1">{RECURRING_LABELS[key]}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">Q</span>
                        <input
                          type="number" min={0} value={recurring[key].amount}
                          disabled={!recurring[key].on}
                          onChange={(e) => setRecurring((p) => ({ ...p, [key]: { ...p[key], amount: Number(e.target.value) } }))}
                          className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#b64532]/40 disabled:opacity-40"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Se suman a los ingresos cada mes mientras el contrato esté activo.</p>
              </div>

              {/* Cobros iniciales (únicos) */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-2">Cobros iniciales (únicos)</label>
                <div className="space-y-2">
                  {ONE_TIME_TYPES.map((key) => {
                    const c = oneTime[key]
                    const registered = c.id !== null
                    return (
                      <div key={key} className="flex items-center gap-2">
                        {registered ? (
                          <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center bg-green-100 text-green-600" title="Ya registrado en finanzas">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setOneTime((p) => ({ ...p, [key]: { ...p[key], on: !p[key].on } }))}
                            className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                              c.on ? "bg-[#b64532] border-[#b64532]" : "bg-white border-gray-300"
                            }`}
                          >
                            {c.on && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                        )}
                        <span className="text-sm text-gray-700 flex-1">
                          {registered ? ONE_TIME_LABELS[key] : `Agregar ${ONE_TIME_LABELS[key].toLowerCase()}`}
                          {registered && c.registeredDate && (
                            <span className="block text-[11px] text-gray-400">registrado el {new Date(c.registeredDate).toLocaleDateString("es-GT")}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">Q</span>
                          <input
                            type="number" min={0} value={c.amount}
                            disabled={!registered && !c.on}
                            onChange={(e) => setOneTime((p) => ({ ...p, [key]: { ...p[key], amount: Number(e.target.value) } }))}
                            className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#b64532]/40 disabled:opacity-40"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Ya registrados en finanzas el mes de inicio; corrige el monto solo si se tecleó mal. Los nuevos se registran con la fecha de inicio.
                </p>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Mensaje de recordatorio WhatsApp (opcional)</label>
                <textarea
                  rows={3} value={waTemplate} onChange={(e) => setWaTemplate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40 resize-none"
                  placeholder="Hola [nombre], tu pago vence el día [día]…"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => { setEditing(false); setError(null) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors disabled:opacity-60">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Tenant info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Nombre</span>
                <span className="font-medium text-gray-900">{tenant?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900 break-all text-right">{tenant?.email || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Teléfono</span>
                <span className="font-medium text-gray-900">{tenant?.phone ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Teléfono alt.</span>
                <span className="font-medium text-gray-900">{tenant?.phone_alt || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">DPI</span>
                <span className="font-medium text-gray-900">{tenant?.dpi || "—"}</span>
              </div>
            </div>

            {/* Contract info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Renta mensual</span>
                <span className="font-medium text-gray-900">
                  {(contract.monthly_rent ?? listPrice) != null ? `Q${Number(contract.monthly_rent ?? listPrice).toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Inicio</span>
                <span className="font-medium text-gray-900">{startDateLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Vence</span>
                <span className="font-medium text-gray-900">{endDateLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duración</span>
                <span className="font-medium text-gray-900">{contract.duration_months} meses</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Día de pago</span>
                <span className="font-medium text-gray-900">Día {contract.payment_day}</span>
              </div>
            </div>

            {/* Contrato firmado + envío de credenciales */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
              <button
                onClick={toggleSigned}
                disabled={togglingSigned}
                className="flex items-center gap-2 w-full text-left disabled:opacity-60"
              >
                <span className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  signedAt ? "bg-green-600 border-green-600" : "bg-white border-gray-300"
                }`}>
                  {signedAt && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="text-gray-700 flex-1">
                  Contrato firmado recibido
                  {signedAt && (
                    <span className="block text-[11px] text-gray-400">
                      recibido el {new Date(signedAt).toLocaleDateString("es-GT")}
                    </span>
                  )}
                </span>
              </button>
              {signedAt && (
                <div>
                  <button
                    onClick={sendCredentialsWhatsApp}
                    disabled={sendingCreds || !tenant || !tenant.phone.replace(/\D/g, "")}
                    className="w-full py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingCreds ? "Generando…" : "📲 Enviar credenciales por WhatsApp"}
                  </button>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {tenant?.phone.replace(/\D/g, "")
                      ? "Genera una contraseña nueva y abre WhatsApp con los datos de acceso al portal."
                      : "El inquilino no tiene teléfono — usa \"Generar nueva contraseña\" y copia las credenciales."}
                  </p>
                </div>
              )}
            </div>

            {/* Archivo del contrato firmado (bucket 'contracts') */}
            <ContractFileManager
              contractId={contract.id}
              roomIdentifier={roomIdentifier}
              filePath={contract.contract_file_path ?? null}
              onUpdated={onUpdated}
            />

            {/* Reset password */}
            {newPassword ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-1">
                <p className="text-green-700 font-medium text-xs uppercase tracking-wide">Nueva contraseña generada</p>
                <p className="font-mono font-bold text-gray-900 text-base">{newPassword}</p>
                <p className="text-xs text-gray-400">Compártela con el inquilino — no se mostrará de nuevo.</p>
              </div>
            ) : (
              <button
                onClick={handleResetPassword}
                disabled={resetting}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                {resetting ? "Generando…" : "🔑 Generar nueva contraseña"}
              </button>
            )}

            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cerrar
              </button>
              {newPassword ? (
                <button onClick={copyCredentials}
                  className="flex-1 py-2.5 rounded-xl bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors">
                  {copied ? "¡Copiado!" : "Copiar todo"}
                </button>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="flex-1 py-2.5 rounded-xl bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors">
                  Editar
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
