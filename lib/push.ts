// Helpers de Web Push (lado cliente) para el panel admin.

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

// ¿Corre como PWA instalada (agregada a inicio)? En iOS el push SOLO funciona así.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

// Pide permiso, se suscribe y guarda la suscripción en el servidor.
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: "Tu navegador no soporta notificaciones." }
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: "Falta configurar la clave VAPID (servidor)." }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return { ok: false, error: "Permiso de notificaciones denegado." }

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })

  const json = sub.toJSON()
  const res = await fetch("/api/admin/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userAgent: navigator.userAgent,
    }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    return { ok: false, error: d.error ?? "No se pudo guardar la suscripción." }
  }
  return { ok: true }
}

export async function disablePush(): Promise<{ ok: boolean; error?: string }> {
  const sub = await currentSubscription()
  if (!sub) return { ok: true }
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => {})
  await fetch("/api/admin/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {})
  return { ok: true }
}
