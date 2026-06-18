"use client"
import { useEffect, useState } from "react"
import type { Contract, Expense, IncomeExtra, TenantProfile } from "@/lib/supabase/types"
import { logAudit } from "@/lib/audit"

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const INCOME_LABELS: Record<string, string> = {
  additional_person: "Persona adicional",
  parking: "Parqueo",
  contract_signing: "Firma de contrato",
  deposit: "Depósito",
}

const EXPENSE_LABELS: Record<string, string> = {
  guardian_salary: "Sueldo guardián (compartido ÷2)",
  commission: "Comisión propietaria",
  internet: "Internet",
  iusi: "IUSI (trimestral)",
  electricity: "Luz",
  water: "Agua",
}

interface Summary {
  cobrado: number
  porCobrar: number
  variableIncome: number
  fixedExpenses: number
  variableExpenses: number
  commissions: number
}

export default function FinancesPanel() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [propertyId, setPropertyId] = useState<string>("")
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomeExtras, setIncomeExtras] = useState<IncomeExtra[]>([])
  const [recurringCharges, setRecurringCharges] = useState<{ id: string; type: string; amount: number; room_id: string; contract_id: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [contracts, setContracts] = useState<(Contract & { room: { identifier: string; room_type?: { price: number } }; tenant_profile: TenantProfile })[]>([])
  const [monthlyPayments, setMonthlyPayments] = useState<{ contract_id: string; amount: number; source: string }[]>([])

  const [addExpense, setAddExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({ category: "electricity", amount: "", notes: "" })
  const [addIncome, setAddIncome] = useState(false)
  const [newIncome, setNewIncome] = useState({ type: "additional_person", amount: "", contractId: "", notes: "" })
  const [addMonthlyIncome, setAddMonthlyIncome] = useState(false)
  const [newMonthlyIncome, setNewMonthlyIncome] = useState({ contractId: "", amount: "", notes: "" })
  const [monthlyIncomeConflict, setMonthlyIncomeConflict] = useState<string | null>(null)

  const period = `${year}-${String(month + 1).padStart(2, "0")}`
  const notConfigured = !process.env.NEXT_PUBLIC_SUPABASE_URL

  useEffect(() => {
    if (notConfigured) return
    async function loadProps() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("properties").select("id, name").order("name")
      setProperties(data ?? [])
      setPropertyId(data?.[0]?.id ?? "")
    }
    loadProps()
  }, [notConfigured])

  useEffect(() => {
    if (!propertyId || notConfigured) return
    setLoading(true)
    async function load() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data: propertyRooms } = await supabase
        .from("rooms")
        .select("id")
        .eq("property_id", propertyId)
      const propertyRoomIds = (propertyRooms ?? []).map((r) => r.id)

      const { data: contractsData } = await supabase
        .from("contracts")
        .select("*, tenant_profile:tenant_profiles!contracts_tenant_profile_id_fkey(*), room:rooms(identifier, property_id, room_type:room_types(price))")
        .in("room_id", propertyRoomIds.length ? propertyRoomIds : ["none"])
        .eq("status", "active") as { data: (Contract & { room: { identifier: string; room_type?: { price: number } }; tenant_profile: TenantProfile })[] | null }

      setContracts(contractsData ?? [])
      const activeContractIds = (contractsData ?? []).map((c) => c.id)

      const { data: recurring } = await supabase
        .from("recurring_charges")
        .select("id, type, amount, room_id, contract_id")
        .in("contract_id", activeContractIds.length ? activeContractIds : ["none"])
      setRecurringCharges(recurring ?? [])

      const { data: extras } = await supabase
        .from("income_extras")
        .select("*")
        .in("room_id", (contractsData ?? []).map((c) => c.room_id))
        .like("date", `${period}%`)
      setIncomeExtras(extras ?? [])
      const variableIncome = (extras ?? []).reduce((sum, e) => sum + e.amount, 0)

      const { data: exp } = await supabase
        .from("expenses")
        .select("*")
        .or(`property_id.eq.${propertyId},property_id.is.null`)
        .eq("period", period)
      setExpenses(exp ?? [])

      // Ingresos reales confirmados este período
      const { data: payments } = await supabase
        .from("monthly_payments")
        .select("contract_id, amount, source")
        .in("contract_id", activeContractIds.length ? activeContractIds : ["none"])
        .eq("period_month", period)
      setMonthlyPayments(payments ?? [])

      const cobrado = (payments ?? []).reduce((sum, p) => sum + p.amount, 0)

      const paidIds = new Set((payments ?? []).map((p) => p.contract_id))
      const porCobrar = (contractsData ?? []).reduce((sum, c) => {
        if (paidIds.has(c.id)) return sum
        const base = c.monthly_rent ?? c.room?.room_type?.price ?? 0
        const rc = (recurring ?? []).filter((r) => r.contract_id === c.id).reduce((s, r) => s + r.amount, 0)
        return sum + base + rc
      }, 0)

      const fixedExpenses = (exp ?? []).filter((e) => e.type === "fixed").reduce((sum, e) => sum + (e.property_id ? e.amount : e.amount / 2), 0)
      const variableExpenses = (exp ?? []).filter((e) => e.type === "variable").reduce((sum, e) => sum + e.amount, 0)
      const commissions = (exp ?? []).filter((e) => e.category === "commission").reduce((sum, e) => sum + e.amount, 0)

      setSummary({ cobrado, porCobrar, variableIncome, fixedExpenses, variableExpenses, commissions })
      setLoading(false)
    }
    load()
  }, [propertyId, period, notConfigured])

  async function saveExpense() {
    if (!newExpense.amount) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const isShared = newExpense.category === "guardian_salary"
    await supabase.from("expenses").insert({
      property_id: isShared ? null : propertyId,
      category: newExpense.category as Expense["category"],
      type: newExpense.category === "electricity" || newExpense.category === "water" ? "variable" : "fixed",
      amount: Number(newExpense.amount),
      period,
      notes: newExpense.notes || null,
    })
    logAudit(`Agregó egreso — ${EXPENSE_LABELS[newExpense.category] ?? newExpense.category} Q${Number(newExpense.amount).toLocaleString()}`, "expense")
    setAddExpense(false)
    setNewExpense({ category: "electricity", amount: "", notes: "" })
  }

  async function saveIncome() {
    if (!newIncome.amount || !newIncome.contractId) return
    const contract = contracts.find((c) => c.id === newIncome.contractId)
    if (!contract) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("income_extras").insert({
      contract_id: newIncome.contractId,
      room_id: contract.room_id,
      type: newIncome.type as IncomeExtra["type"],
      amount: Number(newIncome.amount),
      date: new Date().toISOString().split("T")[0],
      notes: newIncome.notes || null,
    })
    logAudit(`Agregó ingreso extra — ${INCOME_LABELS[newIncome.type] ?? newIncome.type} Q${Number(newIncome.amount).toLocaleString()} (Hab. ${contract.room?.identifier ?? ""})`, "income")
    setAddIncome(false)
    setNewIncome({ type: "additional_person", amount: "", contractId: "", notes: "" })
  }

  async function saveMonthlyIncome() {
    if (!newMonthlyIncome.amount || !newMonthlyIncome.contractId) return
    const contract = contracts.find((c) => c.id === newMonthlyIncome.contractId)
    if (!contract) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Si ya hay un pago por comprobante aprobado, advertir antes de sobrescribir
    const existing = monthlyPayments.find((p) => p.contract_id === newMonthlyIncome.contractId)
    if (existing && !monthlyIncomeConflict) {
      const { data: existingFull } = await supabase
        .from("monthly_payments")
        .select("source")
        .eq("contract_id", newMonthlyIncome.contractId)
        .eq("period_month", period)
        .single()
      if (existingFull?.source === "receipt") {
        setMonthlyIncomeConflict(
          "Ya existe un ingreso aprobado por comprobante para este período. Haz clic en Guardar nuevamente para sobrescribirlo."
        )
        return
      }
    }

    const amount = Number(newMonthlyIncome.amount)
    const { error } = await supabase.from("monthly_payments").upsert({
      contract_id: newMonthlyIncome.contractId,
      room_id: contract.room_id,
      period_month: period,
      amount,
      source: "manual",
      receipt_id: null,
      registered_by: user?.id ?? null,
      notes: newMonthlyIncome.notes || null,
    }, { onConflict: "contract_id,period_month" })

    if (error) { alert("Error al registrar el ingreso"); return }

    logAudit(
      `Registró ingreso manual — Hab. ${contract.room?.identifier} · ${period} · Q${amount.toLocaleString()}`,
      "monthly_payment", contract.room?.identifier
    )

    const wasUnpaid = !existing
    setMonthlyPayments((prev) => [
      ...prev.filter((p) => p.contract_id !== newMonthlyIncome.contractId),
      { contract_id: newMonthlyIncome.contractId, amount, source: "manual" },
    ])
    setSummary((prev) => {
      if (!prev) return prev
      const delta = wasUnpaid ? amount : amount - (existing?.amount ?? 0)
      const base = contract.monthly_rent ?? contract.room?.room_type?.price ?? 0
      const rc = recurringCharges.filter((r) => r.contract_id === newMonthlyIncome.contractId).reduce((s, r) => s + r.amount, 0)
      return {
        ...prev,
        cobrado: prev.cobrado + delta,
        porCobrar: wasUnpaid ? Math.max(0, prev.porCobrar - (base + rc)) : prev.porCobrar,
      }
    })

    setAddMonthlyIncome(false)
    setMonthlyIncomeConflict(null)
    setNewMonthlyIncome({ contractId: "", amount: "", notes: "" })
  }

  const totalIncome = (summary?.cobrado ?? 0) + (summary?.variableIncome ?? 0)
  const totalExpenses = (summary?.fixedExpenses ?? 0) + (summary?.variableExpenses ?? 0)
  const net = totalIncome - totalExpenses

  if (notConfigured) {
    return <p className="text-sm text-gray-400 py-8 text-center">Configura Supabase para ver las finanzas.</p>
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none">
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none">
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none">
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : summary && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Cobrado",            value: summary.cobrado,        color: "text-green-700" },
              { label: "Por cobrar",         value: summary.porCobrar,      color: "text-amber-600" },
              { label: "Ingresos variables", value: summary.variableIncome, color: "text-green-600" },
              { label: "Total egresos",      value: totalExpenses,          color: "text-red-600" },
              { label: "Neto del mes",       value: net,                    color: net >= 0 ? "text-blue-700" : "text-red-700" },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-xl sm:text-2xl font-semibold mt-1 ${k.color}`}>Q{k.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Estado de cobros por contrato + ingreso manual */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 text-sm">
                Estado de cobros — {MONTHS[month]} {year}
              </h3>
              <button
                onClick={() => { setAddMonthlyIncome(!addMonthlyIncome); setMonthlyIncomeConflict(null) }}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#24577a] text-white hover:bg-[#1d4563] transition-colors"
              >
                + Registrar ingreso manual
              </button>
            </div>

            {/* Formulario ingreso manual */}
            {addMonthlyIncome && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
                {monthlyIncomeConflict && (
                  <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">{monthlyIncomeConflict}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Habitación</label>
                    <select
                      value={newMonthlyIncome.contractId}
                      onChange={(e) => {
                        const c = contracts.find((c) => c.id === e.target.value)
                        const base = c ? (c.monthly_rent ?? c.room?.room_type?.price ?? 0) : 0
                        const rc = recurringCharges
                          .filter((r) => r.contract_id === e.target.value)
                          .reduce((s, r) => s + r.amount, 0)
                        setNewMonthlyIncome((p) => ({ ...p, contractId: e.target.value, amount: String(base + rc) }))
                        setMonthlyIncomeConflict(null)
                      }}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      <option value="">— Seleccionar —</option>
                      {contracts.map((c) => (
                        <option key={c.id} value={c.id}>
                          Hab. {c.room?.identifier} · {c.tenant_profile?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Monto (Q)</label>
                    <input
                      type="number"
                      value={newMonthlyIncome.amount}
                      onChange={(e) => setNewMonthlyIncome((p) => ({ ...p, amount: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Notas (opcional)</label>
                    <input
                      type="text"
                      value={newMonthlyIncome.notes}
                      onChange={(e) => setNewMonthlyIncome((p) => ({ ...p, notes: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                      placeholder="Ej: efectivo, transferencia #1234"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveMonthlyIncome}
                    className="px-4 py-1.5 rounded-lg bg-[#24577a] text-white text-xs font-medium hover:bg-[#1d4563]"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => { setAddMonthlyIncome(false); setMonthlyIncomeConflict(null) }}
                    className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Tabla estado por contrato */}
            <div className="divide-y divide-gray-50">
              {contracts.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">Sin contratos activos este mes</p>
              ) : contracts.map((c) => {
                const payment = monthlyPayments.find((p) => p.contract_id === c.id)
                const base = c.monthly_rent ?? c.room?.room_type?.price ?? 0
                const rc = recurringCharges.filter((r) => r.contract_id === c.id).reduce((s, r) => s + r.amount, 0)
                const expected = base + rc
                return (
                  <div key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-sm font-medium text-gray-800">Hab. {c.room?.identifier}</span>
                      <span className="text-xs text-gray-400 ml-2">{c.tenant_profile?.name}</span>
                      {payment && (
                        <span className="text-xs text-gray-400 ml-2">
                          · {payment.source === "receipt" ? "comprobante" : "manual"}
                        </span>
                      )}
                    </div>
                    {payment ? (
                      <span className="text-xs font-medium text-green-700 flex-shrink-0">
                        ✓ Q{payment.amount.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 flex-shrink-0">
                        Pendiente Q{expected.toLocaleString()}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cargos recurrentes (informativos) */}
          {recurringCharges.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-medium text-gray-900 text-sm mb-3">Cargos recurrentes (mensuales)</h3>
              <table className="hidden sm:table w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Concepto</th>
                    <th className="text-left pb-2 font-medium">Hab.</th>
                    <th className="text-right pb-2 font-medium">Monto/mes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recurringCharges.map((rc) => {
                    const c = contracts.find((c) => c.room_id === rc.room_id)
                    return (
                      <tr key={rc.id}>
                        <td className="py-2 text-gray-700">{INCOME_LABELS[rc.type] ?? rc.type}</td>
                        <td className="py-2 text-gray-500">{c?.room?.identifier ?? "—"}</td>
                        <td className="py-2 text-right text-gray-900 font-medium">Q{rc.amount.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="sm:hidden divide-y divide-gray-50">
                {recurringCharges.map((rc) => {
                  const c = contracts.find((c) => c.room_id === rc.room_id)
                  return (
                    <div key={rc.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700">{INCOME_LABELS[rc.type] ?? rc.type}</p>
                        <p className="text-xs text-gray-400">Hab. {c?.room?.identifier ?? "—"}</p>
                      </div>
                      <span className="text-sm text-gray-900 font-medium flex-shrink-0">Q{rc.amount.toLocaleString()}/mes</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">Incluidos en el monto esperado por contrato.</p>
            </div>
          )}

          {/* Ingresos extras (depósitos, firmas, etc.) */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 text-sm">Ingresos extras — {MONTHS[month]} {year}</h3>
              <button onClick={() => setAddIncome(!addIncome)}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                + Registrar ingreso extra
              </button>
            </div>

            {addIncome && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Habitación</label>
                    <select value={newIncome.contractId} onChange={(e) => setNewIncome((p) => ({ ...p, contractId: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                      <option value="">— Seleccionar —</option>
                      {contracts.map((c) => (
                        <option key={c.id} value={c.id}>Hab. {c.room?.identifier} · {c.tenant_profile?.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Concepto</label>
                    <select value={newIncome.type} onChange={(e) => setNewIncome((p) => ({ ...p, type: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                      {Object.entries(INCOME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Monto (Q)</label>
                    <input type="number" value={newIncome.amount} onChange={(e) => setNewIncome((p) => ({ ...p, amount: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Notas (opcional)</label>
                    <input type="text" value={newIncome.notes} onChange={(e) => setNewIncome((p) => ({ ...p, notes: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                      placeholder="Ej: mes de julio" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveIncome} className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">Guardar</button>
                  <button onClick={() => setAddIncome(false)} className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs">Cancelar</button>
                </div>
              </div>
            )}

            {incomeExtras.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">Sin ingresos extras este mes</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Concepto</th>
                    <th className="text-right pb-2 font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {incomeExtras.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 text-gray-700">{INCOME_LABELS[e.type] ?? e.type}</td>
                      <td className="py-2 text-right text-gray-900 font-medium">Q{e.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Egresos */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 text-sm">Egresos — {MONTHS[month]} {year}</h3>
              <button onClick={() => setAddExpense(!addExpense)}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#b64532] text-white hover:bg-[#9a3727] transition-colors">
                + Agregar gasto
              </button>
            </div>

            {addExpense && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Categoría</label>
                    <select value={newExpense.category} onChange={(e) => setNewExpense((p) => ({ ...p, category: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                      {Object.entries(EXPENSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Monto (Q)</label>
                    <input type="number" value={newExpense.amount} onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                      placeholder="0.00" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveExpense} className="px-4 py-1.5 rounded-lg bg-[#b64532] text-white text-xs font-medium">Guardar</button>
                  <button onClick={() => setAddExpense(false)} className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs">Cancelar</button>
                </div>
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Concepto</th>
                  <th className="text-right pb-2 font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.length === 0 && (
                  <tr><td colSpan={2} className="py-4 text-center text-gray-400 text-xs">Sin egresos registrados este mes</td></tr>
                )}
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 text-gray-700">{EXPENSE_LABELS[e.category] ?? e.category}</td>
                    <td className="py-2 text-right text-gray-900 font-medium">Q{e.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
