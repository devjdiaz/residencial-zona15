"use client"
import { useEffect, useRef, useState } from "react"
import { logAudit } from "@/lib/audit"

interface Props {
  onClose: () => void
}

interface TemplateFile {
  name: string
  url: string
}

export default function ContractTemplateDialog({ onClose }: Props) {
  const [template, setTemplate] = useState<TemplateFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { createClient } = await import("@/lib/supabase/client")
      const sb = createClient()
      const { data } = await sb.storage.from("contract-templates").list("")
      const file = data?.find((f) => f.name && !f.name.startsWith("."))
      if (file) {
        const url = sb.storage.from("contract-templates").getPublicUrl(file.name).data.publicUrl
        setTemplate({ name: file.name, url })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const sb = createClient()
      // Un solo archivo vigente: se borra el anterior antes de subir el nuevo
      if (template) {
        const { error: removeErr } = await sb.storage.from("contract-templates").remove([template.name])
        if (removeErr) throw removeErr
      }
      const { error: uploadErr } = await sb.storage
        .from("contract-templates")
        .upload(file.name, file, { upsert: true })
      if (uploadErr) throw uploadErr
      const url = sb.storage.from("contract-templates").getPublicUrl(file.name).data.publicUrl
      setTemplate({ name: file.name, url })
      logAudit(template ? "Reemplazó plantilla de contrato" : "Subió plantilla de contrato", "contract_template", file.name)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al subir la plantilla")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Plantilla de contrato</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Documento que el inquilino llena con su información. Se envía por WhatsApp al crear un contrato.
          </p>
        </div>

        {loading ? (
          <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ) : template ? (
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <p className="text-xs font-medium text-gray-500">Plantilla actual</p>
            <p className="font-medium text-gray-900 break-all">{template.name}</p>
            <a
              href={template.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#b64532] hover:underline inline-block"
            >
              Ver / descargar
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
            Sin plantilla — sube el documento del contrato (PDF o Word).
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={handleUpload}
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors disabled:opacity-60"
          >
            {uploading ? "Subiendo…" : template ? "Reemplazar" : "Subir plantilla"}
          </button>
        </div>
      </div>
    </div>
  )
}
