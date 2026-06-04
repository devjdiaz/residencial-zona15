"use client"
import { useEffect, useState } from "react"
import type { Contract, Expense, IncomeExtra, PaymentReceipt, TenantProfile } from "@/lib/supabase/types"

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const INCOME_LABELS: Record<string, string> = {
  additional_person: "Persona adicional",
  parking: "Parqueo",
  contract_signing: "Firma de contrato",
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
  fixedIncome: number
  variableIncome: number
  fixedExpenses: number
  variableExpenses: number
  commissions: number
}

interface Receipt {
  receipt: PaymentReceipt
  tenant: TenantProfile
  roomId: string
  roomIdentifier: string
}

export default function FinancesPanel() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed
  const [propertyId, setPropertyId] = useState<string>("")
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomeExtras, setIncomeExtras] = useState<IncomeExtra[]>([])
  const [loading, setLoading] = useState(false)
  const [contracts, setContracts] = useState<(Contract & { room: { identifier: string; room_type?: { price: number } }; tenant_profile: TenantProfile })[]>([])
  const [addExpense, setAddExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({ category: "electricity", amount: "", notes: "" })
  const [addIncome, setAddIncome] = useState(false)
  const [newIncome, setNewIncome] = useState({ type: "additional_person", amount: "", contractId: "", notes: "" })

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

      // Get room IDs for this property first
      const { data: propertyRooms } = await supabase
        .from("rooms")
        .select("id")
        .eq("property_id", propertyId)
      const propertyRoomIds = (propertyRooms ?? []).map((r) => r.id)

      // Active contracts for this property this month
      const { data: contracts } = await supabase
        .from("contracts")
        .select("*, tenant_profile:tenant_profiles(*), room:rooms(identifier, property_id, room_type:room_types(price))")
        .in("room_id", propertyRoomIds.length ? propertyRoomIds : ["none"])
        .eq("status", "active") as { data: (Contract & { room: { identifier: string; room_type?: { price: number } }; tenant_profile: TenantProfile })[] | null }

      setContracts(contracts ?? [])
      const fixedIncome = (contracts ?? []).reduce((sum, c) => sum + (c.room?.room_type?.price ?? 0), 0)

      // Income extras this period
      const { data: extras } = await supabase
        .from("income_extras")
        .select("*")
        .in("room_id", (contracts ?? []).map((c) => c.room_id))
        .like("date", `${period}%`)
      setIncomeExtras(extras ?? [])
      const variableIncome = (extras ?? []).reduce((sum, e) => sum + e.amount, 0)

      // Expenses this period
      const { data: exp } = await supabase
        .from("expenses")
        .select("*")
        .or(`property_id.eq.${propertyId},property_id.is.null`)
        .eq("period", period)
      setExpenses(exp ?? [])

      const fixedExpenses = (exp ?? []).filter((e) => e.type === "fixed").reduce((sum, e) => sum + (e.property_id ? e.amount : e.amount / 2), 0)
      const variableExpenses = (exp ?? []).filter((e) => e.type === "variable").reduce((sum, e) => sum + e.amount, 0)
      const commissions = (exp ?? []).filter((e) => e.category === "commission").reduce((sum, e) => sum + e.amount, 0)

      setSummary({ fixedIncome, variableIncome, fixedExpenses, variableExpenses, commissions })

      // Payment receipts
      const contractIds = (contracts ?? []).map((c) => c.id)
      const { data: rec } = await supabase
        .from("payment_receipts")
        .select("*")
        .in("contract_id", contractIds)
        .eq("period_month", period)
      const receiptList: Receipt[] = (rec ?? []).map((r) => {
        const contract = (contracts ?? []).find((c) => c.id === r.contract_id)
        return {
          receipt: r,
          tenant: contract?.tenant_profile ?? { id: "", room_id: "", contract_id: "", name: "—", phone: "" },
          roomId: contract?.room_id ?? "",
          roomIdentifier: contract?.room?.identifier ?? "—",
        }
      })
      setReceipts(receiptList)
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
    setAddIncome(false)
    setNewIncome({ type: "additional_person", amount: "", contractId: "", notes: "" })
  }

  async function verifyReceipt(receiptId: string) {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("payment_receipts").update({ verified: true }).eq("id", receiptId)
    setReceipts((prev) => prev.map((r) => r.receipt.id === receiptId ? { ...r, receipt: { ...r.receipt, verified: true } } : r))
  }

  const totalIncome = (summary?.fixedIncome ?? 0) + (summary?.variableIncome ?? 0)
  const totalExpenses = (summary?.fixedExpenses ?? 0) + (summary?.variableExpenses ?? 0)
  const net = totalIncome - totalExpenses

  if (notConfigured) {
    return <p className="text-sm text-gray-400 py-8 text-center">Configura Supabase para ver las finanzas.</p>
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : summary && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Ingresos fijos", value: summary.fixedIncome, color: "text-green-700" },
              { label: "Ingresos variables", value: summary.variableIncome, color: "text-green-600" },
              { label: "Total egresos", value: totalExpenses, color: "text-red-600" },
              { label: "Neto del mes", value: net, color: net >= 0 ? "text-blue-700" : "text-red-700" },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-2xl font-semibold mt-1 ${k.color}`}>Q{k.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Income extras */}
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
                <div className="grid grid-cols-2 gap-3">
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

          {/* Expenses detail */}
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
                <div className="grid grid-cols-2 gap-3">
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

          {/* Receipts */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-medium text-gray-900 text-sm mb-4">
              Comprobantes de pago — {MONTHS[month]} {year}
              <span className="ml-2 text-xs text-gray-400">
                ({receipts.filter((r) => r.receipt.verified).length}/{receipts.length} verificados)
              </span>
            </h3>
            {receipts.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">Sin comprobantes subidos este mes</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {receipts.map((r) => (
                  <div key={r.receipt.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{r.tenant.name}</span>
                      <span className="text-xs text-gray-400 ml-2">Hab. {r.roomIdentifier}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={r.receipt.storage_path} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#24577a] hover:underline">Ver comprobante</a>
                      {r.receipt.verified ? (
                        <span className="text-xs text-green-600 font-medium">✓ Verificado</span>
                      ) : (
                        <button onClick={() => verifyReceipt(r.receipt.id)}
                          className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200">
                          Marcar verificado
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
