const SERVICES = [
  {
    label: "Wi-Fi de fibra",
    desc: "Internet rápido y estable en toda la casa.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5a10 10 0 0114 0" />
        <path d="M8.5 16a5 5 0 017 0" />
        <path d="M2 9a15 15 0 0120 0" />
        <circle cx="12" cy="19" r="1" />
      </svg>
    ),
  },
  {
    label: "Agua caliente",
    desc: "Duchas con agua caliente las 24 horas.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3s5 5 5 9a5 5 0 01-10 0c0-4 5-9 5-9z" />
      </svg>
    ),
  },
  {
    label: "Limpieza de áreas comunes",
    desc: "Espacios compartidos siempre cuidados.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 3l4 4-7 7-4-4 7-7z" />
        <path d="M10 7l-6 6v4h4l6-6" />
        <path d="M14 18l1 2M18 16l1 2M16 21l1 1" />
      </svg>
    ),
  },
  {
    label: "Cocina equipada",
    desc: "Estufa, refri y todo para cocinar a gusto.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3v8M3 3v3a2 2 0 002 2M7 3v3a2 2 0 01-2 2M16 3a3 5 0 00-3 5c0 2 1 3 3 3v10M5 11v10" />
      </svg>
    ),
  },
  {
    label: "Área de lavandería",
    desc: "Lavadora disponible para residentes.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l-2 4H8L6 3z" />
        <rect x="4" y="7" width="16" height="14" rx="2" />
        <circle cx="12" cy="14" r="4" />
      </svg>
    ),
  },
  {
    label: "Seguridad 24/7",
    desc: "Acceso controlado y vigilancia constante.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Energía eléctrica",
    desc: "Luz incluida en tu renta mensual.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    ),
  },
  {
    label: "Áreas comunes",
    desc: "Sala y comedor para compartir o relajarte.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h18M5 12V8a2 2 0 012-2h10a2 2 0 012 2v4M4 18v-3a2 2 0 012-2h12a2 2 0 012 2v3M5 18v2M19 18v2" />
      </svg>
    ),
  },
]

export default function ServicesGrid() {
  return (
    <section className="sec avail" id="servicios">
      <div className="wrap">
        <div className="sec-head center reveal">
          <p className="eyebrow">Todo incluido</p>
          <h2>Lo que ya viene con tu habitación</h2>
          <p>
            Sin sorpresas ni cuotas escondidas. Llegas con tus cosas y la casa
            hace el resto.
          </p>
        </div>
        <div className="serv-grid reveal d1">
          {SERVICES.map((s) => (
            <div key={s.label} className="serv">
              <span className="serv-ic">{s.icon}</span>
              <h4>{s.label}</h4>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
