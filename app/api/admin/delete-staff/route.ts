import { NextResponse } from "next/server"
import { createServiceClient, createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { staffId } = await req.json()
  if (!staffId) return NextResponse.json({ error: "staffId requerido" }, { status: 400 })
  if (staffId === user.id) return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 })

  const service = await createServiceClient()
  // Guard: never delete another super_admin
  const { data: target } = await service.auth.admin.getUserById(staffId)
  if (target?.user?.user_metadata?.role === "super_admin") {
    return NextResponse.json({ error: "No se puede eliminar un super admin" }, { status: 400 })
  }

  const { error } = await service.auth.admin.deleteUser(staffId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
