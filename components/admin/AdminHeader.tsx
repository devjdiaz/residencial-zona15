"use client"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import AccountDialog from "./AccountDialog"

export default function AdminHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const [email, setEmail] = useState<string>("")
  const [openIssues, setOpenIssues] = useState(0)
  const [showAccount, setShowAccount] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    async function load() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
      const { createClient } = await import("@/lib/supabase/client")
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      setRole((user?.user_metadata?.role as string) ?? null)
      setEmail(user?.email ?? "")
      const { count } = await sb
        .from("issue_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
      setOpenIssues(count ?? 0)
    }
    load()
  }, [pathname])

  async function handleLogout() {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
    router.refresh()
  }

  const isSuper = role === "super_admin"

  const linkClass = (href: string) =>
    `text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
      pathname === href ? "text-gray-900 bg-gray-100" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
    }`

  // Áreas táctiles más cómodas en el menú móvil apilado
  const mobileLinkClass = (href: string) =>
    `block text-sm font-medium px-3 py-2.5 rounded-lg transition-colors ${
      pathname === href ? "text-gray-900 bg-gray-100" : "text-gray-700 hover:bg-gray-50"
    }`

  const reportesBadge = openIssues > 0 && (
    <span className="ml-1.5 inline-grid min-w-[16px] h-4 px-1 rounded-full bg-[#b64532] text-white text-[10px] font-bold place-items-center align-middle">
      {openIssues}
    </span>
  )

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg grid place-items-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: "#b64532", fontFamily: "Georgia, serif" }}>
            M
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-gray-900 text-sm">El Maestro Admin</span>
            <span className="hidden sm:inline text-gray-400 text-xs ml-2">Residencial · Zona 15</span>
          </div>
        </div>

        {/* Nav escritorio (lg+) — sin cambios respecto al diseño actual */}
        <div className="hidden lg:flex items-center gap-1">
          <a href="/admin/rooms" className={linkClass("/admin/rooms")}>Habitaciones</a>
          <a href="/admin/finances" className={linkClass("/admin/finances")}>Finanzas</a>
          <a href="/admin/reportes" className={`${linkClass("/admin/reportes")} relative`}>
            Reportes
            {openIssues > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#b64532] text-white text-[10px] font-bold grid place-items-center">
                {openIssues}
              </span>
            )}
          </a>
          <a href="/admin/historial" className={linkClass("/admin/historial")}>Historial</a>
          {isSuper && <a href="/admin/bitacora" className={linkClass("/admin/bitacora")}>Bitácora</a>}
          {isSuper && <a href="/admin/personal" className={linkClass("/admin/personal")}>Personal</a>}
          <button onClick={() => setShowAccount(true)}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            Mi cuenta
          </button>
          <button onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            Salir
          </button>
        </div>

        {/* Botón hamburguesa (<lg) */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menú"
          aria-expanded={menuOpen}
          className="lg:hidden relative w-9 h-9 -mr-1 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          )}
          {!menuOpen && openIssues > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#b64532]" />
          )}
        </button>
      </div>

      {/* Menú desplegable móvil (<lg) */}
      {menuOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-2 space-y-0.5">
            <a href="/admin/rooms" className={mobileLinkClass("/admin/rooms")}>Habitaciones</a>
            <a href="/admin/finances" className={mobileLinkClass("/admin/finances")}>Finanzas</a>
            <a href="/admin/reportes" className={mobileLinkClass("/admin/reportes")}>
              Reportes{reportesBadge}
            </a>
            <a href="/admin/historial" className={mobileLinkClass("/admin/historial")}>Historial</a>
            {isSuper && <a href="/admin/bitacora" className={mobileLinkClass("/admin/bitacora")}>Bitácora</a>}
            {isSuper && <a href="/admin/personal" className={mobileLinkClass("/admin/personal")}>Personal</a>}
            <div className="pt-1 mt-1 border-t border-gray-100">
              <button onClick={() => { setMenuOpen(false); setShowAccount(true) }}
                className="block w-full text-left text-sm text-gray-600 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                Mi cuenta
              </button>
              <button onClick={handleLogout}
                className="block w-full text-left text-sm text-gray-600 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                Salir
              </button>
            </div>
          </nav>
        </div>
      )}

      {showAccount && <AccountDialog email={email} onClose={() => setShowAccount(false)} />}
    </header>
  )
}
