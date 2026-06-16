"use client"
import { useRouter } from "next/navigation"
import ReportsManager from "@/components/admin/ReportsManager"

export default function GuardianDashboard() {
  const router = useRouter()

  async function handleLogout() {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/guardian/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg grid place-items-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: "#b64532", fontFamily: "Georgia, serif" }}>
              M
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-gray-900 text-sm">Mantenimiento</span>
              <span className="hidden sm:inline text-gray-400 text-xs ml-2">Residencial · Zona 15</span>
            </div>
          </div>
          <button onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Problemas reportados por inquilinos</p>
        </div>
        <ReportsManager />
      </main>
    </div>
  )
}
