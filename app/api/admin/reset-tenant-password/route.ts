import { NextResponse } from "next/server"
import { createServiceClient, createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tenantId, password } = await req.json()
  if (!tenantId || !password) return NextResponse.json({ error: "tenantId y password requeridos" }, { status: 400 })

  const service = await createServiceClient()
  const { error } = await service.auth.admin.updateUserById(tenantId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
