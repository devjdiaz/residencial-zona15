import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Portal Inquilinos — Residencial El Maestro",
  robots: { index: false, follow: false },
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 font-sans">{children}</div>
}
