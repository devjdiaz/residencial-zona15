import type { MetadataRoute } from "next"

// PWA instalable del panel admin. El admin la agrega a su pantalla de inicio
// (ícono "M" sobre #b64532) y desde ahí recibe Web Push.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "El Maestro Admin",
    short_name: "El Maestro",
    description: "Panel de administración — Residencial El Maestro, Zona 15.",
    start_url: "/admin/historial",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#b64532",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
