import { CONFIG } from "@/data/config"
import WaIcon from "./WaIcon"

export default function FloatingWhatsApp() {
  return (
    <a
      className="fab"
      href={CONFIG.wa(CONFIG.waDefault)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
    >
      <WaIcon size={30} />
    </a>
  )
}
