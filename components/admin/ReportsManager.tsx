"use client"
import { useEffect, useState } from "react"
import type { IssueReport, IssueStatus } from "@/lib/supabase/types"
import { logAudit } from "@/lib/audit"

type ReportRow = IssueReport & {
  room?: { identifier: string } | null
  property?: { name: string } | null
}

const STATUS_META: Record<IssueStatus, { label: string; badge: string }> = {
  open:        { label: "Abierto",    badge: "bg-amber-50 text-amber-700 border-amber-200" },
  in_progress: { label: "En proceso", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  resolved:    { label: "Resuelto",   badge: "bg-green-50 text-green-700 border-green-200" },
}

const FILTERS: { key: IssueStatus | "all"; label: string }[] = [
  { key: "open", label: "Abiertos" },
  { key: "in_progress", label: "En proceso" },
  { key: "resolved", label: "Resueltos" },
  { key: "all", label: "Todos" },
]

export default function ReportsManager() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<IssueStatus | "all">("open")

  async function load() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { setLoading(false); return }
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const { data } = await sb
      .from("issue_reports")
      .select("*, room:rooms(identifier), property:properties(name)")
      .order("created_at", { ascending: false })
    setReports((data as ReportRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setStatus(r: ReportRow, status: IssueStatus) {
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const patch: Partial<IssueReport> = { status, resolved_at: status === "resolved" ? new Date().toISOString() : null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from("issue_reports").update(patch).eq("id", r.id)
    setReports((p) => p.map((x) => x.id === r.id ? { ...x, ...patch } : x))
    logAudit(`Reporte ${STATUS_META[status].label.toLowerCase()} — Hab. ${r.room?.identifier ?? ""} (${r.property?.name ?? ""})`, "report", r.room?.identifier)
  }

  const shown = filter === "all" ? reports : reports.filter((r) => r.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? reports.length : reports.filter((r) => r.status === f.key).length
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key ? "bg-[#b64532] text-white" : "text-gray-600 hover:bg-gray-50"
              }`}>
              {f.label}{count > 0 ? ` (${count})` : ""}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Sin reportes en esta vista.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span className="text-sm font-semibold text-gray-900">Hab. {r.room?.identifier ?? "—"}</span>
                  <span className="text-xs text-gray-400 ml-2">{r.property?.name ?? ""} · {r.tenant_name ?? ""}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_META[r.status].badge}`}>
                  {STATUS_META[r.status].label}
                </span>
              </div>
              <p className="text-sm text-gray-700">{r.description}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <div className="flex gap-1.5">
                  {r.status === "open" && (
                    <button onClick={() => setStatus(r, "in_progress")}
                      className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">
                      Marcar en proceso
                    </button>
                  )}
                  {r.status !== "resolved" && (
                    <button onClick={() => setStatus(r, "resolved")}
                      className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
                      Marcar resuelto
                    </button>
                  )}
                  {r.status === "resolved" && (
                    <button onClick={() => setStatus(r, "open")}
                      className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                      Reabrir
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
