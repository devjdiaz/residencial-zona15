"use client"
import { useEffect, useState } from "react"
import { logAudit } from "@/lib/audit"

interface Staff {
  id: string
  email: string
  role: string
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  guardian: "Guardián",
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-amber-50 text-amber-700 border-amber-200",
  guardian: "bg-blue-50 text-blue-700 border-blue-200",
}
const DEFAULT_BADGE = "bg-gray-50 text-gray-600 border-gray-200"

export default function StaffManager({ currentUserId }: { currentUserId: string }) {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "guardian">("admin")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const res = await fetch("/api/admin/list-staff")
    const data = await res.json()
    setStaff(data.staff ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch("/api/admin/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al crear")
      logAudit(`Creó cuenta ${ROLE_LABELS[role]} — ${email}`, "staff", email)
      setShowAdd(false); setEmail(""); setPassword(""); setRole("admin")
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear")
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(s: Staff) {
    if (!confirm(`¿Eliminar la cuenta de ${s.email}?`)) return
    const res = await fetch("/api/admin/delete-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: s.id }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? "Error al eliminar"); return }
    logAudit(`Eliminó cuenta admin — ${s.email}`, "staff", s.email)
    setStaff((p) => p.filter((x) => x.id !== s.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(!showAdd)}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#b64532] text-white font-medium hover:bg-[#9a3727] transition-colors">
          + Agregar cuenta
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                placeholder="admin@ejemplo.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
              <input type="text" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
                placeholder="mín. 8 caracteres" minLength={8} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
              <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "guardian")}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40">
                <option value="admin">Admin — acceso a todo el panel</option>
                <option value="guardian">Guardián — solo ve y gestiona Reportes</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy}
              className="px-4 py-1.5 rounded-lg bg-[#b64532] text-white text-xs font-medium disabled:opacity-60">
              {busy ? "Creando…" : "Crear cuenta"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-xs text-gray-400">Cargando…</div>
      ) : (
        <>
          {/* Tabla — md+ */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 font-medium">Correo</th>
                  <th className="text-left px-4 py-2.5 font-medium">Rol</th>
                  <th className="text-right px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 text-gray-800">{s.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_BADGE[s.role] ?? DEFAULT_BADGE}`}>
                        {ROLE_LABELS[s.role] ?? s.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {s.role !== "super_admin" && s.id !== currentUserId && (
                        <button onClick={() => handleDelete(s)}
                          className="text-xs text-red-600 hover:underline">Eliminar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas — móvil */}
          <div className="md:hidden space-y-2">
            {staff.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{s.email}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full border ${ROLE_BADGE[s.role] ?? DEFAULT_BADGE}`}>
                    {ROLE_LABELS[s.role] ?? s.role}
                  </span>
                </div>
                {s.role !== "super_admin" && s.id !== currentUserId && (
                  <button onClick={() => handleDelete(s)}
                    className="text-xs text-red-600 hover:underline flex-shrink-0">Eliminar</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
