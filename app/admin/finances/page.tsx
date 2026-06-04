import AdminHeader from "@/components/admin/AdminHeader"
import FinancesPanel from "@/components/admin/FinancesPanel"

export default function AdminFinancesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Finanzas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ingresos, egresos y comprobantes de pago</p>
        </div>
        <FinancesPanel />
      </main>
    </div>
  )
}
