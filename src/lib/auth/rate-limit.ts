import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export async function consumeAuthRateLimit(kind: "login" | "signup", identity: string) {
  const keyHash = createHash("sha256").update(`${kind}:${identity.trim().toLowerCase()}`).digest("hex");
  const supabase = await createClient();
  const policy = kind === "login" ? { limit: 8, window: 900 } : { limit: 4, window: 3600 };
  const { data, error } = await supabase.rpc("consume_rate_limit", { p_key_hash: keyHash, p_limit: policy.limit, p_window_seconds: policy.window });
  return !error && data === true;
}
