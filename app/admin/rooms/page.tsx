import AdminHeader from "@/components/admin/AdminHeader"
import RoomsView from "@/components/admin/RoomsView"
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

export default async function AdminRoomsPage() {
  const properties = await getProperties()

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Habitaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de disponibilidad y contratos</p>
        </div>

        <RoomsView properties={properties} />
      </main>
    </div>
  )
}
