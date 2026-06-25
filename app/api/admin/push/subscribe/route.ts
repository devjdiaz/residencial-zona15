import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (!user || (role !== "super_admin" && role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { endpoint, p256dh, auth, userAgent } = await req.json()
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Suscripción incompleta" }, { status: 400 })
  }

  const service = await createServiceClient()
  const { error } = await service.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth, user_agent: userAgent ?? null },
    { onConflict: "endpoint" }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
