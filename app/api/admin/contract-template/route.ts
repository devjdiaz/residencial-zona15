import { NextResponse } from "next/server"
import { createServiceClient, createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (!user || (role !== "super_admin" && role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sb = await createServiceClient()
  const { data, error } = await sb.from("contract_template").select("key, value")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
  return NextResponse.json(result)
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (!user || (role !== "super_admin" && role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { key, value } = await req.json()
  if (!key || value === undefined) {
    return NextResponse.json({ error: "key y value requeridos" }, { status: 400 })
  }

  const sb = await createServiceClient()
  const { error } = await sb
    .from("contract_template")
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log inline (API routes no pueden usar logAudit que depende del cliente browser)
  await sb.from("audit_log").insert({
    actor_id: user.id,
    actor_email: user.email ?? null,
    actor_role: role ?? null,
    action: `Actualizó plantilla de contrato — sección: ${key}`,
    entity: "contract_template",
    entity_ref: key,
  }).then(() => {})

  return NextResponse.json({ ok: true })
}
