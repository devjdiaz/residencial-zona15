/**
 * Bitácora — registra acciones del backoffice.
 * Append-only (RLS bloquea update/delete). Falla en silencio: nunca debe
 * romper la operación principal si el log no se puede escribir.
 */
export async function logAudit(action: string, entity?: string, entityRef?: string) {
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from("audit_log").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      actor_role: (user.user_metadata?.role as string) ?? null,
      action,
      entity: entity ?? null,
      entity_ref: entityRef ?? null,
    })
  } catch {
    // no-op: el log nunca bloquea la acción
  }
}
