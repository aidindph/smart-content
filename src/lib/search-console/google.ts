import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

export type GoogleTokenResponse = { access_token: string; expires_in: number; refresh_token?: string; token_type: string };
type StoredConnection = { id: string; user_id: string; encrypted_access_token: string; access_iv: string; access_tag: string; access_key_version: string; encrypted_refresh_token: string; refresh_iv: string; refresh_tag: string; refresh_key_version: string; token_expires_at: string; status: "active" | "expired" | "revoked" };

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://smart-content-orcin.vercel.app";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: `${baseUrl}/api/google/callback` };
}

export function googleTokenContext(userId: string, connectionId: string, kind: "access" | "refresh") {
  return `google-search-console:${userId}:${connectionId}:${kind}`;
}

export async function exchangeAuthorizationCode(code: string) {
  const config = getGoogleOAuthConfig();
  if (!config) throw new Error("اتصال گوگل توسط مدیر سامانه تنظیم نشده است.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("دریافت مجوز گوگل انجام نشد.");
  return response.json() as Promise<GoogleTokenResponse>;
}

async function refreshAccessToken(connection: StoredConnection) {
  const config = getGoogleOAuthConfig();
  if (!config) throw new Error("اتصال گوگل توسط مدیر سامانه تنظیم نشده است.");
  const refreshToken = decryptSecret({ ciphertext: connection.encrypted_refresh_token, iv: connection.refresh_iv, tag: connection.refresh_tag, keyVersion: connection.refresh_key_version }, googleTokenContext(connection.user_id, connection.id, "refresh"));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) {
    await createAdminClient().from("gsc_connections").update({ status: "expired" }).eq("id", connection.id);
    throw new Error("مجوز گوگل منقضی شده است؛ دوباره متصل شوید.");
  }
  const token = await response.json() as GoogleTokenResponse;
  const encrypted = encryptSecret(token.access_token, googleTokenContext(connection.user_id, connection.id, "access"));
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  await createAdminClient().from("gsc_connections").update({ encrypted_access_token: encrypted.ciphertext, access_iv: encrypted.iv, access_tag: encrypted.tag, access_key_version: encrypted.keyVersion, token_expires_at: expiresAt, status: "active" }).eq("id", connection.id);
  return token.access_token;
}

export async function getGoogleAccessToken(userId: string) {
  const { data: connection } = await createAdminClient().from("gsc_connections").select("*").eq("user_id", userId).eq("status", "active").single<StoredConnection>();
  if (!connection) throw new Error("اتصال فعال سرچ کنسول وجود ندارد.");
  if (new Date(connection.token_expires_at).getTime() < Date.now() + 120_000) return { connection, accessToken: await refreshAccessToken(connection) };
  const accessToken = decryptSecret({ ciphertext: connection.encrypted_access_token, iv: connection.access_iv, tag: connection.access_tag, keyVersion: connection.access_key_version }, googleTokenContext(userId, connection.id, "access"));
  return { connection, accessToken };
}

export async function googleApi<T>(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(45_000), cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 403 ? "حساب گوگل به این داده دسترسی ندارد." : "دریافت داده از سرچ کنسول انجام نشد.");
  return response.json() as Promise<T>;
}
