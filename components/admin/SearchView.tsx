"use client"
import { useEffect, useState } from "react"
import type { Contract, TenantProfile } from "@/lib/supabase/types"
import { waLink } from "@/lib/whatsapp"
import ContractInfoDialog from "./ContractInfoDialog"

type ContractRow = Contract & {
  tenant_profile?: TenantProfile
  room?: { identifier: string; property?: { name: string } | null; room_type?: { price: number } | null } | null
}

function vehicleTypeLabel(type: string) {
  return type === "moto" ? "Moto" : type === "carro" ? "Carro" : type
}

function buildHaystack(c: ContractRow): string {
  const t = c.tenant_profile
  const parts = [
    t?.name, t?.phone, t?.phone_alt, t?.dpi, t?.email,
    c.room?.identifier, c.room?.property?.name,
    c.has_additional_person ? c.additional_person_name : "",
    c.has_additional_person ? c.additional_person_dpi : "",
    c.has_additional_person ? c.additional_person_phone : "",
    c.has_additional_person ? c.additional_person_phone_alt : "",
    c.has_parking ? vehicleTypeLabel(c.parking_vehicle_type) : "",
    c.has_parking ? c.parking_vehicle_brand : "",
    c.has_parking ? c.parking_vehicle_line : "",
    c.has_parking ? c.parking_vehicle_color : "",
    c.has_parking ? c.parking_vehicle_plate : "",
  ]
  return parts.filter(Boolean).join(" ").toLowerCase()
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400">{label}:</span> {value || "—"}
    </div>
  )
}

function ResultCard({ contract, onOpen }: { contract: ContractRow; onOpen: () => void }) {
  const t = contract.tenant_profile
  const isActive = contract.status === "active"
  const waHref = t?.phone ? waLink(t.phone, "") : null

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="text-sm font-semibold text-gray-900">Hab. {contract.room?.identifier ?? "—"}</span>
          <span className="text-xs text-gray-400 ml-2">{contract.room?.property?.name ?? ""}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
          isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"
        }`}>
          {isActive ? "Activo" : "Terminado"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
        <Field label="Nombre" value={t?.name ?? ""} />
        <Field label="DPI" value={t?.dpi ?? ""} />
        <Field label="Teléfono" value={t?.phone ?? ""} />
        <Field label="Tel. alt" value={t?.phone_alt ?? ""} />
        <div className="sm:col-span-2"><Field label="Correo" value={t?.email ?? ""} /></div>
      </div>

      {contract.has_additional_person && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1">Persona adicional</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
            <Field label="Nombre" value={contract.additional_person_name} />
            <Field label="DPI" value={contract.additional_person_dpi} />
            <Field label="Teléfono" value={contract.additional_person_phone} />
            <Field label="Tel. alt" value={contract.additional_person_phone_alt} />
          </div>
        </div>
      )}

      {contract.has_parking && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1">Vehículo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
            <Field label="Tipo" value={vehicleTypeLabel(contract.parking_vehicle_type)} />
            <Field label="Marca" value={contract.parking_vehicle_brand} />
            <Field label="Línea" value={contract.parking_vehicle_line} />
            <Field label="Color" value={contract.parking_vehicle_color} />
            <Field label="Placa" value={contract.parking_vehicle_plate} />
          </div>
        </div>
      )}

      <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-100">
        <button onClick={onOpen}
          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          Ver contrato
        </button>
        <button onClick={() => waHref && window.open(waHref, "_blank")}
          disabled={!waHref}
          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          📲 WhatsApp
        </button>
      </div>
    </div>
  )
}

export default function SearchView() {
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [openContractId, setOpenContractId] = useState<string | null>(null)

  async function load() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { setLoading(false); return }
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const { data } = await sb
      .from("contracts")
      .select("*, tenant_profile:tenant_profiles!contracts_tenant_profile_id_fkey(*), room:rooms(identifier, property:properties(name), room_type:room_types(price))")
      .order("start_date", { ascending: false })
    setContracts((data as ContractRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/set-state-in-effect

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const results = tokens.length === 0
    ? contracts
    : contracts.filter((c) => {
        const haystack = buildHaystack(c)
        return tokens.every((tok) => haystack.includes(tok))
      })

  const openContract = openContractId ? contracts.find((c) => c.id === openContractId) ?? null : null

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Busca por nombre, teléfono, DPI, cuarto, correo, vehículo…"
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#b64532]/40"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : results.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Sin resultados.</p>
      ) : (
        <div className="space-y-3">
          {results.map((c) => (
            <ResultCard key={c.id} contract={c} onOpen={() => setOpenContractId(c.id)} />
          ))}
        </div>
      )}

      {openContract && (
        <ContractInfoDialog
          contract={openContract}
          roomIdentifier={openContract.room?.identifier ?? "—"}
          listPrice={openContract.room?.room_type?.price ?? null}
          onClose={() => setOpenContractId(null)}
          onUpdated={load}
        />
      )}
    </div>
  )
}
