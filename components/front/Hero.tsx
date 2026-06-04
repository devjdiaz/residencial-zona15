import { CONFIG } from "@/data/config"
import { ROOM_TYPES } from "@/data/roomTypes"
import WaIcon from "./WaIcon"

const heroPhotos = [
  ROOM_TYPES.grande.photos[0],
  ROOM_TYPES.loft.photos[2],
  ROOM_TYPES.estandar.photos[0],
]

export default function Hero() {
  return (
    <header className="hero" id="top">
      <div className="wrap">
        <div className="hero-grid">
          {/* copy */}
          <div className="hero-copy reveal">
            <p className="eyebrow">Habitaciones en renta · Zona 15</p>
            <h1>
              Tu próximo hogar te está esperando en <em>Zona 15</em>
            </h1>
            <p className="hero-sub">
              Habitaciones individuales, cálidas y bien cuidadas, con todos los
              servicios incluidos. Una casa pensada para vivir tranquilo, cerca
              de todo.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-terra" href="#disponibles">
                Ver habitaciones disponibles
              </a>
              <a
                className="btn btn-wa"
                href={CONFIG.wa(CONFIG.waVisit)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WaIcon />
                Agendar visita
              </a>
            </div>
          </div>

          {/* photo grid */}
          <div className="hero-photos reveal d1">
            <div className="ph-main photo-warm" style={{ position: "relative", borderRadius: 20, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroPhotos[0]}
                alt="Habitación principal"
                className="rm-img"
                loading="eager"
              />
              <div className="hero-tag">
                <span className="dot" />
                Disponible ahora
              </div>
            </div>
            <div className="photo-warm" style={{ borderRadius: 20, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroPhotos[1]}
                alt="Loft de 2 niveles"
                className="rm-img"
                loading="eager"
              />
            </div>
            <div className="photo-warm" style={{ borderRadius: 20, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroPhotos[2]}
                alt="Habitación estándar"
                className="rm-img"
                loading="eager"
              />
            </div>
          </div>
        </div>

        {/* trust strip */}
        <div className="trust reveal d2">
          <div className="trust-item">
            <span className="trust-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.5 3v3M16.5 3v3" />
                <rect x="3" y="6" width="18" height="15" rx="2" />
                <path d="M3 11h18" />
              </svg>
            </span>
            <div>
              <h4>Desde Q1,600/mes</h4>
              <p>Precio mensual, referencial</p>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <div>
              <h4>Servicios incluidos</h4>
              <p>Wi-Fi, agua, luz y más</p>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <div>
              <h4>Contratos desde 6 meses</h4>
              <p>Estancia flexible y clara</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
