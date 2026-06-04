"use client"
import { useEffect, useRef } from "react"

interface Props {
  photos: string[]
  alt: string
}

export default function MiniCarousel({ photos, alt }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const track = trackRef.current
    const dotsWrap = navRef.current
    if (!track || !dotsWrap) return

    dotsWrap.innerHTML = ""
    const dots: HTMLButtonElement[] = []

    photos.forEach((_, i) => {
      const b = document.createElement("button")
      b.className = "mini-dot" + (i === 0 ? " active" : "")
      b.setAttribute("aria-label", `Foto ${i + 1}`)
      b.addEventListener("click", () =>
        track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" })
      )
      dotsWrap.appendChild(b)
      dots.push(b)
    })

    const update = () => {
      const idx = Math.round(track.scrollLeft / track.clientWidth)
      dots.forEach((d, i) => d.classList.toggle("active", i === idx))
    }

    track.addEventListener("scroll", update, { passive: true })
    return () => {
      track.removeEventListener("scroll", update)
      dotsWrap.innerHTML = ""
    }
  }, [photos])

  const scrollBy = (dir: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: dir * track.clientWidth, behavior: "smooth" })
  }

  return (
    <div className="mini-car-wrap photo-warm">
      <div className="mini-car" ref={trackRef}>
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt={`${alt} — foto ${i + 1}`} loading="lazy" />
        ))}
      </div>
      <button className="mini-arrow prev" aria-label="Anterior" onClick={() => scrollBy(-1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button className="mini-arrow next" aria-label="Siguiente" onClick={() => scrollBy(1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      <div className="mini-nav" ref={navRef} />
    </div>
  )
}
