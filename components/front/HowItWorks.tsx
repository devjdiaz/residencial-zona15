const STEPS = [
  {
    num: "1",
    label: "Contáctanos",
    desc: "Escríbenos por WhatsApp y cuéntanos qué buscas. Te respondemos el mismo día.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    num: "2",
    label: "Agenda una visita",
    desc: "Conoce la casa y la habitación en persona. Resolvemos todas tus dudas en el momento.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    num: "3",
    label: "Firma tu contrato",
    desc: "Contrato claro desde 6 meses. Firmas, recibes tu llave y te mudas cuando quieras.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3v5h5" />
        <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    ),
  },
]

export default function HowItWorks() {
  return (
    <section className="sec" id="como-funciona">
      <div className="wrap">
        <div className="sec-head center reveal">
          <p className="eyebrow teal">Sencillo y claro</p>
          <h2>Cómo rentar tu habitación</h2>
          <p>Tres pasos y listo. Sin trámites eternos ni letras chiquitas.</p>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s.num} className={`step reveal d${i + 1}`}>
              <div className="step-ic">
                <span className="step-num">{s.num}</span>
                {s.icon}
              </div>
              <h4>{s.label}</h4>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
