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
    price: 3000,
    property: { name: "El Maestro", slug: "el-maestro" },
    room_type: { slug: "loft", label: "Loft de 2 Niveles" },
  },
  {
    id: "fallback-2",
    identifier: "5",
    status: "available" as const,
    price: 2500,
    property: { name: "El Maestro", slug: "el-maestro" },
    room_type: { slug: "grande", label: "Habitacion Grande" },
  },
  {
    id: "fallback-3",
    identifier: "12",
    status: "available" as const,
    price: 2000,
    property: { name: "Tecun", slug: "tecun" },
    room_type: { slug: "estandar", label: "Habitacion Estandar" },
  },
]

type AvailRoom = Pick<Room, "id" | "identifier" | "status"> & {
  price?: number | null
  property?: { name: string; slug: string }[]
  room_type?: { slug: string; label: string }[]
  room_photos?: { storage_path: string }[]
}

const SUPABASE_STORAGE = "https://murcjxwahkgwaauibgsu.supabase.co/storage/v1/object/public/room-photos"

function getPhotos(room: AvailRoom): string[] {
  const dbPhotos = room.room_photos
  if (dbPhotos && dbPhotos.length > 0) {
    return dbPhotos.map((p) => `${SUPABASE_STORAGE}/${p.storage_path}`)
  }
  const typeSlug = (Array.isArray(room.room_type) ? room.room_type[0] : room.room_type)?.slug ?? ""
  const key = typeSlug as keyof typeof ROOM_TYPES
  return [...(ROOM_TYPES[key]?.photos ?? [])]
}

function RoomCard({ room }: { room: AvailRoom }) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const photos = getPhotos(room)
  const prop = Array.isArray(room.property) ? room.property[0] : room.property
  const type = Array.isArray(room.room_type) ? room.room_type[0] : room.room_type
  const slug = type?.slug ?? "estandar"
  const waMsg = `Hola Julio, me interesa la Habitacion ${room.identifier} (${type?.label ?? "habitacion"}${room.price != null ? ` - Q${room.price.toLocaleString()}/mes` : ""}) en Residencial ${prop?.name ?? "El Maestro"}.`

  return (
    <article className="room-card">
      <div className="room-photo photo-warm">
        <span className="badge">
          <span className="live-dot" />
          Disponible
        </span>
        {room.price != null && (
          <span className="price-chip">
            Q{room.price.toLocaleString()}/mes
          </span>
        )}
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
            {type?.label}
          </div>
        )}
        <div className="room-overlay">
          <h3>
            {type?.label ?? "Habitacion"} {room.identifier}
          </h3>
          <span>{prop?.name} · Zona 15</span>
        </div>
      </div>
      <div className="room-body">
        <div className="room-feats">
          {slug === "grande" && (
            <span className="feat-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10V6a5 5 0 0110 0v4" /><rect x="4" y="10" width="16" height="11" rx="2" />
              </svg>
              Baño privado
            </span>
          )}
          {slug === "loft" && (
            <span className="feat-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="7" rx="1" /><rect x="2" y="14" width="20" height="7" rx="1" />
              </svg>
              2 niveles
            </span>
          )}
          <span className="feat-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Agua y luz incluidos
          </span>
          {prop?.slug === "el-maestro" && (
            <span className="feat-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Terraza
            </span>
          )}
          <span className="feat-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
            Zona lavandería
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

function PropertyCarousel({ title, rooms }: { title: string; rooms: AvailRoom[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

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

  return (
    <div style={{ marginBottom: "clamp(28px, 4vw, 48px)" }}>
      <div className="sec-head-row" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontFamily: "var(--rm-sans)", fontWeight: 600, fontSize: 15, color: "var(--ink-soft)" }}>
          {title}
        </p>
        <div className="carousel-nav">
          <button className="cbtn" aria-label="Anterior" disabled={!canPrev} onClick={() => scrollBy(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="cbtn" aria-label="Siguiente" disabled={!canNext} onClick={() => scrollBy(1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="carousel-wrap">
        <div className="carousel" ref={trackRef}>
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </div>
    </div>
  )
}

const QUERY = "id, identifier, status, price, property:properties(name,slug), room_type:room_types(slug, label), room_photos(storage_path)"

export default function AvailabilitySection() {
  const [rooms, setRooms] = useState<AvailRoom[]>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ? [] : (FALLBACK_ROOMS as unknown as AvailRoom[])
  )
  const [loading, setLoading] = useState(!!process.env.NEXT_PUBLIC_SUPABASE_URL)

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null

    async function load() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setRooms(FALLBACK_ROOMS as unknown as AvailRoom[])
        setLoading(false)
        return
      }
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()

        const { data, error } = await supabase
          .from("rooms")
          .select(QUERY)
          .eq("status", "available")
          .order("sort_order")

        if (error) {
          console.error("[AvailabilitySection] query error:", error)
          setRooms(FALLBACK_ROOMS as unknown as AvailRoom[])
        } else {
          console.log("[AvailabilitySection] rooms:", data?.length, data?.[0])
          setRooms((data as AvailRoom[] | null) ?? [])
        }
        setLoading(false)

        sub = supabase
          .channel("rooms-availability")
          .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
            supabase.from("rooms").select(QUERY).eq("status", "available").order("sort_order")
              .then(({ data: refreshed }) => setRooms((refreshed as AvailRoom[] | null) ?? []))
          })
          .subscribe()
      } catch {
        setRooms(FALLBACK_ROOMS as unknown as AvailRoom[])
        setLoading(false)
      }
    }

    load()
    return () => { sub?.unsubscribe() }
  }, [])

  const getPropSlug = (r: AvailRoom) => (Array.isArray(r.property) ? r.property[0] : r.property)?.slug
  const maestro  = rooms.filter((r) => getPropSlug(r) === "el-maestro")
  const tecun    = rooms.filter((r) => getPropSlug(r) === "tecun")
  const hasRooms = maestro.length > 0 || tecun.length > 0

  return (
    <section className="sec avail" id="disponibles">
      <div className="wrap">
        <div className="sec-head reveal">
          <p className="eyebrow sage">
            <span className="live-dot" /> En vivo
          </p>
          <h2>Disponible ahora</h2>
          <p>
            Habitaciones listas para mudarte. Lo que ves aquí está libre hoy —
            cuando se renta, desaparece.
          </p>
        </div>

        {loading ? (
          <div className="carousel-wrap reveal d1">
            <div className="carousel">
              {[1, 2, 3].map((i) => (
                <div key={i} className="room-card" style={{ minHeight: 340 }}>
                  <div style={{ background: "#ece2d6", width: "100%", aspectRatio: "4/3" }} />
                  <div className="room-body" style={{ gap: 12 }}>
                    <div style={{ background: "#ece2d6", borderRadius: 8, height: 20, width: "70%" }} />
                    <div style={{ background: "#ece2d6", borderRadius: 8, height: 14, width: "50%" }} />
                    <div style={{ background: "#ece2d6", borderRadius: 100, height: 38, marginTop: "auto" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : hasRooms ? (
          <div className="reveal d1">
            {maestro.length > 0 && <PropertyCarousel title="Residencial El Maestro" rooms={maestro} />}
            {tecun.length > 0   && <PropertyCarousel title="Residencial Tecún" rooms={tecun} />}
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
