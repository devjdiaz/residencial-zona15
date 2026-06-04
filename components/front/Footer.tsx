export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-inner">
          <div>
            <a className="brand" href="#top" style={{ marginBottom: 14, display: "inline-flex" }}>
              <span className="brand-mark">M</span>
              <span className="brand-name">
                El Maestro<small>Residencial · Zona 15</small>
              </span>
            </a>
            <p className="footer-note">
              Habitaciones individuales en renta en Zona 15, Ciudad de
              Guatemala. Un hogar bien cuidado, con servicios incluidos y trato
              cercano.
            </p>
          </div>
          <nav className="nav-links" style={{ flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
            <a href="#disponibles">Disponibles</a>
            <a href="#habitaciones">Habitaciones</a>
            <a href="#servicios">Servicios</a>
            <a href="#ubicacion">Ubicación</a>
            <a href="#contacto">Contacto</a>
          </nav>
        </div>
        <div className="footer-legal">
          <span>© {year} Residencial El Maestro · Zona 15, Ciudad de Guatemala</span>
          <span>Precios e imágenes referenciales. Disponibilidad sujeta a cambios.</span>
        </div>
      </div>
    </footer>
  )
}
