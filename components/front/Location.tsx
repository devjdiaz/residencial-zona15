import { CONFIG } from "@/data/config"

export default function Location() {
  return (
    <section className="sec" id="ubicacion">
      <div className="wrap">
        <div className="sec-head reveal">
          <p className="eyebrow teal">Ubicación</p>
          <h2>En el corazón de la Zona 15</h2>
          <p>
            Cerca de universidades, centros comerciales y rutas principales.
            Bien conectado con toda la ciudad.
          </p>
        </div>

        <div className="loc-grid reveal d1">
          <div className="loc-map">
            <iframe
              title="Mapa Residencial El Maestro — Zona 15"
              src={CONFIG.mapsEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="loc-info">
            <h3>Residencial El Maestro</h3>
            <p className="loc-addr">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span>
                {CONFIG.address}
                <br />
                <small style={{ color: "var(--ink-faint)" }}>
                  Dirección exacta al confirmar tu visita
                </small>
              </span>
            </p>
            <div className="loc-btns">
              <a
                className="btn btn-terra"
                href={CONFIG.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                Abrir en Google Maps
              </a>
              <a
                className="btn btn-ghost"
                href={CONFIG.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l18-8-8 18-2-8-8-2z" />
                </svg>
                Cómo llegar (Waze)
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
