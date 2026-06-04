"use client"
import { useEffect, useRef, useState } from "react"
import type { RoomPhoto } from "@/lib/supabase/types"

interface Props {
  roomId: string
  roomIdentifier: string
  onClose: (newCount: number) => void
}

function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`
}

export default function RoomPhotoDialog({ roomId, roomIdentifier, onClose }: Props) {
  const [photos, setPhotos] = useState<RoomPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { createClient } = await import("@/lib/supabase/client")
      const sb = createClient()
      const { data } = await sb
        .from("room_photos")
        .select("*")
        .eq("room_id", roomId)
        .order("display_order")
      setPhotos((data as RoomPhoto[]) ?? [])
    }
    load()
  }, [roomId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const sb = createClient()
      let order = photos.length
      for (const file of files) {
        const path = `rooms/${roomId}/${Date.now()}-${file.name}`
        const { error: uploadErr } = await sb.storage
          .from("room-photos")
          .upload(path, file, { upsert: false })
        if (uploadErr) throw uploadErr
        const { data } = await sb
          .from("room_photos")
          .insert({ room_id: roomId, storage_path: path, display_order: order++ })
          .select()
          .single()
        if (data) setPhotos((p) => [...p, data as RoomPhoto])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al subir")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleDelete(photo: RoomPhoto) {
    if (!confirm("¿Borrar esta foto?")) return
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    await sb.storage.from("room-photos").remove([photo.storage_path])
    await sb.from("room_photos").delete().eq("id", photo.id)
    setPhotos((p) => p.filter((x) => x.id !== photo.id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Fotos · Hab. {roomIdentifier}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {photos.length} foto{photos.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => onClose(photos.length)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 rounded-lg bg-[#b64532] text-white text-xs font-medium hover:bg-[#9a3727] transition-colors disabled:opacity-60"
            >
              {uploading ? "Subiendo…" : "＋ Agregar fotos"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          {photos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              Sin fotos — agrega algunas para mostrarlas en el sitio público.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div
                  key={p.id}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-gray-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(p.storage_path)}
                    alt={`Foto ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleDelete(p)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium"
                  >
                    Borrar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
