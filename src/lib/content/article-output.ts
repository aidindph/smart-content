export type KeywordTarget = { keyword: string; density: number };

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const inline = (value: string) => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.+?)\*/g, "<em>$1</em>")
  .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');

export function markdownToArticleHtml(markdown: string, language = "fa") {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const output: string[] = [`<article lang="${escapeHtml(language)}" dir="${language === "fa" || language === "ar" ? "rtl" : "ltr"}">`];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  const flushParagraph = () => { if (paragraph.length) output.push(`<p>${inline(paragraph.join(" "))}</p>`); paragraph = []; };
  const closeList = () => { if (list) output.push(`</${list}>`); list = null; };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); closeList(); continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) { flushParagraph(); closeList(); const level = heading[1].length; output.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (bullet || numbered) { flushParagraph(); const next = bullet ? "ul" : "ol"; if (list !== next) { closeList(); list = next; output.push(`<${next}>`); } output.push(`<li>${inline((bullet ?? numbered)![1])}</li>`); continue; }
    paragraph.push(line);
  }
  flushParagraph(); closeList(); output.push("</article>");
  return output.join("\n");
}

export function analyzeSeo(markdown: string, targets: KeywordTarget[], targetWords: number) {
  const plain = markdown.replace(/[#*_`>\[\]()!-]/g, " ").replace(/\s+/g, " ").trim();
  const words = plain ? plain.split(/\s+/) : [];
  const headings = markdown.split(/\r?\n/).filter((line) => /^#{1,3}\s+/.test(line));
  const keywordResults = targets.filter((target) => target.keyword).map((target) => {
    const escaped = target.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (plain.match(new RegExp(escaped, "giu")) ?? []).length;
    const actualDensity = words.length ? Number(((count * target.keyword.trim().split(/\s+/).length / words.length) * 100).toFixed(2)) : 0;
    return { ...target, count, actualDensity, withinTarget: Math.abs(actualDensity - target.density) <= Math.max(.35, target.density * .45) };
  });
  const hasSingleH1 = markdown.split(/\r?\n/).filter((line) => /^#\s+/.test(line)).length === 1;
  const wordRangeOk = words.length >= targetWords * .8 && words.length <= targetWords * 1.2;
  const checks = [hasSingleH1, headings.length >= 4, wordRangeOk, keywordResults.every((item) => item.count > 0), plain.length > 300];
  const score = Math.round(checks.filter(Boolean).length / checks.length * 100);
  return { score, status: score >= 80 ? "ready" : score >= 60 ? "review" : "needs_work", wordCount: words.length, headingCount: headings.length, hasSingleH1, wordRangeOk, keywords: keywordResults };
}

export function buildImageSuggestions(markdown: string, requestedTopics: string[], count: number) {
  const headings = markdown.split(/\r?\n/).flatMap((line) => { const match = /^##\s+(.+)$/.exec(line.trim()); return match ? [match[1]] : []; });
  const topics = [...requestedTopics, ...headings].filter((value, index, all) => value && all.indexOf(value) === index).slice(0, Math.max(count, requestedTopics.length));
  return topics.map((title, index) => ({ title, placement: index === 0 ? "پس از مقدمه" : `پس از بخش «${title}»`, altText: `تصویر مرتبط با ${title}`, aspectRatio: index === 0 ? "16:9" : "1:1" }));
}
