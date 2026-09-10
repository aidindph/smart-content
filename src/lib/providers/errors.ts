export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_key" | "rate_limited" | "unavailable" | "invalid_response" | "unsupported",
    readonly retryable: boolean,
    readonly status?: number,
    readonly providerDetail?: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function errorFromStatus(status: number, providerDetail?: string) {
  const detail = providerDetail?.trim().slice(0, 500);
  const withDetail = (message: string) => detail ? `${message} جزئیات ارائه‌دهنده: ${detail}` : message;
  if (status === 400) {
    return new ProviderError(withDetail("مدل انتخاب‌شده ورودی این درخواست را نپذیرفت."), "invalid_response", false, status, detail);
  }
  if (status === 401 || status === 403) {
    return new ProviderError(withDetail("کلید دسترسی یا مجوز استفاده از مدل پذیرفته نشد."), "invalid_key", false, status, detail);
  }
  if (status === 429) {
    return new ProviderError(withDetail("سقف درخواست یا اعتبار ارائه‌دهنده موقتاً پر شده است."), "rate_limited", true, status, detail);
  }
  if (status === 404) return new ProviderError(withDetail("مدل انتخاب‌شده در ارائه‌دهنده پیدا نشد یا دیگر در دسترس نیست."), "unsupported", false, status, detail);
  if (status >= 500) {
    return new ProviderError(withDetail("سرویس ارائه‌دهنده موقتاً در دسترس نیست."), "unavailable", true, status, detail);
  }
  return new ProviderError(withDetail("درخواست ارائه‌دهنده پذیرفته نشد."), "invalid_response", false, status, detail);
}
