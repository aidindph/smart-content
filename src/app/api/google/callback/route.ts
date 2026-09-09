import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { encryptSecret } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { exchangeAuthorizationCode, googleApi, googleTokenContext } from "@/lib/search-console/google";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://smart-content-orcin.vercel.app";
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const expectedState = request.cookies.get("gsc_oauth_state")?.value;
  if (!state || !code || !expectedState || state !== expectedState) return NextResponse.redirect(new URL("/dashboard/search-console?error=state", baseUrl));
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/login", baseUrl));

  try {
    const admin = createAdminClient();
    const tokens = await exchangeAuthorizationCode(code);
    if (!tokens.refresh_token) throw new Error("گوگل توکن تازه‌سازی برنگرداند.");
    const userInfo = await googleApi<{ email?: string }>("https://openidconnect.googleapis.com/v1/userinfo", tokens.access_token);
    const { data: existing } = await admin.from("gsc_connections").select("id").eq("user_id", userId).maybeSingle<{ id: string }>();
    const connectionId = existing?.id ?? randomUUID();
    const access = encryptSecret(tokens.access_token, googleTokenContext(userId, connectionId, "access"));
    const refresh = encryptSecret(tokens.refresh_token, googleTokenContext(userId, connectionId, "refresh"));
    await admin.from("gsc_connections").upsert({ id: connectionId, user_id: userId, google_email: userInfo.email ?? null, encrypted_access_token: access.ciphertext, access_iv: access.iv, access_tag: access.tag, access_key_version: access.keyVersion, encrypted_refresh_token: refresh.ciphertext, refresh_iv: refresh.iv, refresh_tag: refresh.tag, refresh_key_version: refresh.keyVersion, token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), status: "active" }, { onConflict: "user_id" });
    const response = NextResponse.redirect(new URL("/dashboard/search-console?notice=connected", baseUrl));
    response.cookies.delete("gsc_oauth_state");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/dashboard/search-console?error=oauth", baseUrl));
  }
}
