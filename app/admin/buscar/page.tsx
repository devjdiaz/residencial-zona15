import AdminHeader from "@/components/admin/AdminHeader"
import SearchView from "@/components/admin/SearchView"

export default function BuscarPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Buscar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Encuentra un inquilino o contrato por cualquier dato</p>
        </div>
        <SearchView />
      </main>
    </div>
  )
}
