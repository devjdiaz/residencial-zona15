import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Mantenimiento — Residencial El Maestro",
  robots: { index: false, follow: false },
}

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {children}
    </div>
  )
}
