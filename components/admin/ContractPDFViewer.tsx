"use client"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useState } from "react"

// ── Toolbar ───────────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick, active, children, title,
}: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
        active
          ? "bg-[#b64532] text-white border-[#b64532]"
          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  )
}

// ── Placeholders reference ────────────────────────────────────────────────────

const PLACEHOLDERS = [
  "{FECHA_HOY}", "{NOMBRE_ARRENDADORA}", "{DPI_ARRENDADORA}", "{FIRMA_ARRENDADORA}",
  "{NOMBRE_INQUILINO}", "{DPI_INQUILINO}", "{TELEFONO_INQUILINO}", "{TEL_ALT_INQUILINO}", "{EMAIL_INQUILINO}",
  "{HABITACION}", "{PROPIEDAD}", "{FECHA_INICIO}", "{FECHA_FIN}", "{DURACION_MESES}",
  "{RENTA}", "{DIA_PAGO}",
  "{BANCO}", "{NUM_CUENTA}", "{TITULAR_CUENTA}", "{TIPO_CUENTA}",
  "{CLAUSULA_DEPOSITO}",
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  contractId: string
  roomIdentifier: string
  onClose: () => void
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractPDFViewer({ contractId, roomIdentifier, onClose }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [pdfKey, setPdfKey] = useState(Date.now())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class: "tiptap-contract",
      },
    },
  })

  async function handleEditClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/contract-template")
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(`${res.status}: ${body.error ?? "No se pudo cargar la plantilla"}`)
      }
      const data = await res.json()
      if (data.body_json && editor) {
        editor.commands.setContent(data.body_json)
      }
      setMode("edit")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!editor) return
    setSaving(true)
    setError(null)
    try {
      const json = editor.getJSON()
      const res = await fetch("/api/admin/contract-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "body_json", value: json }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Error al guardar")
      }
      setPdfKey(Date.now())
      setMode("view")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  function copyPlaceholder(p: string) {
    navigator.clipboard.writeText(p)
    setCopied(p)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl"
        style={{ height: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {mode === "view" ? `Contrato — Hab. ${roomIdentifier}` : "Editar texto del contrato"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {mode === "view"
                ? "Vista previa del contrato generado"
                : "Los cambios afectan a todos los contratos futuros"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar (solo en modo edit) */}
        {mode === "edit" && editor && (
          <div className="flex flex-wrap items-center gap-1 px-5 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrita">B</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Cursiva"><em>I</em></ToolbarButton>
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Título 1">H1</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Título 2">H2</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Título 3">H3</ToolbarButton>
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista con viñetas">• Lista</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">1. Lista</ToolbarButton>
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Deshacer">↩</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Rehacer">↪</ToolbarButton>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {mode === "view" ? (
            loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">Cargando…</p>
              </div>
            ) : (
              <iframe
                key={pdfKey}
                src={`/api/contracts/${contractId}/pdf?t=${pdfKey}`}
                className="w-full h-full rounded-b-2xl border-0"
                title="Vista previa del contrato"
              />
            )
          ) : (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Editor area */}
              <div className="flex-1 overflow-y-auto px-8 py-4">
                <EditorContent editor={editor} />
              </div>

              {/* Placeholders panel */}
              <div className="border-t border-gray-100 px-5 py-2 bg-gray-50 flex-shrink-0">
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Variables disponibles (clic para copiar):</p>
                <div className="flex flex-wrap gap-1">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => copyPlaceholder(p)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border font-mono transition-colors ${
                        copied === p
                          ? "bg-green-100 border-green-300 text-green-700"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {copied === p ? "¡Copiado!" : p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {error && (
          <p className="px-5 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100 flex-shrink-0">{error}</p>
        )}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {mode === "view" ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cerrar
              </button>
              <button
                onClick={handleEditClick}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors disabled:opacity-60"
              >
                {loading ? "Cargando…" : "Editar texto del PDF"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setMode("view"); setError(null) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
