import { CONFIG } from "@/data/config"
import { ROOM_TYPES } from "@/data/roomTypes"
import MiniCarousel from "./MiniCarousel"
import WaIcon from "./WaIcon"

const SHOWCASES = [
  {
    ...ROOM_TYPES.grande,
    waMsg: `Hola Julio, me interesa la Habitación Grande (Q2,500/mes) del Residencial El Maestro.`,
    flip: false,
  },
  {
    ...ROOM_TYPES.loft,
    waMsg: `Hola Julio, me interesa el Loft de 2 Niveles (Q3,000/mes) del Residencial El Maestro.`,
    flip: true,
  },
  {
    ...ROOM_TYPES.estandar,
    waMsg: `Hola Julio, me interesa la Habitación Estándar (Q2,000/mes) del Residencial El Maestro.`,
    flip: false,
  },
  {
    ...ROOM_TYPES.pequena,
    waMsg: `Hola Julio, me interesa la Habitación Pequeña (Q1,600/mes) del Residencial El Maestro.`,
    flip: true,
  },
]

function FeaturePill({ label }: { label: string }) {
  return (
    <span className="feat-pill">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {label}
    </span>
  )
}

export default function RoomShowcases() {
  return (
    <section className="sec" id="habitaciones">
      <div className="wrap">
        <div className="sec-head reveal">
          <p className="eyebrow">Tipos de habitación</p>
          <h2>Elige el espacio que va contigo</h2>
          <p>
            Cada habitación tiene su carácter. Mira los detalles y quédate con
            la que se sienta tuya.
          </p>
        </div>

        {SHOWCASES.map((room) => (
          <div key={room.slug} className={`showcase${room.flip ? " flip" : ""} reveal`}>
            <div className="showcase-media">
              <MiniCarousel photos={room.photos.slice(0, 6)} alt={room.label} />
            </div>
            <div className="showcase-copy">
              <p className="eyebrow sage">{room.eyebrow}</p>
              <h3>{room.label}</h3>
              <div className="showcase-price">
                Q{room.price.toLocaleString()} <span>/ mes</span>
              </div>
              <p>{room.description}</p>
              <div className="showcase-feats">
                {room.features.map((f) => (
                  <FeaturePill key={f.label} label={f.label} />
                ))}
              </div>
              <a
                className="btn btn-terra"
                href={CONFIG.wa(room.waMsg)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Me interesa esta habitación →
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
