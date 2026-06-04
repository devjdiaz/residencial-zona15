"use client"
import { useEffect, useRef, useState } from "react"
import { CONFIG } from "@/data/config"
import { ROOM_TYPES } from "@/data/roomTypes"
import type { Room } from "@/lib/supabase/types"
import WaIcon from "./WaIcon"

/* Fallback photos shown before Supabase is configured */
const FALLBACK_ROOMS = [
  {
    id: "fallback-1",
    identifier: "A",
    status: "available" as const,
    property: { name: "El Maestro" },
    room_type: { slug: "loft", label: "Loft de 2 Niveles", price: 3000 },
  },
  {
    id: "fallback-2",
    identifier: "5",
    status: "available" as const,
    property: { name: "El Maestro" },
    room_type: { slug: "grande", label: "Habitación Grande", price: 2500 },
  },
  {
    id: "fallback-3",
    identifier: "12",
    status: "available" as const,
    property: { name: "Tecún" },
    room_type: { slug: "estandar", label: "Habitación Estándar", price: 2000 },
  },
]

type AvailRoom = Pick<Room, "id" | "identifier" | "status"> & {
  property?: { name: string }
  room_type?: { slug: string; label: string; price: number }
}

function getPhotos(slug: string): readonly string[] {
  const key = slug as keyof typeof ROOM_TYPES
  return ROOM_TYPES[key]?.photos ?? []
}

function RoomCard({ room }: { room: AvailRoom }) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const photos = getPhotos(room.room_type?.slug ?? "")
  const slug = room.room_type?.slug ?? "estandar"
  const waMsg = `Hola Julio, me interesa la Habitación ${room.identifier} (${room.room_type?.label ?? "habitación"} - Q${room.room_type?.price?.toLocaleString()}/mes) en Residencial ${room.property?.name ?? "El Maestro"}.`

  return (
    <article className="room-card">
      <div className="room-photo photo-warm">
        <span className="badge">
          <span className="live-dot" />
          Disponible
        </span>
        <span className="price-chip">
          Q{room.room_type?.price?.toLocaleString()}/mes
        </span>
        {photos.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photos[photoIdx % photos.length]}
            alt={`Habitación ${room.identifier}`}
            loading="lazy"
            onError={(e) => {
              const next = (photoIdx + 1) % photos.length
              if (next !== photoIdx) setPhotoIdx(next)
              else (e.target as HTMLImageElement).style.display = "none"
            }}
          />
        ) : (
          <div className="img-slot" style={{ width: "100%", height: "100%" }}>
            {room.room_type?.label}
          </div>
        )}
        <div className="room-overlay">
          <h3>
            {room.room_type?.label ?? "Habitación"} {room.identifier}
          </h3>
          <span>{room.property?.name} · Zona 15</span>
        </div>
      </div>
      <div className="room-body">
        <div className="room-feats">
          <span className="feat-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M3 18v-2a4 4 0 014-4h10a4 4 0 014 4v2" />
              <path d="M3 18h18" />
              <path d="M7 12V8a2 2 0 012-2h6a2 2 0 012 2v4" />
            </svg>
            {slug === "pequena" || slug === "estandar" ? "Cama individual" : "Cama matrimonial"}
          </span>
          {(slug === "grande" || slug === "loft") && (
            <span className="feat-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10V6a5 5 0 0110 0v4" />
                <rect x="4" y="10" width="16" height="11" rx="2" />
              </svg>
              Baño privado
            </span>
          )}
          <span className="feat-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Servicios incluidos
          </span>
        </div>
        <a
          className="btn btn-wa btn-sm btn-block"
          href={CONFIG.wa(waMsg)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WaIcon />
          Consultar esta habitación
        </a>
      </div>
    </article>
  )
}

export default function AvailabilitySection() {
  const [rooms, setRooms] = useState<AvailRoom[]>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ? [] : (FALLBACK_ROOMS as AvailRoom[])
  )
  const [loading, setLoading] = useState(!!process.env.NEXT_PUBLIC_SUPABASE_URL)
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null

    async function load() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setRooms(FALLBACK_ROOMS as AvailRoom[])
        setLoading(false)
        return
      }
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()

        const { data } = await supabase
          .from("rooms")
          .select("id, identifier, status, property:properties(name), room_type:room_types(slug, label, price)")
          .eq("status", "available")
          .order("sort_order")

        setRooms((data as AvailRoom[] | null) ?? [])
        setLoading(false)

        sub = supabase
          .channel("rooms-availability")
          .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
            supabase
              .from("rooms")
              .select("id, identifier, status, property:properties(name), room_type:room_types(slug, label, price)")
              .eq("status", "available")
              .order("sort_order")
              .then(({ data: refreshed }) => setRooms((refreshed as AvailRoom[] | null) ?? []))
          })
          .subscribe()
      } catch {
        setRooms(FALLBACK_ROOMS as AvailRoom[])
        setLoading(false)
      }
    }

    load()
    return () => { sub?.unsubscribe() }
  }, [])

  const step = () => {
    const track = trackRef.current
    if (!track) return 0
    const card = track.querySelector<HTMLElement>(".room-card")
    const gap = parseFloat(getComputedStyle(track).columnGap) || 22
    return card ? card.getBoundingClientRect().width + gap : 320
  }

  const updateArrows = () => {
    const track = trackRef.current
    if (!track) return
    const max = track.scrollWidth - track.clientWidth - 2
    setCanPrev(track.scrollLeft > 2)
    setCanNext(track.scrollLeft < max)
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    track.addEventListener("scroll", updateArrows, { passive: true })
    updateArrows()
    return () => track.removeEventListener("scroll", updateArrows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms])

  const scrollBy = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * step(), behavior: "smooth" })
  }

  if (loading) return null

  const hasRooms = rooms.length > 0

  return (
    <section className="sec avail" id="disponibles">
      <div className="wrap">
        <div className="sec-head-row reveal">
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <p className="eyebrow sage">
              <span className="live-dot" /> En vivo
            </p>
            <h2>Disponible ahora</h2>
            <p>
              Habitaciones listas para mudarte. Lo que ves aquí está libre hoy —
              cuando se renta, desaparece.
            </p>
          </div>
          {hasRooms && (
            <div className="carousel-nav">
              <button
                className="cbtn"
                aria-label="Anterior"
                disabled={!canPrev}
                onClick={() => scrollBy(-1)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                className="cbtn"
                aria-label="Siguiente"
                disabled={!canNext}
                onClick={() => scrollBy(1)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {hasRooms ? (
          <div className="carousel-wrap reveal d1">
            <div className="carousel" ref={trackRef}>
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          </div>
        ) : (
          <div className="avail-empty show reveal d1">
            <h3>Por ahora no hay habitaciones libres</h3>
            <p>
              Se liberan con frecuencia. Escríbenos y te avisamos en cuanto se
              abra un espacio que encaje contigo.
            </p>
            <a
              className="btn btn-wa"
              href={CONFIG.wa(CONFIG.waAvail)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WaIcon />
              Avísame cuando haya disponibilidad
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
