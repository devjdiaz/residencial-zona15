"use client"
import { useState } from "react"
import type { Contract, TenantProfile } from "@/lib/supabase/types"
import { logAudit } from "@/lib/audit"

interface Props {
  contract: Contract & { tenant_profile?: TenantProfile }
  roomIdentifier: string
  onClose: () => void
}

function generatePassword(length = 12) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#"
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => chars[b % chars.length])
    .join("")
}

export default function ContractInfoDialog({ contract, roomIdentifier, onClose }: Props) {
  const tenant = contract.tenant_profile
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [copied, setCopied] = useState(false)

  const startDate = new Date(contract.start_date).toLocaleDateString("es-GT")
  const endDate = new Date(contract.end_date).toLocaleDateString("es-GT")

  async function handleResetPassword() {
    setResetting(true)
    const pwd = generatePassword()
    try {
      const res = await fetch("/api/admin/reset-tenant-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: contract.tenant_profile_id, password: pwd }),
      })
      if (!res.ok) throw new Error("Error al resetear")
      setNewPassword(pwd)
      logAudit(`Reinició contraseña — Hab. ${roomIdentifier}${tenant?.name ? ` (${tenant.name})` : ""}`, "tenant", roomIdentifier)
    } catch {
      alert("Error al resetear la contraseña")
    } finally {
      setResetting(false)
    }
  }

  function copyCredentials() {
    if (!tenant) return
    const text = `Portal de pagos: https://residencial-zona15.vercel.app/tenant/login\nUsuario: ${tenant.name ? `(preguntar al admin)` : ""}\nContraseña: ${newPassword ?? "(sin cambios)"}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Contrato — Hab. {roomIdentifier}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Información del inquilino y contrato activo</p>
        </div>

        {/* Tenant info */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Nombre</span>
            <span className="font-medium text-gray-900">{tenant?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Teléfono</span>
            <span className="font-medium text-gray-900">{tenant?.phone ?? "—"}</span>
          </div>
        </div>

        {/* Contract info */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Inicio</span>
            <span className="font-medium text-gray-900">{startDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Vence</span>
            <span className="font-medium text-gray-900">{endDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Duración</span>
            <span className="font-medium text-gray-900">{contract.duration_months} meses</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Día de pago</span>
            <span className="font-medium text-gray-900">Día {contract.payment_day}</span>
          </div>
        </div>

        {/* Reset password */}
        {newPassword ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-1">
            <p className="text-green-700 font-medium text-xs uppercase tracking-wide">Nueva contraseña generada</p>
            <p className="font-mono font-bold text-gray-900 text-base">{newPassword}</p>
            <p className="text-xs text-gray-400">Compártela con el inquilino — no se mostrará de nuevo.</p>
          </div>
        ) : (
          <button
            onClick={handleResetPassword}
            disabled={resetting}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {resetting ? "Generando…" : "🔑 Generar nueva contraseña"}
          </button>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cerrar
          </button>
          {newPassword && (
            <button onClick={copyCredentials}
              className="flex-1 py-2.5 rounded-xl bg-[#b64532] text-white text-sm font-medium hover:bg-[#9a3727] transition-colors">
              {copied ? "¡Copiado!" : "Copiar todo"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
