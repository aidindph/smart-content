import { ProviderError } from "./errors";
import type { ConnectionTestResult } from "./types";

export function connectionFailure(error: unknown): ConnectionTestResult {
  if (!(error instanceof ProviderError)) {
    return { ok: false, code: "unexpected", message: "آزمایش اتصال انجام نشد." };
  }

  const code = error.code === "invalid_response" || error.code === "unsupported"
    ? "unexpected"
    : error.code;

  return { ok: false, code, message: error.message };
}
