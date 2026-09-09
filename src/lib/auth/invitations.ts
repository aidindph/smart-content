import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function invitationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function isValidInvitation(email: string, token: string) {
  if (!email || token.length < 20) return false;
  const { data } = await createAdminClient().from("user_invitations").select("id")
    .eq("email", email.trim().toLowerCase())
    .eq("token_hash", invitationTokenHash(token))
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ id: string }>();
  return Boolean(data);
}
