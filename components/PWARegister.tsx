"use client"
import { useEffect } from "react"

// Registra el service worker para habilitar la PWA instalable + Web Push.
export default function PWARegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("sw register", err)
    })
  }, [])
  return null
}
