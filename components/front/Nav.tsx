"use client"
import { useEffect, useRef, useState } from "react"
import { CONFIG } from "@/data/config"
import WaIcon from "./WaIcon"

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <nav ref={navRef} className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="nav-inner">
          <a className="brand" href="#top" aria-label="Residencial El Maestro">
            <span className="brand-mark">M</span>
            <span className="brand-name">
              El Maestro<small>Residencial · Zona 15</small>
            </span>
          </a>

          <div className="nav-links">
            <a href="#disponibles">Disponibles</a>
            <a href="#habitaciones">Habitaciones</a>
            <a href="#servicios">Servicios</a>
            <a href="#ubicacion">Ubicación</a>
            <a href="#contacto">Contacto</a>
          </div>

          <div className="nav-cta">
            <a className="btn btn-ghost btn-sm" href="#disponibles">
              Ver disponibles
            </a>
            <a
              className="btn btn-wa btn-sm"
              href={CONFIG.wa(CONFIG.waDefault)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WaIcon />
              WhatsApp
            </a>
            <button
              className="nav-burger"
              aria-label="Menú"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
        <a href="#disponibles" onClick={closeMenu}>Disponibles</a>
        <a href="#habitaciones" onClick={closeMenu}>Habitaciones</a>
        <a href="#servicios" onClick={closeMenu}>Servicios</a>
        <a href="#ubicacion" onClick={closeMenu}>Ubicación</a>
        <a href="#contacto" onClick={closeMenu}>Contacto</a>
        <a
          className="btn btn-wa"
          href={CONFIG.wa(CONFIG.waDefault)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeMenu}
        >
          Escribir por WhatsApp
        </a>
      </div>
    </>
  )
}
