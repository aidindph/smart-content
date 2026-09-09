import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

let adminClient: SupabaseClient<Database> | undefined;

export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("کارخواه مدیریتی فقط در سرور قابل استفاده است.");
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("کلید محرمانهٔ Supabase تنظیم نشده است.");

  if (!adminClient) {
    const { url } = getSupabaseConfig();
    adminClient = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "User-Agent": "smart-content-server/1.0" } },
    });
  }

  return adminClient;
}
