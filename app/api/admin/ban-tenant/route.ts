import { NextResponse } from "next/server"
import { createServiceClient, createClient } from "@/lib/supabase/server"

// Bloquea el login de una cuenta de inquilino sin borrar sus datos (perfil,
// contrato, recibos). Se usa al reemplazar al inquilino de una habitación
// para que la cuenta anterior no quede huérfana con acceso vigente.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (!user || (role !== "super_admin" && role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tenantId } = await req.json()
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 })

  const service = await createServiceClient()
  const { error } = await service.auth.admin.updateUserById(tenantId, { ban_duration: "876000h" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
