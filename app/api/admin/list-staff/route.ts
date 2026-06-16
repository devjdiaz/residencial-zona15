import { NextResponse } from "next/server"
import { createServiceClient, createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const service = await createServiceClient()
  const { data, error } = await service.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const staff = data.users
    .filter((u) => ["super_admin", "admin", "guardian"].includes(u.user_metadata?.role))
    .map((u) => ({
      id: u.id,
      email: u.email,
      role: u.user_metadata?.role as string,
      created_at: u.created_at,
    }))

  return NextResponse.json({ staff })
}
