import { CONFIG } from "@/data/config"
import { ROOM_TYPES } from "@/data/roomTypes"
import MiniCarousel from "./MiniCarousel"
import WaIcon from "./WaIcon"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomListing {
  id: string
  identifier: string
  property: { name: string }
  room_type: { price: number; label: string; slug: string } | null
  room_photos: { storage_path: string; display_order: number }[]
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function getAvailableListings(): Promise<RoomListing[] | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const sb = await createClient()
    const { data } = await sb
      .from("rooms")
      .select("id, identifier, property:properties(name), room_type:room_types(price,label,slug), room_photos(storage_path,display_order)")
      .eq("status", "available")
      .order("sort_order")
    const withPhotos = ((data ?? []) as unknown as RoomListing[]).filter(
      (r) => r.room_photos?.length > 0
    )
    return withPhotos
  } catch {
    return null
  }
}

function roomPhotoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`
}

// ─── Listing mode ─────────────────────────────────────────────────────────────

function ListingCard({ room }: { room: RoomListing }) {
  const photos = [...room.room_photos]
    .sort((a, b) => a.display_order - b.display_order)
    .map((p) => roomPhotoUrl(p.storage_path))

  const price = room.room_type?.price
  const typeLabel = room.room_type?.label ?? "Habitación"
  const waMsg = `Hola, me interesa la Hab. ${room.identifier} en ${room.property.name}${price ? ` (Q${price.toLocaleString()}/mes)` : ""}. ¿Está disponible?`

  return (
    <div className="listing-card">
      <div className="listing-photo">
        <MiniCarousel photos={photos} alt={`Hab. ${room.identifier}`} />
        <span className="badge">
          <span className="live-dot" />
          Disponible
        </span>
        {price && (
          <span className="price-chip">Q{price.toLocaleString()} / mes</span>
        )}
      </div>
      <div className="listing-body">
        <div>
          <h3>Hab. {room.identifier}</h3>
          <p className="listing-meta">{room.property.name} · {typeLabel}</p>
        </div>
        <a
          className="btn btn-terra btn-sm btn-block"
          href={CONFIG.wa(waMsg)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WaIcon />
          Me interesa
        </a>
      </div>
    </div>
  )
}

// ─── Type showcases (fallback) ────────────────────────────────────────────────

const SHOWCASES = [
  {
    ...ROOM_TYPES.grande,
    waMsg: `Hola Julio, me interesa la Habitación Grande (Q2,500/mes) del Residencial El Maestro.`,
    flip: false,
  },
  {
    ...ROOM_TYPES.loft,
    waMsg: `Hola Julio, me interesa el Loft de 2 Niveles (Q3,000/mes) del Residencial El Maestro.`,
    flip: true,
  },
  {
    ...ROOM_TYPES.estandar,
    waMsg: `Hola Julio, me interesa la Habitación Estándar (Q2,000/mes) del Residencial El Maestro.`,
    flip: false,
  },
  {
    ...ROOM_TYPES.pequena,
    waMsg: `Hola Julio, me interesa la Habitación Pequeña (Q1,600/mes) del Residencial El Maestro.`,
    flip: true,
  },
]

function FeaturePill({ label }: { label: string }) {
  return (
    <span className="feat-pill">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default async function RoomShowcases() {
  const listings = await getAvailableListings()
  const showListings = listings !== null && listings.length > 0

  return (
    <section className="sec" id="habitaciones">
      <div className="wrap">
        {showListings ? (
          <>
            <div className="sec-head reveal">
              <p className="eyebrow">
                <span className="live-dot" style={{ marginRight: 6 }} />
                Habitaciones disponibles
              </p>
              <h2>Estas habitaciones están listas</h2>
              <p>
                Cada espacio es único. Mira las fotos y escríbenos por el que
                más te guste.
              </p>
            </div>
            <div className="listing-grid reveal">
              {listings.map((room) => (
                <ListingCard key={room.id} room={room} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="sec-head reveal">
              <p className="eyebrow">Tipos de habitación</p>
              <h2>Elige el espacio que va contigo</h2>
              <p>
                Cada habitación tiene su carácter. Mira los detalles y quédate
                con la que se sienta tuya.
              </p>
            </div>

            {SHOWCASES.map((room) => (
              <div key={room.slug} className={`showcase${room.flip ? " flip" : ""} reveal`}>
                <div className="showcase-media">
                  <MiniCarousel photos={room.photos.slice(0, 6)} alt={room.label} />
                </div>
                <div className="showcase-copy">
                  <p className="eyebrow sage">{room.eyebrow}</p>
                  <h3>{room.label}</h3>
                  <div className="showcase-price">
                    Q{room.price.toLocaleString()} <span>/ mes</span>
                  </div>
                  <p>{room.description}</p>
                  <div className="showcase-feats">
                    {room.features.map((f) => (
                      <FeaturePill key={f.label} label={f.label} />
                    ))}
                  </div>
                  <a
                    className="btn btn-terra"
                    href={CONFIG.wa(room.waMsg)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Me interesa esta habitación →
                  </a>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
