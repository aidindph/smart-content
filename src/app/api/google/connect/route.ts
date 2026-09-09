import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getGoogleOAuthConfig } from "@/lib/search-console/google";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "https://smart-content-orcin.vercel.app"));
  const config = getGoogleOAuthConfig();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://smart-content-orcin.vercel.app";
  if (!config) return NextResponse.redirect(new URL("/dashboard/search-console?error=not-configured", baseUrl));

  const state = randomBytes(32).toString("base64url");
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, scope: "openid email https://www.googleapis.com/auth/webmasters.readonly" }).toString();
  const response = NextResponse.redirect(authorization);
  response.cookies.set("gsc_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google/callback", maxAge: 600 });
  return response;
}
