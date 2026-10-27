export function lessonNumber(name: string): number | null {
  const normalized = name.replace(/[٠-٩۰-۹]/g, (c) =>
    String(c.charCodeAt(0) - (c >= "۰" ? 1776 : 1632)),
  );
  const match =
    normalized.match(
      /(?:الدرس|درس|lesson|lecture|جلسة|المجلس)\s*[-_()#:\s]*([0-9]{1,4})(?![0-9])/i,
    ) ?? normalized.match(/^\s*([0-9]{1,3})\s*[-_. )]/);
  return match ? Number(match[1]) : null;
}
export function titleFromFile(name: string) {
  return name
    .replace(/\.(mp3|mp4|m4a|wav|ogg|webm|aac|flac)$/i, "")
    .slice(0, 200);
}
