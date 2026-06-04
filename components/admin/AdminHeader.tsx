"use client"
import { useRouter } from "next/navigation"

export default function AdminHeader() {
  const router = useRouter()

  async function handleLogout() {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
    router.refresh()
  }

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg grid place-items-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: "#b64532", fontFamily: "Georgia, serif" }}
          >
            M
          </div>
          <div>
            <span className="font-semibold text-gray-900 text-sm">El Maestro Admin</span>
            <span className="hidden sm:inline text-gray-400 text-xs ml-2">Residencial · Zona 15</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/rooms"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Habitaciones
          </a>
          <a
            href="/admin/finances"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Finanzas
          </a>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
