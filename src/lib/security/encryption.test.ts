import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { decryptSecret, encryptSecret } from "./encryption.ts";

test("راز با متن همراه درست رمزگشایی می‌شود", () => {
  process.env.API_KEY_ENCRYPTION_KEYS = JSON.stringify({ v1: randomBytes(32).toString("base64") });
  process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION = "v1";
  const encrypted = encryptSecret("secret-value", "user:key");
  assert.equal(decryptSecret(encrypted, "user:key"), "secret-value");
});

test("دست‌کاری متن رمز یا متن همراه رد می‌شود", () => {
  process.env.API_KEY_ENCRYPTION_KEYS = JSON.stringify({ v1: randomBytes(32).toString("base64") });
  process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION = "v1";
  const encrypted = encryptSecret("secret-value", "user:key");
  const changedFirstByte = `${encrypted.ciphertext[0] === "A" ? "B" : "A"}${encrypted.ciphertext.slice(1)}`;
  assert.throws(() => decryptSecret({ ...encrypted, ciphertext: changedFirstByte }, "user:key"));
  assert.throws(() => decryptSecret(encrypted, "another:key"));
});

test("نسخهٔ قدیمی پس از چرخش کلید همچنان خوانده می‌شود", () => {
  const v1 = randomBytes(32).toString("base64");
  const v2 = randomBytes(32).toString("base64");
  process.env.API_KEY_ENCRYPTION_KEYS = JSON.stringify({ v1, v2 });
  process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION = "v1";
  const oldSecret = encryptSecret("old-secret", "context");
  process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION = "v2";
  assert.equal(decryptSecret(oldSecret, "context"), "old-secret");
  assert.equal(encryptSecret("new-secret", "context").keyVersion, "v2");
});
