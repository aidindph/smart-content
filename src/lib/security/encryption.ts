import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: string;
};

type KeyRing = { activeVersion: string; keys: Map<string, Buffer> };

function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error("عملیات رمزنگاری فقط در سرور مجاز است.");
  }
}

function loadKeyRing(): KeyRing {
  assertServer();
  const serialized = process.env.API_KEY_ENCRYPTION_KEYS;
  const activeVersion = process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION;
  if (!serialized || !activeVersion) {
    throw new Error("کلیدهای اصلی رمزنگاری تنظیم نشده‌اند.");
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(serialized) as Record<string, string>;
  } catch {
    throw new Error("قالب حلقهٔ کلیدهای رمزنگاری معتبر نیست.");
  }

  const keys = new Map<string, Buffer>();
  for (const [version, encoded] of Object.entries(parsed)) {
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) {
      throw new Error(`کلید رمزنگاری نسخهٔ ${version} باید دقیقاً ۳۲ بایت باشد.`);
    }
    keys.set(version, key);
  }

  if (!keys.has(activeVersion)) {
    throw new Error("نسخهٔ فعال در حلقهٔ کلیدهای رمزنگاری وجود ندارد.");
  }

  return { activeVersion, keys };
}

export function encryptSecret(plaintext: string, context: string): EncryptedSecret {
  if (!plaintext) throw new Error("مقدار خالی قابل رمزنگاری نیست.");
  const { activeVersion, keys } = loadKeyRing();
  const key = keys.get(activeVersion)!;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    keyVersion: activeVersion,
  };
}

export function decryptSecret(secret: EncryptedSecret, context: string): string {
  const { keys } = loadKeyRing();
  const key = keys.get(secret.keyVersion);
  if (!key) throw new Error("نسخهٔ کلید لازم برای رمزگشایی در دسترس نیست.");

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(secret.iv, "base64url"));
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(secret.tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext, "base64url")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new Error("کلید ذخیره‌شده قابل رمزگشایی نیست یا دست‌کاری شده است.");
  }
}

export function createKeyHint(secret: string) {
  const visible = secret.slice(-4);
  return `•••• ${visible}`;
}
