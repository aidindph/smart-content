type ArticlePromptInput = {
  topic: string;
  keywords: string[];
  language: string;
  audience: string;
  tone: string;
  targetWords: number;
};

const toneLabels: Record<string, string> = {
  professional: "حرفه‌ای و دقیق",
  friendly: "صمیمی و روان",
  persuasive: "اقناعی",
  educational: "آموزشی و مرحله‌ای",
  creative: "خلاقانه",
};

export function buildArticlePrompt(input: ArticlePromptInput) {
  const keywordText = input.keywords.length ? input.keywords.join("، ") : "بدون کلیدواژهٔ اجباری";
  return [
    "یک مقالهٔ کامل و آمادهٔ انتشار بنویس.",
    `موضوع: ${input.topic}`,
    `زبان: ${input.language === "fa" ? "فارسی" : input.language}`,
    `مخاطب: ${input.audience}`,
    `لحن: ${toneLabels[input.tone] ?? input.tone}`,
    `طول هدف: حدود ${input.targetWords} واژه` ,
    `کلیدواژه‌ها: ${keywordText}`,
    "خروجی را با یک عنوان سطح یک آغاز کن و سپس مقدمه، بخش‌های منظم با عنوان‌های سطح دو و سه، و جمع‌بندی بده.",
    "از ادعاهای ساختگی، آمار بدون منبع و تکرار بی‌هدف خودداری کن. خروجی فقط متن نهایی با قالب مارک‌داون باشد.",
  ].join("\n");
}

export function extractArticleTitle(markdown: string, fallback: string) {
  const firstHeading = markdown.split(/\r?\n/).find((line) => /^#\s+\S/.test(line.trim()));
  return firstHeading?.replace(/^#\s+/, "").trim().slice(0, 300) || fallback;
}

export function buildImagePrompt(topic: string, title: string, position: number) {
  return [
    `تصویر تحریریه‌ای باکیفیت برای مقاله‌ای با عنوان «${title}» و موضوع «${topic}».`,
    position === 0 ? "تصویر اصلی و چشمگیر برای بالای مقاله." : `تصویر توضیحی شمارهٔ ${position} برای بخش میانی مقاله.`,
    "بدون نوشته، لوگو، نشان تجاری یا واترمارک؛ ترکیب‌بندی تمیز و مناسب وب.",
  ].join(" ");
}
