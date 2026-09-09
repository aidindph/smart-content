type ArticlePromptInput = {
  topic: string;
  keywords: string[];
  language: string;
  audience: string;
  tone: string;
  targetWords: number;
  keywordTargets?: Array<{ keyword: string; density: number }>;
  searchIntent?: string;
  contentType?: string;
  pointOfView?: string;
  faqCount?: number;
  requiredHeadings?: string[];
  contentBrief?: string;
  callToAction?: string;
  forbiddenTerms?: string[];
  internalLinks?: string[];
};

const toneLabels: Record<string, string> = {
  professional: "حرفه‌ای و دقیق",
  friendly: "صمیمی و روان",
  persuasive: "اقناعی",
  educational: "آموزشی و مرحله‌ای",
  creative: "خلاقانه",
};

export function buildArticlePrompt(input: ArticlePromptInput) {
  const targets = input.keywordTargets?.filter((item) => item.keyword) ?? input.keywords.map((keyword) => ({ keyword, density: 1 }));
  const keywordText = targets.length ? targets.map((item) => `${item.keyword} (هدف تقریبی ${item.density}٪؛ بدون تکرار مصنوعی)`).join("، ") : "بدون کلیدواژهٔ اجباری";
  return [
    "یک مقالهٔ کامل و آمادهٔ انتشار بنویس.",
    `موضوع: ${input.topic}`,
    `زبان: ${input.language === "fa" ? "فارسی" : input.language}`,
    `مخاطب: ${input.audience}`,
    `لحن: ${toneLabels[input.tone] ?? input.tone}`,
    `طول هدف: حدود ${input.targetWords} واژه` ,
    `کلیدواژه‌ها: ${keywordText}`,
    `هدف جست‌وجو: ${input.searchIntent ?? "اطلاعاتی"}`,
    `نوع محتوا: ${input.contentType ?? "مقالهٔ راهنمای جامع"}`,
    `دیدگاه نوشتار: ${input.pointOfView ?? "دوم شخص محترمانه"}`,
    input.requiredHeadings?.length ? `عنوان‌های الزامی: ${input.requiredHeadings.join(" | ")}` : "",
    input.contentBrief ? `نکات و داده‌های ضروری: ${input.contentBrief}` : "",
    input.callToAction ? `فراخوان اقدام پایانی: ${input.callToAction}` : "",
    input.internalLinks?.length ? `نشانی‌های پیشنهادی برای پیوند داخلی: ${input.internalLinks.join("، ")}` : "",
    input.forbiddenTerms?.length ? `عبارت‌های ممنوع: ${input.forbiddenTerms.join("، ")}` : "",
    (input.faqCount ?? 3) > 0 ? `در پایان ${input.faqCount ?? 3} پرسش متداول کوتاه و مفید اضافه کن.` : "پرسش متداول اضافه نکن.",
    "متن را طبیعی، روان و متنوع بنویس؛ از عبارت‌های کلیشه‌ای، مقدمهٔ کش‌دار، تکرار نتیجه و الگوهای ماشینی دوری کن.",
    "اصول سئو را با اولویت دادن به پاسخ مفید برای انسان رعایت کن؛ کلیدواژه‌ها را فقط در جای طبیعی به کار ببر.",
    "خروجی را با یک عنوان سطح یک آغاز کن و سپس مقدمه، بخش‌های منظم با عنوان‌های سطح دو و سه، و جمع‌بندی بده.",
    "از ادعاهای ساختگی، آمار بدون منبع و تکرار بی‌هدف خودداری کن. خروجی فقط متن نهایی با قالب مارک‌داون باشد.",
  ].filter(Boolean).join("\n");
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
