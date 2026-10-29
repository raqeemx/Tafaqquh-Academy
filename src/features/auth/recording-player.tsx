"use client";
export function RecordingPlayer({
  kind,
  url,
  onError,
}: {
  kind: "audio" | "video" | null;
  url: string;
  onError: () => void;
}) {
  const props = {
    src: url,
    controls: true,
    preload: "none" as const,
    className: "library-player",
    onError,
  };
  if (kind === "audio")
    return <audio {...props} aria-label="مشغّل التسجيل الصوتي" />;
  if (kind === "video")
    return <video {...props} aria-label="مشغّل الدرس المرئي" />;
  return (
    <p role="status">نوع التسجيل غير معروف؛ اطلب من الإدارة تحديث فهرسته.</p>
  );
}
