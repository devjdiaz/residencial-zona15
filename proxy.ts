import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"


export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  // Skip auth check if Supabase is not yet configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Admin routes — require admin role
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!user || user.user_metadata?.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
  }

  // Tenant routes — require tenant role
  if (pathname.startsWith("/tenant") && !pathname.startsWith("/tenant/login")) {
    if (!user || user.user_metadata?.role !== "tenant") {
      return NextResponse.redirect(new URL("/tenant/login", request.url))
    }
  }

  return response
}

export const proxyConfig = {
  matcher: ["/admin/:path*", "/tenant/:path*"],
}
