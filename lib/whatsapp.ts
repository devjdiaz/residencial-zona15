// Helpers de WhatsApp (cliente). Solo links wa.me — no hay API de WhatsApp Business.

export function waLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function tenantPortalUrl(): string {
  return `${window.location.origin}/tenant/login`
}

export function getContractPdfUrl(contractId: string): string {
  return `${window.location.origin}/api/contracts/${contractId}/pdf`
}

// El bucket guarda un único archivo (el template vigente); se descubre con list()
// porque el nombre/extensión puede variar (pdf, docx) al reemplazarlo.
export async function getContractTemplateUrl(): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/client")
  const sb = createClient()
  const { data } = await sb.storage.from("contract-templates").list("")
  const file = data?.find((f) => f.name && !f.name.startsWith("."))
  if (!file) return null
  return sb.storage.from("contract-templates").getPublicUrl(file.name).data.publicUrl
}
