export function recordingRange(header: string | null, size: number) {
  if (!Number.isSafeInteger(size) || size < 1) throw new Error("size");
  let start = 0,
    end = size - 1;
  if (header) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(header);
    if (!m || (!m[1] && !m[2])) throw new Error("range");
    if (!m[1]) {
      const suffix = Number(m[2]);
      if (suffix < 1) throw new Error("range");
      start = Math.max(0, size - suffix);
    } else {
      start = Number(m[1]);
      if (m[2]) end = Math.min(end, Number(m[2]));
    }
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw new Error("range");
  return { start, end: Math.min(end, start + 8 * 1024 * 1024 - 1) };
}
