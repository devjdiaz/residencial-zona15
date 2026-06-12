"use client"
import { useRef, useState } from "react"
import { logAudit } from "@/lib/audit"

interface Props {
  contractId: string
  roomIdentifier: string
  filePath: string | null
  onUpdated?: (newPath: string) => void
}

// Subir/ver/reemplazar el archivo del contrato firmado (bucket privado 'contracts').
// Se usa en el módulo Historial y en ContractInfoDialog ("Ver contrato" de Habitaciones).
export default function ContractFileManager({ contractId, roomIdentifier, filePath: initialPath, onUpdated }: Props) {
  const [filePath, setFilePath] = useState(initialPath)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fileName = filePath ? filePath.split("/").pop() : null

  async function viewFile() {
    if (!filePath) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(filePath, 300)
    if (error || !data) { alert("No se pudo abrir el contrato"); return }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBusy(true)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const newPath = `${contractId}/${file.name}`
      const { error: upErr } = await supabase.storage.from("contracts").upload(newPath, file, { upsert: true })
      if (upErr) throw upErr
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbErr } = await (supabase as any).from("contracts").update({ contract_file_path: newPath }).eq("id", contractId)
      if (dbErr) throw dbErr
      if (filePath && filePath !== newPath) {
        await supabase.storage.from("contracts").remove([filePath])
      }
      logAudit(`${filePath ? "Reemplazó" : "Subió"} contrato firmado — Hab. ${roomIdentifier}`, "contract", roomIdentifier)
      setFilePath(newPath)
      onUpdated?.(newPath)
    } catch {
      alert("Error al subir el archivo del contrato")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-gray-500">Archivo del contrato</span>
        {fileName ? (
          <span className="font-medium text-gray-900 break-all text-right text-xs">{fileName}</span>
        ) : (
          <span className="text-gray-400 text-xs">Sin archivo</span>
        )}
      </div>
      <div className="flex gap-1.5 justify-end">
        {filePath && (
          <button
            onClick={viewFile}
            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Ver
          </button>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-xs px-2.5 py-1 rounded-lg bg-[#b64532] text-white hover:bg-[#9a3727] transition-colors disabled:opacity-60"
        >
          {busy ? "Subiendo…" : filePath ? "Reemplazar" : "📎 Subir contrato firmado"}
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  )
}
