export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_key" | "rate_limited" | "unavailable" | "invalid_response" | "unsupported",
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function errorFromStatus(status: number) {
  if (status === 401 || status === 403) {
    return new ProviderError("کلید دسترسی پذیرفته نشد.", "invalid_key", false, status);
  }
  if (status === 429) {
    return new ProviderError("سقف درخواست ارائه‌دهنده موقتاً پر شده است.", "rate_limited", true, status);
  }
  if (status >= 500) {
    return new ProviderError("سرویس ارائه‌دهنده موقتاً در دسترس نیست.", "unavailable", true, status);
  }
  return new ProviderError("درخواست ارائه‌دهنده پذیرفته نشد.", "invalid_response", false, status);
}
