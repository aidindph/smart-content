import type { ProviderModel } from "./types";

/**
 * انتخاب مدل متن فقط هنگام ثبت یا آزمایش کلید انجام می‌شود. شناسهٔ انتخاب‌شده
 * روی اتصال ذخیره خواهد شد تا فرم‌های کاربر نتوانند مدل ناسازگار بفرستند.
 */
export function selectDefaultTextModel(providerSlug: string, models: ProviderModel[]) {
  const textModels = models.filter((model) => model.kind === "text" || model.kind === "multimodal");
  if (providerSlug === "google-gemini") {
    const preferred = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"];
    for (const modelId of preferred) {
      const model = textModels.find((item) => item.id === modelId);
      if (model) return model;
    }
  }
  return textModels[0];
}
