"use client"
import { useEffect, useMemo, useRef, useState } from "react"

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function periodLabel(period: string): string {
  const [year, month] = period.split("-")
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`
}

interface ContractInfo {
  identifier: string
  propertyName: string
  roomTypeLabel: string
  price: number
  startDate: string
  endDate: string
  paymentDay: number
  tenantName: string
}

interface Receipt {
  id: string
  period_month: string
  uploaded_at: string
  verified: boolean
  storage_path: string
  file_hash: string | null
  rejected: boolean
  rejection_reason: string | null
}

interface Charge { type: string; amount: number }

interface Waiver { period_month: string; concept: string; amount: number }

interface AbonoReq {
  id: string
  period_month: string
  requested_amount: number
  status: "pending" | "authorized" | "rejected"
  authorized_amount: number | null
  admin_notes: string | null
}

interface AbonoPay {
  id: string
  abono_request_id: string
  period_month: string
  amount: number
  verified: boolean
  rejected: boolean
  rejection_reason: string | null
}

interface IssueRow {
  id: string
  description: string
  status: "open" | "in_progress" | "resolved"
  created_at: string
}

const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  in_progress: "En proceso",
  resolved: "Resuelto",
}

const CHARGE_LABELS: Record<string, string> = {
  additional_person: "Persona adicional",
  parking: "Parqueo",
  contract_signing: "Firma de contrato",
  deposit: "Depósito",
  rent: "Renta",
  other: "Otro cobro",
}

export default function TenantDashboard() {
  const [info, setInfo] = useState<ContractInfo | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [recurringItems, setRecurringItems] = useState<Charge[]>([])
  const [oneTimeItems, setOneTimeItems] = useState<Charge[]>([])
  const [waivers, setWaivers] = useState<Waiver[]>([])
  const [abonoRequests, setAbonoRequests] = useState<AbonoReq[]>([])
  const [abonoPayments, setAbonoPayments] = useState<AbonoPay[]>([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const fileRef = useRef<HTMLInputElement>(null)
  const abonoFileRef = useRef<HTMLInputElement>(null)

  // Estado del flujo de abono
  const [showAbonoForm, setShowAbonoForm] = useState(false)
  const [abonoRequestAmount, setAbonoRequestAmount] = useState("")
  const [abonoPayAmount, setAbonoPayAmount] = useState("")
  const [abonoBusy, setAbonoBusy] = useState(false)
  const [abonoError, setAbonoError] = useState<string | null>(null)

  // Reportes de problemas
  const [reportCtx, setReportCtx] = useState<{ contractId: string; roomId: string; propertyId: string; tenantName: string } | null>(null)
  const [issues, setIssues] = useState<IssueRow[]>([])
  const [showReport, setShowReport] = useState(false)
  const [reportText, setReportText] = useState("")
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  // Meses del contrato (YYYY-MM) desde el mes de inicio hasta el mes de fin
  const contractMonths = useMemo(() => {
    if (!info?.startDate || !info?.endDate) return [] as string[]
    const start = new Date(info.startDate + "T00:00:00")
    const end = new Date(info.endDate + "T00:00:00")
    const months: string[] = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cursor <= last) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`)
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return months
  }, [info?.startDate, info?.endDate])

  // Estado de un mes según los comprobantes
  function periodStatus(period: string): "verified" | "rejected" | "pending" | "unpaid" {
    const r = receipts.find((x) => x.period_month === period)
    if (!r) return "unpaid"
    if (r.verified) return "verified"
    if (r.rejected) return "rejected"
    return "pending"
  }

  // Default: primer mes sin comprobante verificado (próximo mes sin pagar)
  const defaultPeriod = useMemo(() => {
    if (contractMonths.length === 0) return ""
    const nextUnpaid = contractMonths.find((m) => {
      const r = receipts.find((x) => x.period_month === m)
      return !r || !r.verified
    })
    return nextUnpaid ?? contractMonths[contractMonths.length - 1]
  }, [contractMonths, receipts])

  // Mes activo: el elegido por el inquilino, o el default mientras no haya elegido
  const activePeriod = selectedPeriod || defaultPeriod
  const hasSelectedMonth = receipts.some((r) => r.period_month === activePeriod)

  // Cobertura del pago seleccionado (pago por adelantado): día de pago → día de pago del mes siguiente
  const coverage = useMemo(() => {
    if (!activePeriod || !info) return null
    const [year, month] = activePeriod.split("-").map(Number)
    const day = info.paymentDay
    const start = new Date(year, month - 1, day)
    const end = new Date(year, month, day)
    const fmt = (d: Date) => d.toLocaleDateString("es-GT", { day: "numeric", month: "short" })
    return { start: fmt(start), end: fmt(end) }
  }, [activePeriod, info])

  useEffect(() => {
    async function load() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from("tenant_profiles")
        .select("*, contract:contracts!fk_contract(*, room:rooms(id, identifier, property_id, property:properties(name), room_type:room_types(label, price)))")
        .eq("id", user.id)
        .single() as { data: Record<string, unknown> | null }

      if (profile) {
        const raw = profile.contract
        const contract = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null
        const room = contract?.room as Record<string, unknown> | null
        const property = room?.property as Record<string, unknown> | null
        const roomType = room?.room_type as Record<string, unknown> | null
        setInfo({
          identifier: (room?.identifier as string) ?? "",
          propertyName: (property?.name as string) ?? "",
          roomTypeLabel: (roomType?.label as string) ?? "",
          price: (contract?.monthly_rent as number) ?? (roomType?.price as number) ?? 0,
          startDate: (contract?.start_date as string) ?? "",
          endDate: (contract?.end_date as string) ?? "",
          paymentDay: (contract?.payment_day as number) ?? 1,
          tenantName: (profile.name as string),
        })

        const contractId = contract?.id as string

        const { data: rec } = await supabase
          .from("payment_receipts")
          .select("*")
          .eq("contract_id", contractId)
          .order("period_month", { ascending: false })
        setReceipts((rec as Receipt[]) ?? [])

        // Recurring monthly charges
        const { data: recurring } = await supabase
          .from("recurring_charges")
          .select("type, amount")
          .eq("contract_id", contractId)
        setRecurringItems((recurring as Charge[]) ?? [])

        // One-time charges (deposit, signing) — billed first month only
        const { data: oneTime } = await supabase
          .from("income_extras")
          .select("type, amount")
          .eq("contract_id", contractId)
          .in("type", ["deposit", "contract_signing"])
        setOneTimeItems((oneTime as Charge[]) ?? [])

        // Condonaciones (waivers) del contrato
        const { data: waiverRows } = await supabase
          .from("charge_waivers")
          .select("period_month, concept, amount")
          .eq("contract_id", contractId)
        setWaivers((waiverRows as Waiver[]) ?? [])

        // Solicitudes y comprobantes de abono del contrato
        const { data: abReq } = await supabase
          .from("abono_requests")
          .select("id, period_month, requested_amount, status, authorized_amount, admin_notes")
          .eq("contract_id", contractId)
        setAbonoRequests((abReq as AbonoReq[]) ?? [])

        const { data: abPay } = await supabase
          .from("abono_payments")
          .select("id, abono_request_id, period_month, amount, verified, rejected, rejection_reason")
          .eq("contract_id", contractId)
        setAbonoPayments((abPay as AbonoPay[]) ?? [])

        // Report context (for issue reports)
        setReportCtx({
          contractId,
          roomId: (room?.id as string) ?? (contract?.room_id as string),
          propertyId: (room?.property_id as string) ?? "",
          tenantName: (profile.name as string) ?? "",
        })

        // Tenant's own issue reports
        const { data: myIssues } = await supabase
          .from("issue_reports")
          .select("id, description, status, created_at")
          .eq("tenant_profile_id", user.id)
          .order("created_at", { ascending: false })
        setIssues((myIssues as IssueRow[]) ?? [])
      }
    }
    load()
  }, [])

  async function submitReport(e: React.FormEvent) {
    e.preventDefault()
    if (!reportText.trim() || !reportCtx) return
    setReportBusy(true); setReportError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("issue_reports")
        .insert({
          contract_id: reportCtx.contractId,
          tenant_profile_id: user.id,
          room_id: reportCtx.roomId,
          property_id: reportCtx.propertyId,
          tenant_name: reportCtx.tenantName,
          description: reportText.trim(),
        })
        .select("id, description, status, created_at")
        .single()
      if (error) throw error
      setIssues((p) => [data as IssueRow, ...p])
      setShowReport(false); setReportText("")
    } catch (err: unknown) {
      setReportError(err instanceof Error ? err.message : "Error al enviar el reporte")
    } finally {
      setReportBusy(false)
    }
  }

  async function computeHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!activePeriod) { setUploadError("Selecciona el mes que vas a pagar."); return }
    const wasReplace = receipts.some((r) => r.period_month === activePeriod)
    setUploading(true)
    setUploadError(null)
    setUploadNotice(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const { data: profile } = await supabase
        .from("tenant_profiles")
        .select("contract_id")
        .eq("id", user.id)
        .single()

      const contractId = (profile as unknown as Record<string, unknown>)?.contract_id as string

      // Duplicate detection: block if same file already submitted for a different period
      const fileHash = await computeHash(file)
      const { data: existingReceipts } = await supabase
        .from("payment_receipts")
        .select("period_month, file_hash")
        .eq("contract_id", contractId)
        .not("file_hash", "is", null)
      const duplicate = (existingReceipts ?? []).find(
        (r) => r.file_hash === fileHash && r.period_month !== activePeriod
      )
      if (duplicate) {
        throw new Error(`Este comprobante ya fue enviado para ${periodLabel(duplicate.period_month)}. Sube el comprobante del mes que vas a pagar.`)
      }

      const path = `${user.id}/${activePeriod}/${file.name}`
      const { error: storageErr } = await supabase.storage.from("receipts").upload(path, file, { upsert: true })
      if (storageErr) throw storageErr

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rec, error: recErr } = await (supabase as any)
        .from("payment_receipts")
        .upsert({
          tenant_profile_id: user.id,
          contract_id: contractId,
          period_month: activePeriod,
          storage_path: path,
          file_hash: fileHash,
          verified: false,
          rejected: false,
          rejection_reason: null,
        }, { onConflict: "contract_id,period_month" })
        .select()
        .single()
      if (recErr) throw recErr

      setReceipts((prev) => [rec as Receipt, ...prev.filter((r) => r.period_month !== activePeriod)])
      setUploadNotice(wasReplace ? "Comprobante reemplazado correctamente ✓" : "Comprobante subido correctamente ✓")
    } catch (err: unknown) {
      console.error("handleUpload", err)
      const msg = err instanceof Error
        ? err.message
        : (err && typeof err === "object" && "message" in err)
          ? String((err as { message: unknown }).message)
          : "Error al subir el comprobante"
      setUploadError(msg)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleDelete() {
    const current = receipts.find((r) => r.period_month === activePeriod)
    if (!current || current.verified) return
    if (!window.confirm(`¿Eliminar el comprobante de ${periodLabel(current.period_month)}? Podrás subir otro.`)) return
    setDeleting(true)
    setUploadError(null)
    setUploadNotice(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { error: delErr } = await supabase
        .from("payment_receipts")
        .delete()
        .eq("id", current.id)
      if (delErr) throw delErr

      // El archivo solo importa junto a su row; si falla su borrado, ya quedó huérfano e invisible para admin.
      const { error: storageErr } = await supabase.storage.from("receipts").remove([current.storage_path])
      if (storageErr) console.error("handleDelete storage", storageErr)

      setReceipts((prev) => prev.filter((r) => r.period_month !== activePeriod))
      setUploadNotice("Comprobante eliminado ✓")
    } catch (err: unknown) {
      console.error("handleDelete", err)
      const msg = err instanceof Error
        ? err.message
        : (err && typeof err === "object" && "message" in err)
          ? String((err as { message: unknown }).message)
          : "Error al eliminar el comprobante"
      setUploadError(msg)
    } finally {
      setDeleting(false)
    }
  }

  async function submitAbono() {
    const amount = Number(abonoRequestAmount)
    if (!activePeriod) { setAbonoError("Selecciona el mes."); return }
    if (!(amount > 0)) { setAbonoError("Ingresa un monto válido."); return }
    setAbonoBusy(true); setAbonoError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { data: profile } = await supabase
        .from("tenant_profiles")
        .select("contract_id, room_id")
        .eq("id", user.id)
        .single()
      const p = profile as unknown as Record<string, unknown> | null
      const contractId = p?.contract_id as string
      const roomId = p?.room_id as string

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: req, error } = await (supabase as any)
        .from("abono_requests")
        .upsert({
          contract_id: contractId,
          tenant_profile_id: user.id,
          room_id: roomId,
          period_month: activePeriod,
          requested_amount: amount,
          month_total: totalToPay,
          status: "pending",
          authorized_amount: null,
          admin_notes: null,
          resolved_at: null,
          resolved_by: null,
        }, { onConflict: "contract_id,period_month" })
        .select("id, period_month, requested_amount, status, authorized_amount, admin_notes")
        .single()
      if (error) throw error

      setAbonoRequests((prev) => [req as AbonoReq, ...prev.filter((a) => a.period_month !== activePeriod)])
      setShowAbonoForm(false)
      setAbonoRequestAmount("")
    } catch (err: unknown) {
      setAbonoError(err instanceof Error ? err.message : "Error al enviar la solicitud")
    } finally {
      setAbonoBusy(false)
    }
  }

  async function handleAbonoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const req = abonoRequests.find((a) => a.period_month === activePeriod && a.status === "authorized")
    if (!req) { setAbonoError("Aún no tienes un abono autorizado para este mes."); return }
    const amount = Number(abonoPayAmount)
    if (!(amount > 0)) { setAbonoError("Ingresa el monto de este abono."); return }
    setAbonoBusy(true); setAbonoError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { data: profile } = await supabase
        .from("tenant_profiles")
        .select("contract_id, room_id")
        .eq("id", user.id)
        .single()
      const p = profile as unknown as Record<string, unknown> | null
      const contractId = p?.contract_id as string
      const roomId = p?.room_id as string

      const fileHash = await computeHash(file)
      const path = `${user.id}/abonos/${activePeriod}/${crypto.randomUUID()}-${file.name}`
      const { error: storageErr } = await supabase.storage.from("receipts").upload(path, file, { upsert: false })
      if (storageErr) throw storageErr

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ap, error: apErr } = await (supabase as any)
        .from("abono_payments")
        .insert({
          abono_request_id: req.id,
          contract_id: contractId,
          tenant_profile_id: user.id,
          room_id: roomId,
          period_month: activePeriod,
          amount,
          storage_path: path,
          file_hash: fileHash,
          verified: false,
          rejected: false,
          rejection_reason: null,
        })
        .select("id, abono_request_id, period_month, amount, verified, rejected, rejection_reason")
        .single()
      if (apErr) throw apErr

      setAbonoPayments((prev) => [...prev, ap as AbonoPay])
      setAbonoPayAmount("")
    } catch (err: unknown) {
      setAbonoError(err instanceof Error ? err.message : "Error al subir el abono")
    } finally {
      setAbonoBusy(false)
      if (abonoFileRef.current) abonoFileRef.current.value = ""
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/tenant/login"
  }

  const daysUntilPayment = (() => {
    if (!info) return null
    const today = new Date()
    const due = new Date(today.getFullYear(), today.getMonth(), info.paymentDay)
    if (due < today) due.setMonth(due.getMonth() + 1)
    return Math.ceil((due.getTime() - today.getTime()) / 86400000)
  })()

  // Total a pagar: primer mes incluye depósito + firma; demás meses solo renta + recurrentes
  const startMonth = info?.startDate ? info.startDate.slice(0, 7) : ""
  const isFirstMonth = startMonth === activePeriod
  const recurringTotal = recurringItems.reduce((s, c) => s + c.amount, 0)
  const oneTimeTotal = oneTimeItems.reduce((s, c) => s + c.amount, 0)
  const totalBruto = (info?.price ?? 0) + recurringTotal + (isFirstMonth ? oneTimeTotal : 0)
  const waiversThisMonth = waivers.filter((w) => w.period_month === activePeriod)
  const waiverTotal = waiversThisMonth.reduce((s, w) => s + w.amount, 0)
  const totalToPay = Math.max(0, totalBruto - waiverTotal)

  // Abono del mes activo
  const abonoReq = abonoRequests.find((a) => a.period_month === activePeriod) ?? null
  const abonoPaysThisMonth = abonoPayments.filter((p) => p.period_month === activePeriod)
  const abonadoVerificado = abonoPaysThisMonth.filter((p) => p.verified).reduce((s, p) => s + p.amount, 0)
  const abonoRestante = Math.max(0, totalToPay - abonadoVerificado)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg grid place-items-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: "#b64532", fontFamily: "Georgia, serif" }}>M</div>
            <span className="font-semibold text-gray-900 text-sm">Mi habitación</span>
          </div>
          <button onClick={handleLogout} disabled={loggingOut}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Contract info */}
        {info && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Tu habitación</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Propiedad</span>
                <span className="text-sm font-medium text-gray-900">{info.propertyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Habitación</span>
                <span className="text-sm font-medium text-gray-900">{info.identifier} · {info.roomTypeLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Renta mensual</span>
                <span className="text-sm font-medium text-gray-900">Q{info.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-sm text-gray-500 flex-shrink-0">Contrato</span>
                <span className="text-sm text-gray-700 text-right">
                  {new Date(info.startDate).toLocaleDateString("es-GT")} – {new Date(info.endDate).toLocaleDateString("es-GT")}
                </span>
              </div>
              <div className={`flex justify-between gap-3 pt-1 border-t border-gray-50 ${daysUntilPayment !== null && daysUntilPayment <= 3 ? "text-amber-600" : ""}`}>
                <span className="text-sm flex-shrink-0">Próximo pago</span>
                <span className="text-sm font-semibold text-right">
                  Día {info.paymentDay}
                  {daysUntilPayment !== null && (
                    <span className="ml-1 text-xs font-normal">
                      ({daysUntilPayment === 0 ? "¡hoy!" : daysUntilPayment === 1 ? "mañana" : `en ${daysUntilPayment} días`})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Total a pagar */}
        {info && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total a pagar{activePeriod ? ` · ${periodLabel(activePeriod)}` : ""}</p>
              {isFirstMonth && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Primer pago</span>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Renta {info.roomTypeLabel}</span>
                <span className="text-gray-900">Q{info.price.toLocaleString()}</span>
              </div>
              {recurringItems.map((c, i) => (
                <div key={`r-${i}`} className="flex justify-between text-sm">
                  <span className="text-gray-500">{CHARGE_LABELS[c.type] ?? c.type}</span>
                  <span className="text-gray-900">Q{c.amount.toLocaleString()}</span>
                </div>
              ))}
              {isFirstMonth && oneTimeItems.map((c, i) => (
                <div key={`o-${i}`} className="flex justify-between text-sm">
                  <span className="text-gray-500">{CHARGE_LABELS[c.type] ?? c.type} <span className="text-xs text-gray-400">(único)</span></span>
                  <span className="text-gray-900">Q{c.amount.toLocaleString()}</span>
                </div>
              ))}
              {waiversThisMonth.map((w, i) => (
                <div key={`w-${i}`} className="flex justify-between text-sm">
                  <span className="text-green-700">{CHARGE_LABELS[w.concept] ?? w.concept} <span className="text-xs text-green-600">(condonado)</span></span>
                  <span className="text-green-700">−Q{w.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-1 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-[#b64532]">Q{totalToPay.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Upload receipt */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Comprobante de pago</p>

          {/* Selector de mes a pagar */}
          {contractMonths.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1.5">¿Qué mes vas a pagar?</label>
              <select
                value={activePeriod}
                onChange={(e) => { setSelectedPeriod(e.target.value); setUploadError(null); setUploadNotice(null) }}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
              >
                {contractMonths.map((m) => {
                  const labels = { verified: "✓ pagado", pending: "pendiente", rejected: "✕ rechazado", unpaid: "sin pagar" }
                  return (
                    <option key={m} value={m}>{periodLabel(m)} — {labels[periodStatus(m)]}</option>
                  )
                })}
              </select>
              {coverage && (
                <p className="text-xs text-gray-400 mt-1.5">Cubre del {coverage.start} al {coverage.end}</p>
              )}
            </div>
          )}

          {hasSelectedMonth ? (() => {
            const current = receipts.find((r) => r.period_month === activePeriod)
            if (current?.rejected) {
              return (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-red-600 text-lg">✕</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-red-800">Comprobante rechazado</p>
                      <p className="text-xs text-red-600">
                        {current.rejection_reason
                          ? `Motivo: ${current.rejection_reason}`
                          : "La administradora rechazó tu comprobante. Sube uno corregido."}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || deleting}
                    className="mt-3 w-full py-2.5 rounded-lg bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors disabled:opacity-60"
                  >
                    {uploading ? "Subiendo…" : "Subir comprobante corregido"}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={uploading || deleting}
                    className="mt-2 w-full py-2 rounded-lg text-sm text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60"
                  >
                    {deleting ? "Eliminando…" : "Eliminar comprobante"}
                  </button>
                </div>
              )
            }
            return (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl">
                <span className="text-green-600 text-lg">✓</span>
                <div>
                  <p className="text-sm font-medium text-green-800">Comprobante subido</p>
                  <p className="text-xs text-green-600">
                    {current?.verified ? "Verificado por la administradora" : "Pendiente de verificación"}
                  </p>
                </div>
                {!current?.verified && (
                  <div className="ml-auto flex items-center gap-3">
                    <button onClick={() => fileRef.current?.click()} disabled={uploading || deleting} className="text-xs text-green-700 underline disabled:opacity-60">
                      Reemplazar
                    </button>
                    <button onClick={handleDelete} disabled={uploading || deleting} className="text-xs text-red-600 underline disabled:opacity-60">
                      {deleting ? "Eliminando…" : "Eliminar"}
                    </button>
                  </div>
                )}
                {current?.verified && (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading || deleting} className="ml-auto text-xs text-green-700 underline disabled:opacity-60">
                    Reemplazar
                  </button>
                )}
              </div>
            )
          })() : (
            <div>
              <p className="text-sm text-gray-600 mb-3">Sube tu comprobante de pago de {activePeriod ? periodLabel(activePeriod) : "este mes"}.</p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-[#b64532] hover:text-[#b64532] transition-colors disabled:opacity-50"
              >
                {uploading ? "Subiendo…" : "📎 Seleccionar imagen o PDF"}
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
          {uploadError && (
            <p className="text-xs text-red-600 mt-2">{uploadError}</p>
          )}
          {uploadNotice && !uploadError && (
            <p className="text-xs text-green-600 mt-2">{uploadNotice}</p>
          )}
        </div>

        {/* Pagar en partes (abono) */}
        {info && activePeriod && !hasSelectedMonth && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Pagar en partes (abono)</p>

            {!abonoReq && (
              <div>
                {!showAbonoForm ? (
                  <>
                    <p className="text-sm text-gray-600 mb-3">
                      ¿No tienes el monto completo? Solicita a la administradora pagar {periodLabel(activePeriod)} en partes.
                    </p>
                    <button
                      onClick={() => { setShowAbonoForm(true); setAbonoError(null); setAbonoRequestAmount("") }}
                      className="w-full py-2.5 rounded-lg border border-[#b64532] text-[#b64532] text-sm font-medium hover:bg-[#b64532]/5 transition-colors"
                    >
                      Solicitar abono
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-sm text-gray-600">¿Cuánto puedes abonar ahora? (Q)</label>
                    <input
                      type="number" value={abonoRequestAmount}
                      onChange={(e) => setAbonoRequestAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                      placeholder={`Total del mes: Q${totalToPay.toLocaleString()}`}
                    />
                    <div className="flex gap-2">
                      <button onClick={submitAbono} disabled={abonoBusy}
                        className="flex-1 py-2.5 rounded-lg bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors disabled:opacity-60">
                        {abonoBusy ? "Enviando…" : "Enviar solicitud"}
                      </button>
                      <button onClick={() => { setShowAbonoForm(false); setAbonoError(null) }}
                        className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {abonoReq?.status === "pending" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm font-medium text-amber-800">Solicitud de abono pendiente</p>
                <p className="text-xs text-amber-700">Propusiste abonar Q{abonoReq.requested_amount.toLocaleString()}. Espera la autorización de la administradora.</p>
              </div>
            )}

            {abonoReq?.status === "rejected" && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm font-medium text-red-800">Solicitud de abono rechazada</p>
                <p className="text-xs text-red-600">{abonoReq.admin_notes ? `Motivo: ${abonoReq.admin_notes}` : "La administradora rechazó la solicitud."}</p>
                <button
                  onClick={() => { setShowAbonoForm(true); setAbonoRequests((prev) => prev.filter((a) => a.period_month !== activePeriod)) }}
                  className="mt-2 text-xs text-[#b64532] underline"
                >
                  Solicitar de nuevo
                </button>
              </div>
            )}

            {abonoReq?.status === "authorized" && (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                  <p className="text-sm font-medium text-green-800">Abono autorizado</p>
                  <p className="text-xs text-green-600">
                    Puedes pagar {periodLabel(activePeriod)} en partes
                    {abonoReq.authorized_amount ? ` (autorizado: Q${abonoReq.authorized_amount.toLocaleString()})` : ""}.
                  </p>
                </div>

                {/* Progreso */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Abonado Q{abonadoVerificado.toLocaleString()} de Q{totalToPay.toLocaleString()}</span>
                    <span>Restante Q{abonoRestante.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${totalToPay > 0 ? Math.min(100, (abonadoVerificado / totalToPay) * 100) : 0}%` }} />
                  </div>
                </div>

                {/* Comprobantes de abono enviados */}
                {abonoPaysThisMonth.length > 0 && (
                  <div className="divide-y divide-gray-50">
                    {abonoPaysThisMonth.map((ap) => (
                      <div key={ap.id} className="py-2 flex items-center justify-between">
                        <span className="text-sm text-gray-700">Q{ap.amount.toLocaleString()}</span>
                        {ap.verified
                          ? <span className="text-xs text-green-600 font-medium">✓ Verificado</span>
                          : ap.rejected
                            ? <span className="text-xs text-red-500 font-medium">✕ Rechazado</span>
                            : <span className="text-xs text-amber-500">Pendiente</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Subir nuevo abono */}
                {abonoRestante > 0 && (
                  <div className="space-y-2 pt-1">
                    <label className="block text-sm text-gray-600">Monto de este abono (Q)</label>
                    <input
                      type="number" value={abonoPayAmount}
                      onChange={(e) => setAbonoPayAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                      placeholder={`Restante: Q${abonoRestante.toLocaleString()}`}
                    />
                    <button
                      onClick={() => abonoFileRef.current?.click()}
                      disabled={abonoBusy}
                      className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-[#b64532] hover:text-[#b64532] transition-colors disabled:opacity-50"
                    >
                      {abonoBusy ? "Subiendo…" : "📎 Subir comprobante de abono"}
                    </button>
                    <input ref={abonoFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleAbonoUpload} />
                  </div>
                )}
              </div>
            )}

            {abonoError && <p className="text-xs text-red-600 mt-2">{abonoError}</p>}
          </div>
        )}

        {/* History */}
        {receipts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Historial</p>
            <div className="divide-y divide-gray-50">
              {receipts.map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between">
                  <span className="text-sm text-gray-700">{r.period_month}</span>
                  <div className="flex items-center gap-2">
                    {r.verified
                      ? <span className="text-xs text-green-600 font-medium">✓ Verificado</span>
                      : r.rejected
                        ? <span className="text-xs text-red-500 font-medium">✕ Rechazado</span>
                        : <span className="text-xs text-amber-500">Pendiente</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reportar problema */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Reportar un problema</p>
            <button
              onClick={() => setShowReport((s) => !s)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#b64532] text-white font-medium hover:bg-[#9a3727] transition-colors"
            >
              {showReport ? "Cancelar" : "Reportar problema"}
            </button>
          </div>

          {showReport && (
            <form onSubmit={submitReport} className="space-y-2 mb-3">
              <textarea
                value={reportText} onChange={(e) => setReportText(e.target.value)} rows={3} required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40 resize-none"
                placeholder="Describe el daño o avería (ej: gotea la regadera del baño, no calienta el agua, foco quemado en la cocina...)"
              />
              {reportError && <p className="text-xs text-red-600">{reportError}</p>}
              <button type="submit" disabled={reportBusy}
                className="w-full py-2.5 rounded-lg bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors disabled:opacity-60">
                {reportBusy ? "Enviando…" : "Enviar reporte"}
              </button>
            </form>
          )}

          {issues.length === 0 ? (
            <p className="text-xs text-gray-400">Aún no has reportado problemas.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {issues.map((it) => (
                <div key={it.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-700 flex-1 min-w-0 break-words">{it.description}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                      it.status === "resolved" ? "bg-green-50 text-green-700 border-green-200"
                      : it.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {ISSUE_STATUS_LABELS[it.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(it.created_at).toLocaleDateString("es-GT")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
