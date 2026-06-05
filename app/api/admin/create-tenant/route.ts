import { NextResponse } from "next/server"
import { createServiceClient, createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (!user || (role !== "super_admin" && role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: "email y password requeridos" }, { status: 400 })

  const service = await createServiceClient()
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    user_metadata: { role: "tenant" },
    email_confirm: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ userId: data.user.id })
}
