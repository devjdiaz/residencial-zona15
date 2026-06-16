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
