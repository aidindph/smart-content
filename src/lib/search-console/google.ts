import "server-only";

import { createSign } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

export type GoogleTokenResponse = { access_token: string; expires_in: number; refresh_token?: string; token_type: string };
export class SearchConsoleError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number, public readonly details?: unknown) { super(message); this.name = "SearchConsoleError"; }
}
type StoredConnection = { id: string; user_id: string; auth_type: "oauth" | "service_account"; encrypted_access_token: string | null; access_iv: string | null; access_tag: string | null; access_key_version: string | null; encrypted_refresh_token: string | null; refresh_iv: string | null; refresh_tag: string | null; refresh_key_version: string | null; token_expires_at: string | null; encrypted_service_account: string | null; service_account_iv: string | null; service_account_tag: string | null; service_account_key_version: string | null; status: "active" | "expired" | "revoked" };
export type GoogleServiceAccount = { type: "service_account"; project_id: string; private_key_id: string; private_key: string; client_email: string; token_uri: string };

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://smart-content-orcin.vercel.app";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: `${baseUrl}/api/google/callback` };
}

export function googleTokenContext(userId: string, connectionId: string, kind: "access" | "refresh" | "service-account") {
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
  if (!connection.encrypted_refresh_token || !connection.refresh_iv || !connection.refresh_tag || !connection.refresh_key_version) throw new Error("توکن تازه‌سازی در دسترس نیست.");
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

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

export function parseServiceAccountJson(raw: string): GoogleServiceAccount {
  const value = JSON.parse(raw) as Partial<GoogleServiceAccount>;
  if (value.type !== "service_account" || !value.project_id || !value.private_key_id || !value.private_key || !value.client_email) throw new Error("فایل جیسون حساب خدماتی معتبر نیست.");
  if (!value.client_email.endsWith(".gserviceaccount.com")) throw new Error("ایمیل حساب خدماتی معتبر نیست.");
  return { type: "service_account", project_id: value.project_id, private_key_id: value.private_key_id, private_key: value.private_key, client_email: value.client_email, token_uri: value.token_uri || "https://oauth2.googleapis.com/token" };
}

export async function serviceAccountAccessToken(credentials: GoogleServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: credentials.private_key_id }));
  const claim = base64url(JSON.stringify({ iss: credentials.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: credentials.token_uri, iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256"); signer.update(`${header}.${claim}`); signer.end();
  const assertion = `${header}.${claim}.${signer.sign(credentials.private_key, "base64url")}`;
  const response = await fetch(credentials.token_uri, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!response.ok) throw new Error("دریافت دسترسی از حساب خدماتی گوگل انجام نشد.");
  const token = await response.json() as GoogleTokenResponse;
  return token.access_token;
}

export async function getGoogleAccessToken(userId: string) {
  const { data: connection } = await createAdminClient().from("gsc_connections").select("*").eq("user_id", userId).eq("status", "active").single<StoredConnection>();
  if (!connection) throw new Error("اتصال فعال سرچ کنسول وجود ندارد.");
  if (connection.auth_type === "service_account") {
    if (!connection.encrypted_service_account || !connection.service_account_iv || !connection.service_account_tag || !connection.service_account_key_version) throw new Error("اعتبارنامهٔ حساب خدماتی ناقص است.");
    const raw = decryptSecret({ ciphertext: connection.encrypted_service_account, iv: connection.service_account_iv, tag: connection.service_account_tag, keyVersion: connection.service_account_key_version }, googleTokenContext(userId, connection.id, "service-account"));
    return { connection, accessToken: await serviceAccountAccessToken(parseServiceAccountJson(raw)) };
  }
  if (!connection.token_expires_at || new Date(connection.token_expires_at).getTime() < Date.now() + 120_000) return { connection, accessToken: await refreshAccessToken(connection) };
  if (!connection.encrypted_access_token || !connection.access_iv || !connection.access_tag || !connection.access_key_version) throw new Error("توکن دسترسی در دسترس نیست.");
  const accessToken = decryptSecret({ ciphertext: connection.encrypted_access_token, iv: connection.access_iv, tag: connection.access_tag, keyVersion: connection.access_key_version }, googleTokenContext(userId, connection.id, "access"));
  return { connection, accessToken };
}

export async function googleApi<T>(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(45_000), cache: "no-store" });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const code = response.status === 401 ? "google_auth" : response.status === 403 ? "google_permission" : response.status === 429 ? "google_quota" : response.status >= 500 ? "google_unavailable" : "google_request";
    const message = response.status === 401 ? "اعتبارنامهٔ گوگل معتبر نیست یا منقضی شده است." : response.status === 403 ? "حساب خدماتی به این ویژگی سرچ کنسول دسترسی ندارد؛ ایمیل آن را در بخش کاربران سایت اضافه کنید." : response.status === 429 ? "سهمیهٔ رابط برنامه‌نویسی گوگل پر شده است؛ همگام‌سازی کمی بعد دوباره انجام می‌شود." : response.status >= 500 ? "سرویس سرچ کنسول گوگل موقتاً پاسخ‌گو نیست." : `درخواست سرچ کنسول با کد ${response.status} رد شد.`;
    throw new SearchConsoleError(code, message, response.status, details);
  }
  return response.json() as Promise<T>;
}
