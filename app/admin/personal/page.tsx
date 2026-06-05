import { redirect } from "next/navigation"
import AdminHeader from "@/components/admin/AdminHeader"
import StaffManager from "@/components/admin/StaffManager"
import { createClient } from "@/lib/supabase/server"

export default async function PersonalPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <p className="p-8 text-sm text-gray-400">Configura Supabase.</p>
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.user_metadata?.role !== "super_admin") {
    redirect("/admin/rooms")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Personal</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cuentas con acceso al backoffice</p>
        </div>
        <StaffManager currentUserId={user.id} />
      </main>
    </div>
  )
}
