export default function Conditions() {
  return (
    <section className="sec avail" id="condiciones">
      <div className="wrap">
        <div className="sec-head reveal">
          <p className="eyebrow">Transparencia</p>
          <h2>Condiciones, sin enredos</h2>
          <p>
            Para que sepas exactamente en qué te estás metiendo, desde el primer
            mensaje.
          </p>
        </div>

        <div className="cond-grid reveal d1">
          <div className="cond">
            <span className="cond-ic">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 9h18M8 3v4M16 3v4" />
              </svg>
            </span>
            <div>
              <h4>Duración mínima: 6 meses</h4>
              <p>
                Contratos pensados para estancias estables, con opción a
                renovar.
              </p>
            </div>
          </div>

          <div className="cond">
            <span className="cond-ic">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0116 0" />
              </svg>
            </span>
            <div>
              <h4>Perfil residente individual</h4>
              <p>
                Espacios para una persona por habitación. Ambiente tranquilo y
                respetuoso.
              </p>
            </div>
          </div>

          <div className="cond">
            <span className="cond-ic">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7h18v12H3z" />
                <path d="M3 11h18" />
                <circle cx="17" cy="15" r="1" />
              </svg>
            </span>
            <div>
              <h4>Depósito</h4>
              <p>
                Reembolsable al finalizar, sujeto al estado de la habitación.
              </p>
            </div>
          </div>

          <div className="cond">
            <span className="cond-ic">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <div>
              <h4>Pago mensual anticipado</h4>
              <p>
                La renta se cubre al inicio de cada mes. Servicios ya incluidos.
              </p>
            </div>
          </div>
        </div>

        <div className="rm-alert reveal d2">
          <span className="rm-alert-ic">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
            </svg>
          </span>
          <div>
            <strong>Espacio solo para residentes individuales</strong>
            <p>
              No se admiten mascotas ni parejas. Buscamos mantener un ambiente
              cómodo y armonioso para todos.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
