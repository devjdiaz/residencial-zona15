"use client"
import { useState } from "react"
import { waLink, getContractPdfUrl } from "@/lib/whatsapp"
import { logAudit } from "@/lib/audit"

interface Props {
  credentials: { email: string; password: string; name: string; phone: string; contractId: string }
  roomIdentifier: string
  onClose: () => void
}

export default function CredentialsDialog({ credentials, roomIdentifier, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const pdfUrl = getContractPdfUrl(credentials.contractId)

  function copyAll() {
    const text = `Habitación ${roomIdentifier} — Portal de inquilinos\nURL: ${window.location.origin}/tenant/login\nUsuario: ${credentials.email}\nContraseña: ${credentials.password}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const hasPhone = credentials.phone.replace(/\D/g, "").length > 0

  function sendContractWhatsApp() {
    const msg = `Hola ${credentials.name}, ¡bienvenido/a! Descarga tu contrato de arrendamiento aquí:\n${pdfUrl}\nPor favor imprímelo, fírmalo y entrégalo a la administración. ¡Gracias!`
    const link = waLink(credentials.phone, msg)
    if (!link) return
    window.open(link, "_blank")
    logAudit(`Envió contrato PDF por WhatsApp — Hab. ${roomIdentifier} (${credentials.name})`, "contract", roomIdentifier)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 text-2xl grid place-items-center mx-auto mb-3">
            ✓
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Contrato creado</h2>
          <p className="text-sm text-gray-500">Entrega estas credenciales al inquilino de Hab. {roomIdentifier}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-0.5">URL del portal</p>
            <p className="text-sm font-mono text-gray-800 break-all">
              {typeof window !== "undefined" ? window.location.origin : ""}/tenant/login
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-0.5">Usuario (email)</p>
            <p className="text-sm font-mono text-gray-800 break-all">{credentials.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-0.5">Contraseña</p>
            <p className="text-sm font-mono font-semibold text-gray-900">{credentials.password}</p>
          </div>
        </div>

        <div>
          <button
            onClick={sendContractWhatsApp}
            disabled={!hasPhone}
            className="w-full py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📄 Enviar contrato por WhatsApp
          </button>
          {!hasPhone && (
            <p className="text-xs text-gray-400 mt-1 text-center">
              El inquilino no tiene teléfono registrado.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={copyAll}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {copied ? "✓ Copiado" : "Copiar todo"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors"
          >
            Entendido
          </button>
        </div>
        <p className="text-xs text-center text-gray-400">
          Guarda estas credenciales — no se mostrarán de nuevo.
        </p>
      </div>
    </div>
  )
}
