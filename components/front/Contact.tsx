import { CONFIG } from "@/data/config"
import WaIcon from "./WaIcon"

export default function Contact() {
  return (
    <section className="sec contact-sec" id="contacto">
      <div className="wrap">
        <div className="contact-grid">
          <div className="contact-copy reveal">
            <p className="eyebrow">Contacto</p>
            <h2>¿Te imaginas viviendo aquí?</h2>
            <p>
              Escríbenos. Resolvemos tus dudas, agendamos tu visita y te
              ayudamos a encontrar tu habitación ideal.
            </p>
            <a
              className="btn btn-wa"
              href={CONFIG.wa(CONFIG.waDefault)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WaIcon />
              Escribir por WhatsApp
            </a>
          </div>

          <div className="guardian reveal d1">
            <div className="guardian-top">
              <div className="guardian-av">{CONFIG.guardianName[0]}</div>
              <div>
                <h4>{CONFIG.guardianName}</h4>
                <span>Encargado · Residencial El Maestro</span>
              </div>
            </div>
            <div className="guardian-rows">
              <div className="g-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.5-1.1a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z" />
                </svg>
                <div>
                  <b>{CONFIG.whatsappDisplay}</b>
                  <small>Llamadas y WhatsApp</small>
                </div>
              </div>
              <div className="g-row">
                <WaIcon size={20} />
                <div>
                  <b>WhatsApp directo</b>
                  <small>Respuesta el mismo día</small>
                </div>
              </div>
              <div className="g-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                <div>
                  <b>{CONFIG.hours}</b>
                  <small>{CONFIG.hoursSat}</small>
                </div>
              </div>
            </div>
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
      </div>
    </section>
  )
}
