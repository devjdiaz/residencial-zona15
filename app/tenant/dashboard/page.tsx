"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { KeyRoundIcon } from "lucide-react"
import AccountDialog from "@/components/AccountDialog"

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function periodLabel(period: string): string {
  const [year, month] = period.split("-")
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`
}

// Supabase Storage rechaza claves con espacios y ciertos caracteres (~, paréntesis, etc.)
// con "Invalid key". Limpiamos el nombre dejando solo caracteres seguros.
function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf(".")
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot + 1) : ""
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")      // quita acentos
      .replace(/[^a-zA-Z0-9._-]+/g, "_")    // resto -> guion bajo
      .replace(/_+/g, "_")                  // colapsa repetidos
      .replace(/^[._-]+|[._-]+$/g, "")      // recorta extremos
  const safeBase = clean(base) || "archivo"
  const safeExt = ext ? clean(ext) : ""
  return safeExt ? `${safeBase}.${safeExt.toLowerCase()}` : safeBase
}

// —— Diagnóstico de fallos al subir comprobantes ————————————————————————
// El navegador reporta CUALQUIER fallo de red como "Failed to fetch" (Chrome/Android),
// "Load failed" (Safari iOS) o "NetworkError…" (Firefox), sin decir qué llamada falló.
// Etiquetamos cada paso de la subida y traducimos el error a algo accionable, más un
// detalle técnico copiable que el inquilino puede mandarnos por WhatsApp.

// Espejo del límite del bucket `receipts` en Supabase (Storage → File size limit).
// Con la compresión de abajo, en la práctica nada legítimo se acerca a este tope.
const MAX_FILE_MB = 50

type UploadStep = "sesion" | "contrato" | "historial" | "archivo" | "registro" | "solicitud" | "eliminar"

const STEP_LABELS: Record<UploadStep, string> = {
  sesion: "verificar tu sesión",
  contrato: "leer los datos de tu contrato",
  historial: "revisar tus comprobantes anteriores",
  archivo: "subir el archivo",
  registro: "guardar el comprobante",
  solicitud: "enviar la solicitud",
  eliminar: "eliminar el comprobante",
}

// Regla de negocio (mes duplicado, sesión vencida, sin contrato): el mensaje ya está
// escrito para el inquilino, se muestra tal cual y sin detalle técnico.
class TenantError extends Error {}

function formatMB(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// Un fallo de red (DNS, TLS, CORS, conexión cortada, bloqueo del proveedor) llega como
// TypeError sin status. Todo lo que traiga status HTTP es una respuesta del servidor.
function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const m = err.message.toLowerCase()
  return (
    err.name === "TypeError" ||
    m.includes("failed to fetch") ||
    m.includes("load failed") ||
    m.includes("networkerror") ||
    m.includes("network request failed")
  )
}

function httpStatusOf(err: unknown): number | null {
  if (!err || typeof err !== "object") return null
  const e = err as { statusCode?: unknown; status?: unknown }
  const n = Number(e.statusCode ?? e.status)
  return Number.isFinite(n) && n > 0 ? n : null
}

function rawMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message)
  return String(err)
}

// Revisión previa: lo que podemos rechazar sin siquiera tocar la red.
function validateReceiptFile(file: File): string | null {
  if (file.size === 0) {
    return "El archivo llegó vacío (0 bytes). Vuelve a tomar la captura o a descargar el comprobante de tu banco, y súbelo de nuevo."
  }
  if (file.size > MAX_FILE_MB * 1048576) {
    return `El archivo pesa ${formatMB(file.size)} y el máximo permitido es ${MAX_FILE_MB} MB. Toma una captura de pantalla del comprobante (pesa mucho menos que la foto original) y sube esa.`
  }
  return null
}

// —— Compresión en el navegador ————————————————————————————————————————
// Una foto de celular pesa 8-12 MB y sobre datos móviles inestables la subida se corta
// a medio camino ("Failed to fetch"). Un comprobante se lee perfecto a 2000px, así que
// lo encogemos antes de subir. El hash anti-fraude se calcula sobre el archivo ORIGINAL
// (ver handleUpload), de modo que la detección de duplicados no depende de esto.

const MAX_IMAGE_DIMENSION = 2000
const COMPRESS_ABOVE_BYTES = 1.5 * 1048576
const JPEG_QUALITY = 0.85

async function compressImage(file: File): Promise<{ file: File; compressed: boolean }> {
  if (!file.type.startsWith("image/") || file.size <= COMPRESS_ABOVE_BYTES) {
    return { file, compressed: false }
  }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) { bitmap.close(); return { file, compressed: false } }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    )
    // Una captura PNG chica puede crecer al pasar a JPEG: en ese caso dejamos el original.
    if (!blob || blob.size >= file.size) return { file, compressed: false }
    const base = file.name.replace(/\.[^.]+$/, "") || "comprobante"
    return { file: new File([blob], `${base}.jpg`, { type: "image/jpeg" }), compressed: true }
  } catch {
    // Formato que el navegador no sabe decodificar (HEIC viejo, etc.): subimos el original.
    return { file, compressed: false }
  }
}

interface UploadFailure { message: string; details: string | null }

function describeUploadError(err: unknown, step: UploadStep, file: File | null): UploadFailure {
  if (err instanceof TenantError) return { message: err.message, details: null }

  const stepLabel = STEP_LABELS[step]
  const status = httpStatusOf(err)
  const raw = rawMessageOf(err)
  const online = typeof navigator !== "undefined" ? navigator.onLine : true

  let message: string
  if (status === 413) {
    message = `El servidor rechazó el archivo por tamaño${file ? ` (${formatMB(file.size)})` : ""}. Sube una captura de pantalla del comprobante en vez de la foto o el PDF original.`
  } else if (status === 401 || status === 403) {
    message = `Tu sesión ya no es válida (error ${status}) al ${stepLabel}. Toca «Salir», vuelve a iniciar sesión e intenta de nuevo.`
  } else if (status === 409) {
    message = `Ya existe un comprobante registrado para ese mes (error 409). Recarga la página para ver el estado actualizado.`
  } else if (status && status >= 500) {
    message = `El servidor respondió con un error ${status} al ${stepLabel}. El problema no es tu teléfono ni tu conexión: espera unos minutos e intenta otra vez.`
  } else if (isNetworkError(err)) {
    if (!online) {
      message = `Tu teléfono está sin conexión a internet (falló al ${stepLabel}). Conéctate a wifi o datos y vuelve a intentar.`
    } else if (step === "archivo") {
      message = `La conexión se cortó mientras se subía el archivo${file ? ` (${formatMB(file.size)})` : ""}. Pasa con archivos pesados o señal inestable: prueba con una captura de pantalla más liviana, o desde otra red.`
    } else {
      message = `No se pudo conectar con el servidor al ${stepLabel}. Revisa tu conexión y vuelve a intentar; si sigue igual, mándanos los detalles de abajo.`
    }
  } else if (raw) {
    message = `Falló al ${stepLabel}: ${raw}`
  } else {
    message = `Falló al ${stepLabel} por un error desconocido. Mándanos los detalles de abajo.`
  }

  const errObj = (err && typeof err === "object" ? err : {}) as Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = typeof navigator !== "undefined" ? (navigator as any).connection : undefined
  const details = [
    `Paso: ${step} — ${stepLabel}`,
    `Error: ${err instanceof Error ? err.name : typeof err}: ${raw}`,
    status ? `HTTP: ${status}` : null,
    errObj.code ? `Código: ${String(errObj.code)}` : null,
    errObj.details ? `Detalle: ${String(errObj.details)}` : null,
    errObj.hint ? `Sugerencia: ${String(errObj.hint)}` : null,
    file ? `Archivo: ${file.name} · ${formatMB(file.size)} · ${file.type || "tipo desconocido"}` : null,
    `Conexión: ${online ? "en línea" : "SIN CONEXIÓN"}${conn?.effectiveType ? ` · ${conn.effectiveType}` : ""}`,
    `Fecha: ${new Date().toISOString()}`,
    `Navegador: ${typeof navigator !== "undefined" ? navigator.userAgent : "?"}`,
  ].filter(Boolean).join("\n")

  return { message, details }
}

interface ContractInfo {
  identifier: string
  propertyName: string
  roomTypeLabel: string
  price: number
  startDate: string
  endDate: string
  durationMonths: number
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
  payment_group_id: string | null
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

// Mensaje de error + detalle técnico copiable, para que el inquilino nos lo pueda
// reenviar tal cual en vez de decir solo "me sale failed to fetch".
function ErrorPanel({ message, details }: { message: string; details: string | null }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyDetails() {
    if (!details) return
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setOpen(true) // sin permiso de portapapeles: que lo seleccione a mano
    }
  }

  return (
    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl">
      <p className="text-xs text-red-700 leading-relaxed">{message}</p>
      {details && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-red-600 underline">
              {open ? "Ocultar detalles" : "Ver detalles técnicos"}
            </button>
            <button type="button" onClick={copyDetails} className="text-xs text-red-600 underline">
              {copied ? "Copiado ✓" : "Copiar y enviar a la administradora"}
            </button>
          </div>
          {open && (
            <pre className="mt-2 p-2 bg-white border border-red-100 rounded-lg text-[10px] leading-relaxed text-red-800 whitespace-pre-wrap break-words select-all overflow-x-auto">
              {details}
            </pre>
          )}
        </>
      )}
    </div>
  )
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
  const [uploadStage, setUploadStage] = useState<"comprimir" | "subir">("subir")
  const [deleting, setDeleting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadErrorDetails, setUploadErrorDetails] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [tenantEmail, setTenantEmail] = useState("")
  const [showAccount, setShowAccount] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  // Pago de varios meses en una sola transferencia (mismo comprobante)
  const [multiMonth, setMultiMonth] = useState(false)
  const [endPeriod, setEndPeriod] = useState<string>("")
  const fileRef = useRef<HTMLInputElement>(null)
  const abonoFileRef = useRef<HTMLInputElement>(null)

  // Estado del flujo de abono
  const [showAbonoForm, setShowAbonoForm] = useState(false)
  const [abonoRequestAmount, setAbonoRequestAmount] = useState("")
  const [abonoPayAmount, setAbonoPayAmount] = useState("")
  const [abonoBusy, setAbonoBusy] = useState(false)
  const [abonoError, setAbonoError] = useState<string | null>(null)
  const [abonoErrorDetails, setAbonoErrorDetails] = useState<string | null>(null)

  // Reportes de problemas
  const [reportCtx, setReportCtx] = useState<{ contractId: string; roomId: string; propertyId: string; tenantName: string } | null>(null)
  const [issues, setIssues] = useState<IssueRow[]>([])
  const [showReport, setShowReport] = useState(false)
  const [reportText, setReportText] = useState("")
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  // Meses cobrables (YYYY-MM): la ventana del CONTRATO EN CURSO, no toda la estadía.
  //
  // `startDate` puede ser histórico — la admin lo usa para llevar track de desde cuándo
  // vive el inquilino (p. ej. 2023), aunque el contrato vigente sea de este año. Por eso
  // la ventana se ancla al final: los últimos `durationMonths` meses hasta `endDate`.
  // Nunca se sale de `startDate` (un contrato no puede cobrar antes de que empezara).
  const contractMonths = useMemo(() => {
    if (!info?.startDate || !info?.endDate) return [] as string[]
    const start = new Date(info.startDate + "T00:00:00")
    const end = new Date(info.endDate + "T00:00:00")
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [] as string[]

    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    if (last < startMonth) return [] as string[]

    // Duración inválida o ausente → toda la estadía (comportamiento anterior).
    const duration = info.durationMonths > 0 ? info.durationMonths : null
    // Se resta `duration` (no `duration - 1`): el rango inicio–fin siempre fue inclusivo
    // en ambos extremos, así que un contrato de N meses abarca N+1 meses de calendario.
    // Mantenerlo así deja intacta la ventana de todos los contratos ya creados.
    let first = duration
      ? new Date(last.getFullYear(), last.getMonth() - duration, 1)
      : startMonth
    if (first < startMonth) first = startMonth

    const months: string[] = []
    const cursor = new Date(first)
    while (cursor <= last) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`)
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return months
  }, [info?.startDate, info?.endDate, info?.durationMonths])

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
      setTenantEmail(user.email ?? "")

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from("tenant_profiles")
        .select("*, contract:contracts!fk_contract(*, room:rooms(id, identifier, property_id, price, property:properties(name), room_type:room_types(label)))")
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
          price: (contract?.monthly_rent as number) ?? (room?.price as number) ?? 0,
          startDate: (contract?.start_date as string) ?? "",
          endDate: (contract?.end_date as string) ?? "",
          durationMonths: (contract?.duration_months as number) ?? 0,
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

  // Optimizar una foto grande toma un par de segundos en un celular lento: que se note
  // que está trabajando y no que se colgó.
  const busyText = uploadStage === "comprimir" ? "Optimizando imagen…" : "Subiendo…"

  // Errores de validación: mensaje solo, sin detalle técnico que copiar.
  function showUploadError(msg: string) { setUploadError(msg); setUploadErrorDetails(null) }
  function clearUploadFeedback() { setUploadError(null); setUploadErrorDetails(null); setUploadNotice(null) }
  function showAbonoError(msg: string | null) { setAbonoError(msg); setAbonoErrorDetails(null) }

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
    // crypto.subtle solo existe en contexto seguro (https). Sin esta guarda, el fallo
    // sale como TypeError y se confundiría con un error de red.
    if (typeof crypto === "undefined" || !crypto.subtle) {
      throw new TenantError("Tu navegador bloqueó el procesamiento del archivo. Abre la página con https en Chrome o Safari actualizado (no dentro de otra app) e intenta de nuevo.")
    }
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Meses que cubre este comprobante: rango si es pago de varios meses, si no el mes activo
    const months = multiMonth ? selectedMonths : (activePeriod ? [activePeriod] : [])
    if (months.length === 0) { showUploadError("Selecciona el mes que vas a pagar."); return }
    if (multiMonth && months.length < 2) {
      showUploadError("Selecciona un rango de al menos dos meses, o desactiva «pagar varios meses».")
      return
    }
    // No permitir incluir meses ya verificados
    const verifiedInRange = months.filter((m) => receipts.find((r) => r.period_month === m)?.verified)
    if (verifiedInRange.length) {
      showUploadError(`Ya tienes pago verificado para ${verifiedInRange.map(periodLabel).join(", ")}. Ajusta el rango.`)
      return
    }
    const wasReplace = months.some((m) => receipts.some((r) => r.period_month === m))
    // Lo que podemos rechazar sin tocar la red, con un mensaje exacto
    const fileProblem = validateReceiptFile(file)
    if (fileProblem) {
      showUploadError(fileProblem)
      if (fileRef.current) fileRef.current.value = ""
      return
    }
    setUploading(true)
    setUploadStage("subir")
    clearUploadFeedback()
    // Paso actual: nos dice cuál de las llamadas de red fue la que falló
    let step: UploadStep = "sesion"
    // El archivo que realmente viaja (comprimido o no); lo usamos al reportar errores
    let toUpload = file
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      if (!user) throw new TenantError("Tu sesión expiró. Toca «Salir» y vuelve a iniciar sesión.")

      step = "contrato"
      const { data: profile, error: profileErr } = await supabase
        .from("tenant_profiles")
        .select("contract_id")
        .eq("id", user.id)
        .single()
      if (profileErr) throw profileErr

      const contractId = (profile as unknown as Record<string, unknown>)?.contract_id as string
      if (!contractId) throw new TenantError("Tu usuario no tiene un contrato activo asociado. Avisa a la administradora para que lo revise.")

      // Anti-fraude: bloquear si el mismo archivo ya se usó para un mes FUERA de este rango.
      // Dentro del rango (misma transferencia) sí se permite reutilizarlo.
      // Ojo: el hash va sobre el archivo ORIGINAL que eligió el inquilino, antes de
      // comprimir, para que la compresión no altere la detección de duplicados.
      const fileHash = await computeHash(file)
      step = "historial"
      const { data: existingReceipts, error: historyErr } = await supabase
        .from("payment_receipts")
        .select("period_month, file_hash")
        .eq("contract_id", contractId)
        .not("file_hash", "is", null)
      if (historyErr) throw historyErr
      const duplicate = (existingReceipts ?? []).find(
        (r) => r.file_hash === fileHash && !months.includes(r.period_month)
      )
      if (duplicate) {
        throw new TenantError(`Este comprobante ya fue enviado para ${periodLabel(duplicate.period_month)}. Sube el comprobante de los meses que vas a pagar.`)
      }

      // Encoger la imagen para que la subida sobreviva a una conexión móvil inestable
      setUploadStage("comprimir")
      const { file: compressedFile, compressed } = await compressImage(file)
      toUpload = compressedFile
      setUploadStage("subir")

      // Un solo archivo; las filas de los meses del rango lo comparten y se agrupan
      const groupId = months.length > 1 ? crypto.randomUUID() : null
      const folder = groupId ? `grupo-${groupId}` : months[0]
      const path = `${user.id}/${folder}/${sanitizeFileName(toUpload.name)}`
      step = "archivo"
      const { error: storageErr } = await supabase.storage.from("receipts").upload(path, toUpload, { upsert: true })
      if (storageErr) throw storageErr

      step = "registro"
      const rows = months.map((m) => ({
        tenant_profile_id: user.id,
        contract_id: contractId,
        period_month: m,
        storage_path: path,
        file_hash: fileHash,
        payment_group_id: groupId,
        verified: false,
        rejected: false,
        rejection_reason: null,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: recs, error: recErr } = await (supabase as any)
        .from("payment_receipts")
        .upsert(rows, { onConflict: "contract_id,period_month" })
        .select()
      if (recErr) throw recErr

      setReceipts((prev) => [...(recs as Receipt[]), ...prev.filter((r) => !months.includes(r.period_month))])
      const sizeNote = compressed ? ` (imagen optimizada: ${formatMB(file.size)} → ${formatMB(toUpload.size)})` : ""
      setUploadNotice(
        (months.length > 1
          ? `Comprobante de ${months.length} meses (${periodLabel(months[0])} – ${periodLabel(months[months.length - 1])}) subido correctamente ✓`
          : wasReplace ? "Comprobante reemplazado correctamente ✓" : "Comprobante subido correctamente ✓") + sizeNote
      )
    } catch (err: unknown) {
      const { message, details } = describeUploadError(err, step, toUpload)
      console.error("handleUpload", { step, err, details })
      setUploadError(message)
      setUploadErrorDetails(details)
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
    clearUploadFeedback()
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { error: delErr } = await supabase
        .from("payment_receipts")
        .delete()
        .eq("id", current.id)
      if (delErr) throw delErr

      // En un pago multi-mes varias filas comparten el mismo archivo; solo borrarlo del storage
      // si ningún otro mes lo sigue referenciando.
      const sharesFile = receipts.some((r) => r.id !== current.id && r.storage_path === current.storage_path)
      if (!sharesFile) {
        const { error: storageErr } = await supabase.storage.from("receipts").remove([current.storage_path])
        if (storageErr) console.error("handleDelete storage", storageErr)
      }

      setReceipts((prev) => prev.filter((r) => r.period_month !== activePeriod))
      setUploadNotice("Comprobante eliminado ✓")
    } catch (err: unknown) {
      const { message, details } = describeUploadError(err, "eliminar", null)
      console.error("handleDelete", { err, details })
      setUploadError(message)
      setUploadErrorDetails(details)
    } finally {
      setDeleting(false)
    }
  }

  async function submitAbono() {
    const amount = Number(abonoRequestAmount)
    if (!activePeriod) { showAbonoError("Selecciona el mes."); return }
    if (!(amount > 0)) { showAbonoError("Ingresa un monto válido."); return }
    setAbonoBusy(true); showAbonoError(null)
    let step: UploadStep = "sesion"
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      if (!user) throw new TenantError("Tu sesión expiró. Toca «Salir» y vuelve a iniciar sesión.")
      step = "contrato"
      const { data: profile, error: profileErr } = await supabase
        .from("tenant_profiles")
        .select("contract_id, room_id")
        .eq("id", user.id)
        .single()
      if (profileErr) throw profileErr
      const p = profile as unknown as Record<string, unknown> | null
      const contractId = p?.contract_id as string
      const roomId = p?.room_id as string

      step = "solicitud"
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
      const { message, details } = describeUploadError(err, step, null)
      console.error("submitAbono", { step, err, details })
      setAbonoError(message)
      setAbonoErrorDetails(details)
    } finally {
      setAbonoBusy(false)
    }
  }

  async function handleAbonoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const req = abonoRequests.find((a) => a.period_month === activePeriod && a.status === "authorized")
    if (!req) { showAbonoError("Aún no tienes un abono autorizado para este mes."); return }
    const amount = Number(abonoPayAmount)
    if (!(amount > 0)) { showAbonoError("Ingresa el monto de este abono."); return }
    const fileProblem = validateReceiptFile(file)
    if (fileProblem) {
      showAbonoError(fileProblem)
      if (abonoFileRef.current) abonoFileRef.current.value = ""
      return
    }
    setAbonoBusy(true); showAbonoError(null)
    let step: UploadStep = "sesion"
    let toUpload = file
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      if (!user) throw new TenantError("Tu sesión expiró. Toca «Salir» y vuelve a iniciar sesión.")
      step = "contrato"
      const { data: profile, error: profileErr } = await supabase
        .from("tenant_profiles")
        .select("contract_id, room_id")
        .eq("id", user.id)
        .single()
      if (profileErr) throw profileErr
      const p = profile as unknown as Record<string, unknown> | null
      const contractId = p?.contract_id as string
      const roomId = p?.room_id as string

      // Hash del original (antes de comprimir), igual que en handleUpload
      const fileHash = await computeHash(file)
      const { file: compressedFile } = await compressImage(file)
      toUpload = compressedFile
      const path = `${user.id}/abonos/${activePeriod}/${crypto.randomUUID()}-${sanitizeFileName(toUpload.name)}`
      step = "archivo"
      const { error: storageErr } = await supabase.storage.from("receipts").upload(path, toUpload, { upsert: false })
      if (storageErr) throw storageErr

      step = "registro"
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
      const { message, details } = describeUploadError(err, step, toUpload)
      console.error("handleAbonoUpload", { step, err, details })
      setAbonoError(message)
      setAbonoErrorDetails(details)
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

  const currentMonth = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`
  })()

  // Total a pagar: primer mes incluye depósito + firma; demás meses solo renta + recurrentes.
  // "Primer mes" = primer mes COBRABLE, no el mes de `start_date`: cuando la admin registra
  // un inquilino antiguo, `start_date` es histórico (p. ej. 2023) y cae fuera de la ventana
  // del contrato en curso — anclar ahí dejaría depósito y firma en un mes invisible.
  const startMonth = contractMonths[0] ?? (info?.startDate ? info.startDate.slice(0, 7) : "")
  const isFirstMonth = startMonth === activePeriod
  const recurringTotal = recurringItems.reduce((s, c) => s + c.amount, 0)
  const oneTimeTotal = oneTimeItems.reduce((s, c) => s + c.amount, 0)
  // Cargos únicos (depósito/firma/otro) y su condonación se facturan en el primer mes
  // del contrato. Si la admin registró la condonación en un mes anterior al primer mes
  // (típico en inquilinos que ingresaron antes del sistema: contrato a futuro, condonación
  // hecha hoy), igual la mostramos junto a los cargos únicos en el primer mes.
  const ONE_TIME_WAIVER_CONCEPTS = ["deposit", "contract_signing", "other"]
  const waiversForMonth = (period: string) => {
    const first = startMonth === period
    return waivers.filter((w) =>
      w.period_month === period ||
      (first && ONE_TIME_WAIVER_CONCEPTS.includes(w.concept) && w.period_month <= startMonth)
    )
  }
  // Total neto a pagar de un mes (renta + recurrentes + únicos si es el primer mes − condonaciones)
  const monthNet = (period: string) => {
    const first = startMonth === period
    const bruto = (info?.price ?? 0) + recurringTotal + (first ? oneTimeTotal : 0)
    const w = waiversForMonth(period).reduce((s, x) => s + x.amount, 0)
    return Math.max(0, bruto - w)
  }

  // Meses cubiertos por el comprobante (rango si es pago de varios meses)
  const selectedMonths = (() => {
    if (!activePeriod) return [] as string[]
    if (!multiMonth || !endPeriod) return [activePeriod]
    const i = contractMonths.indexOf(activePeriod)
    const j = contractMonths.indexOf(endPeriod)
    if (i === -1 || j === -1 || j < i) return [activePeriod]
    return contractMonths.slice(i, j + 1)
  })()

  // Breakdown del mes activo (vista de un solo mes)
  const waiversThisMonth = waiversForMonth(activePeriod)
  const totalToPay = multiMonth
    ? selectedMonths.reduce((s, m) => s + monthNet(m), 0)
    : monthNet(activePeriod)

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
          <div className="flex items-center gap-1">
            <button onClick={() => setShowAccount(true)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <KeyRoundIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cambiar contraseña</span>
            </button>
            <button onClick={handleLogout} disabled={loggingOut}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              Salir
            </button>
          </div>
        </div>
      </header>

      {showAccount && <AccountDialog email={tenantEmail} onClose={() => setShowAccount(false)} />}

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
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Total a pagar{multiMonth && selectedMonths.length > 1
                  ? ` · ${periodLabel(selectedMonths[0])} – ${periodLabel(selectedMonths[selectedMonths.length - 1])}`
                  : activePeriod ? ` · ${periodLabel(activePeriod)}` : ""}
              </p>
              {selectedMonths.includes(startMonth) && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Primer pago</span>
              )}
            </div>
            <div className="space-y-1.5">
              {multiMonth && selectedMonths.length > 1 ? (
                selectedMonths.map((m) => (
                  <div key={`m-${m}`} className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {periodLabel(m)}
                      {m === startMonth && <span className="text-xs text-gray-400"> (incluye depósito/firma)</span>}
                    </span>
                    <span className="text-gray-900">Q{monthNet(m).toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <>
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
                </>
              )}
              <div className="flex justify-between pt-2 mt-1 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Total{multiMonth && selectedMonths.length > 1 ? ` · ${selectedMonths.length} meses` : ""}</span>
                <span className="text-lg font-bold text-[#b64532]">Q{totalToPay.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Upload receipt */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Comprobante de pago</p>

          {/* Contrato vencido: el mes actual quedó fuera de la ventana cobrable.
              Sin este aviso el inquilino solo veía meses pasados y no entendía por qué. */}
          {info && contractMonths.length > 0 && contractMonths[contractMonths.length - 1] < currentMonth && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              Tu contrato vence el {new Date(info.endDate + "T00:00:00").toLocaleDateString("es-GT")} y
              aún no está renovado, por eso no aparece el mes actual. Avisale a la administración para
              que actualice la fecha de fin.
            </div>
          )}

          {/* Selector de mes a pagar */}
          {contractMonths.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1.5">{multiMonth ? "¿Desde qué mes?" : "¿Qué mes vas a pagar?"}</label>
              <select
                value={activePeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value)
                  clearUploadFeedback()
                  // Si el "hasta" quedó antes del nuevo "desde", lo reajustamos
                  if (endPeriod && endPeriod < e.target.value) setEndPeriod(e.target.value)
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
              >
                {contractMonths.map((m) => {
                  const labels = { verified: "✓ pagado", pending: "pendiente", rejected: "✕ rechazado", unpaid: "sin pagar" }
                  return (
                    <option key={m} value={m}>{periodLabel(m)} — {labels[periodStatus(m)]}</option>
                  )
                })}
              </select>

              {multiMonth && (
                <div className="mt-3">
                  <label className="block text-sm text-gray-600 mb-1.5">¿Hasta qué mes?</label>
                  <select
                    value={endPeriod || activePeriod}
                    onChange={(e) => { setEndPeriod(e.target.value); clearUploadFeedback() }}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                  >
                    {contractMonths.filter((m) => m >= activePeriod).map((m) => {
                      const labels = { verified: "✓ pagado", pending: "pendiente", rejected: "✕ rechazado", unpaid: "sin pagar" }
                      return (
                        <option key={m} value={m}>{periodLabel(m)} — {labels[periodStatus(m)]}</option>
                      )
                    })}
                  </select>
                </div>
              )}

              {/* Toggle: pagar varios meses en una sola transferencia */}
              <label className="flex items-center gap-2 mt-3 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={multiMonth}
                  onChange={(e) => {
                    setMultiMonth(e.target.checked)
                    setEndPeriod(e.target.checked ? activePeriod : "")
                    clearUploadFeedback()
                  }}
                  className="rounded border-gray-300 text-[#b64532] focus:ring-[#b64532]/40"
                />
                Pagar varios meses en una sola transferencia
              </label>

              {multiMonth && selectedMonths.length > 1 ? (
                <p className="text-xs text-gray-400 mt-1.5">
                  Cubre {selectedMonths.length} meses: {periodLabel(selectedMonths[0])} – {periodLabel(selectedMonths[selectedMonths.length - 1])}. Sube un solo comprobante por el total.
                </p>
              ) : coverage && (
                <p className="text-xs text-gray-400 mt-1.5">Cubre del {coverage.start} al {coverage.end}</p>
              )}
            </div>
          )}

          {(!multiMonth && hasSelectedMonth) ? (() => {
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
                    {uploading ? busyText : "Subir comprobante corregido"}
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
              <p className="text-sm text-gray-600 mb-3">
                {multiMonth && selectedMonths.length > 1
                  ? `Sube un comprobante por el total de ${selectedMonths.length} meses (${periodLabel(selectedMonths[0])} – ${periodLabel(selectedMonths[selectedMonths.length - 1])}).`
                  : `Sube tu comprobante de pago de ${activePeriod ? periodLabel(activePeriod) : "este mes"}.`}
              </p>
              {multiMonth && selectedMonths.some((m) => receipts.some((r) => r.period_month === m && !r.verified)) && (
                <p className="text-xs text-amber-600 mb-3">Ya hay comprobantes pendientes en este rango; al subir se reemplazarán por este.</p>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-[#b64532] hover:text-[#b64532] transition-colors disabled:opacity-50"
              >
                {uploading ? busyText : "📎 Seleccionar imagen o PDF"}
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
          {uploadError && <ErrorPanel message={uploadError} details={uploadErrorDetails} />}
          {uploadNotice && !uploadError && (
            <p className="text-xs text-green-600 mt-2">{uploadNotice}</p>
          )}
        </div>

        {/* Pagar en partes (abono) — solo para pago de un mes */}
        {info && activePeriod && !hasSelectedMonth && !multiMonth && (
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
                      onClick={() => { setShowAbonoForm(true); showAbonoError(null); setAbonoRequestAmount("") }}
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
                      <button onClick={() => { setShowAbonoForm(false); showAbonoError(null) }}
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

            {abonoError && <ErrorPanel message={abonoError} details={abonoErrorDetails} />}
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
