"use client"
import { useState } from "react"
import RoomGrid from "./RoomGrid"
import ContractTemplateDialog from "./ContractTemplateDialog"

interface Property { id: string; name: string; slug: string }

const LEGEND = [
  { dot: "bg-green-500", label: "Disponible" },
  { dot: "bg-red-500", label: "Ocupada" },
  { dot: "bg-yellow-400", label: "Vence pronto (≤30 días)" },
  { dot: "bg-gray-800", label: "Remodelación" },
]

export default function RoomsView({ properties }: { properties: Property[] }) {
  const [activeId, setActiveId] = useState(properties[0]?.id ?? "")
  const [showTemplate, setShowTemplate] = useState(false)

  return (
    <>
      {/* Property tabs — client toggle, no reload */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
          {properties.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                p.id === activeId ? "bg-[#b64532] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowTemplate(true)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          📄 Plantilla de contrato
        </button>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-4 mb-5 text-xs text-gray-500">
        {LEGEND.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        ))}
      </div>

      <RoomGrid propertyId={activeId} />

      {showTemplate && <ContractTemplateDialog onClose={() => setShowTemplate(false)} />}
    </>
  )
}
