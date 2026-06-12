import { NextResponse } from "next/server"
import { createServiceClient, createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (!user || (role !== "super_admin" && role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tenantId, email } = await req.json()
  if (!tenantId || !email) return NextResponse.json({ error: "tenantId y email requeridos" }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 })
  }

  const service = await createServiceClient()

  // Primero auth.users: el nuevo email es la credencial de login del portal.
  // Si falla (p. ej. email ya registrado) no se toca el perfil.
  const { error: authErr } = await service.auth.admin.updateUserById(tenantId, {
    email,
    email_confirm: true,
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  const { error: profileErr } = await service.from("tenant_profiles").update({ email }).eq("id", tenantId)
  if (profileErr) {
    // auth.users ya quedó actualizado; el backfill de la migración repara la copia del perfil
    return NextResponse.json({ error: `Login actualizado pero el perfil no se sincronizó: ${profileErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
