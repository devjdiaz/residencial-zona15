import { redirect } from "next/navigation"
import AdminHeader from "@/components/admin/AdminHeader"
import { createClient } from "@/lib/supabase/server"
import type { AuditLog } from "@/lib/supabase/types"

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
}

export default async function BitacoraPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <p className="p-8 text-sm text-gray-400">Configura Supabase.</p>
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.user_metadata?.role !== "super_admin") {
    redirect("/admin/rooms")
  }

  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .order("ticket", { ascending: false })
    .limit(200)
  const logs = (data as AuditLog[] | null) ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Bitácora</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registro de acciones del backoffice (últimas 200)</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium">Ticket</th>
                <th className="text-left px-4 py-2.5 font-medium">Fecha y hora</th>
                <th className="text-left px-4 py-2.5 font-medium">Usuario</th>
                <th className="text-left px-4 py-2.5 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-xs">Sin registros aún</td></tr>
              )}
              {logs.map((l) => (
                <tr key={l.ticket} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400">#{String(l.ticket).padStart(5, "0")}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    <div className="text-gray-800">{l.actor_email ?? "—"}</div>
                    <div className="text-xs text-gray-400">{ROLE_LABELS[l.actor_role ?? ""] ?? l.actor_role}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{l.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
