import AdminHeader from "@/components/admin/AdminHeader"
import RoomGrid from "@/components/admin/RoomGrid"
import { createClient } from "@/lib/supabase/server"

async function getProperties() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return [
      { id: "el-maestro", name: "El Maestro", slug: "el-maestro" },
      { id: "tecun", name: "Tecún", slug: "tecun" },
    ]
  }
  const supabase = await createClient()
  const { data } = await supabase.from("properties").select("id, name, slug").order("name")
  return data ?? []
}

export default async function AdminRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>
}) {
  const params = await searchParams
  const properties = await getProperties()
  const activePropertyId = params.property ?? properties[0]?.id

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Habitaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de disponibilidad y contratos</p>
        </div>

        {/* Property tabs */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit mb-6">
          {properties.map((p) => (
            <a
              key={p.id}
              href={`/admin/rooms?property=${p.id}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                p.id === activePropertyId
                  ? "bg-[#b64532] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p.name}
            </a>
          ))}
        </div>

        {/* Status legend */}
        <div className="flex flex-wrap gap-4 mb-5 text-xs text-gray-500">
          {[
            { dot: "bg-green-500", label: "Disponible" },
            { dot: "bg-red-500", label: "Ocupada" },
            { dot: "bg-yellow-400", label: "Vence pronto (≤30 días)" },
            { dot: "bg-gray-800", label: "Remodelación" },
          ].map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          ))}
        </div>

        <RoomGrid propertyId={activePropertyId ?? ""} />
      </main>
    </div>
  )
}
