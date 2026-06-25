"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { enablePush, disablePush, currentSubscription, pushSupported, isIOS, isStandalone, VAPID_PUBLIC_KEY } from "@/lib/push"

interface Notif {
  id: string
  type: string
  title: string
  body: string | null
  url: string | null
  read: boolean
  created_at: string
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "hace un momento"
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24); return `hace ${d} d`
}

type PushState = "loading" | "unsupported" | "needs-install" | "not-configured" | "off" | "on"

export default function NotificationsBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [pushState, setPushState] = useState<PushState>("loading")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const unread = items.filter((n) => !n.read).length

  // Estado del push (sin tocar BD)
  useEffect(() => {
    (async () => {
      if (!pushSupported()) { setPushState("unsupported"); return }
      if (!VAPID_PUBLIC_KEY) { setPushState("not-configured"); return }
      if (isIOS() && !isStandalone()) { setPushState("needs-install"); return }
      const sub = await currentSubscription()
      setPushState(sub ? "on" : "off")
    })()
  }, [])

  // Cargar historial + realtime (degrada en silencio si la tabla aún no existe)
  useEffect(() => {
    let channel: { unsubscribe: () => void } | null = null
    ;(async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
      const { createClient } = await import("@/lib/supabase/client")
      const sb = createClient()
      const { data, error } = await sb
        .from("notifications")
        .select("id, type, title, body, url, read, created_at")
        .order("created_at", { ascending: false })
        .limit(30)
      if (error) return // tabla aún no creada → sin historial
      setItems((data as Notif[]) ?? [])
      channel = sb
        .channel("admin-notifications")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
          setItems((prev) => [payload.new as Notif, ...prev].slice(0, 30))
        })
        .subscribe()
    })()
    return () => { channel?.unsubscribe() }
  }, [])

  // Cerrar al hacer click afuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  async function markRead(ids: string[]) {
    setItems((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, read: true } : n))
    const { createClient } = await import("@/lib/supabase/client")
    await createClient().from("notifications").update({ read: true }).in("id", ids)
  }

  async function onItemClick(n: Notif) {
    if (!n.read) markRead([n.id])
    setOpen(false)
    if (n.url) router.push(n.url)
  }

  async function togglePush() {
    setBusy(true); setMsg(null)
    try {
      if (pushState === "on") {
        await disablePush(); setPushState("off")
      } else {
        const r = await enablePush()
        if (r.ok) { setPushState("on"); setMsg("Notificaciones activadas ✓") }
        else setMsg(r.error ?? "No se pudo activar.")
      }
    } finally { setBusy(false) }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#b64532] text-white text-[10px] font-bold grid place-items-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-gray-100 shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notificaciones</span>
            {unread > 0 && (
              <button onClick={() => markRead(items.filter((n) => !n.read).map((n) => n.id))}
                className="text-xs text-[#24577a] hover:underline">Marcar leídas</button>
            )}
          </div>

          {/* Activar push / instructivo iOS */}
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
            {pushState === "needs-install" ? (
              <p className="text-xs text-gray-600">
                📲 Para recibir avisos en el iPhone: toca <strong>Compartir</strong> → <strong>Agregar a pantalla de inicio</strong>, y abre la app desde ahí.
              </p>
            ) : pushState === "not-configured" ? (
              <p className="text-xs text-gray-400">Notificaciones aún no configuradas en el servidor.</p>
            ) : pushState === "unsupported" ? (
              <p className="text-xs text-gray-400">Este navegador no soporta notificaciones.</p>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-600">{pushState === "on" ? "Avisos al teléfono activados" : "Recibe avisos en tu teléfono"}</span>
                <button onClick={togglePush} disabled={busy || pushState === "loading"}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${pushState === "on" ? "border-gray-200 text-gray-600 hover:bg-gray-100" : "border-[#b64532] text-[#b64532] hover:bg-[#b64532]/5"}`}>
                  {pushState === "on" ? "Desactivar" : "Activar"}
                </button>
              </div>
            )}
            {msg && <p className="text-xs text-gray-500 mt-1.5">{msg}</p>}
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Sin notificaciones.</p>
            ) : items.map((n) => (
              <button key={n.id} onClick={() => onItemClick(n)}
                className={`block w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors ${n.read ? "" : "bg-[#b64532]/[0.03]"}`}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#b64532] flex-shrink-0" />}
                  <div className={`min-w-0 ${n.read ? "pl-3.5" : ""}`}>
                    <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-500 truncate">{n.body}</p>}
                    <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
