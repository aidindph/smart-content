import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "./encryption";

type StoredSecret = {
  id: string;
  user_id: string;
  provider_id: string;
  encrypted_key: string;
  encryption_iv: string;
  encryption_tag: string;
  key_version: string;
  is_active: boolean;
  deleted_at: string | null;
  default_text_model: string | null;
};

type StoredSystemSecret = Omit<StoredSecret, "user_id">;

export function apiKeyContext(userId: string, keyId: string, providerId: string) {
  return `user-api-key:${userId}:${keyId}:${providerId}`;
}

export function systemApiKeyContext(keyId: string, providerId: string) {
  return `system-api-key:${keyId}:${providerId}`;
}

export async function loadUserApiKey(userId: string, keyId: string) {
  const { data, error } = await createAdminClient()
    .from("user_api_keys")
    .select("id, user_id, provider_id, encrypted_key, encryption_iv, encryption_tag, key_version, is_active, deleted_at, default_text_model")
    .eq("id", keyId)
    .eq("user_id", userId)
    .single<StoredSecret>();

  if (error || !data || data.deleted_at || !data.is_active) {
    throw new Error("کلید فعال در دسترس نیست.");
  }

  return {
    providerId: data.provider_id,
    defaultTextModel: data.default_text_model,
    apiKey: decryptSecret(
      {
        ciphertext: data.encrypted_key,
        iv: data.encryption_iv,
        tag: data.encryption_tag,
        keyVersion: data.key_version,
      },
      apiKeyContext(data.user_id, data.id, data.provider_id),
    ),
  };
}

export async function loadSystemApiKey(keyId: string) {
  const { data, error } = await createAdminClient()
    .from("system_api_keys")
    .select("id, provider_id, encrypted_key, encryption_iv, encryption_tag, key_version, is_active, deleted_at, default_text_model")
    .eq("id", keyId)
    .eq("test_status", "valid")
    .single<StoredSystemSecret>();

  if (error || !data || data.deleted_at || !data.is_active) {
    throw new Error("کلید سراسری فعال در دسترس نیست.");
  }

  return {
    providerId: data.provider_id,
    defaultTextModel: data.default_text_model,
    apiKey: decryptSecret(
      {
        ciphertext: data.encrypted_key,
        iv: data.encryption_iv,
        tag: data.encryption_tag,
        keyVersion: data.key_version,
      },
      systemApiKeyContext(data.id, data.provider_id),
    ),
  };
}
