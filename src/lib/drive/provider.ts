import "server-only";
import { GoogleAuth } from "google-auth-library";
import { ApiError, safeId } from "@/lib/server/api";
export const folderMime = "application/vnd.google-apps.folder";
export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
  modifiedTime?: string;
  trashed?: boolean;
  capabilities?: { canDownload?: boolean };
};
export type DrivePage = {
  files: DriveFile[];
  nextPageToken?: string;
  incompleteSearch?: boolean;
};
const fixture: DriveFile[] = [
  { id: "mock-root", name: "مكتبة اختبار محلية", mimeType: folderMime },
  {
    id: "mock-subject",
    name: "مادة تجريبية",
    mimeType: folderMime,
    parents: ["mock-root"],
  },
  {
    id: "mock-nested",
    name: "سلسلة اختبار",
    mimeType: folderMime,
    parents: ["mock-subject"],
  },
  {
    id: "mock-audio-01",
    name: "الدرس ٠١ - تسجيل وهمي.wav",
    mimeType: "audio/wav",
    parents: ["mock-nested"],
    size: "76",
    modifiedTime: "2026-01-01T00:00:00Z",
    capabilities: { canDownload: true },
  },
  {
    id: "mock-audio-02",
    name: "الدرس 02 - اختبار محلي.wav",
    mimeType: "audio/wav",
    parents: ["mock-nested"],
    size: "76",
    modifiedTime: "2026-01-02T00:00:00Z",
    capabilities: { canDownload: true },
  },
  {
    id: "mock-document",
    name: "ملف ليس تسجيلاً",
    mimeType: "text/plain",
    parents: ["mock-subject"],
  },
  {
    id: "mock-shortcut",
    name: "اختصار يُتجاهل",
    mimeType: "application/vnd.google-apps.shortcut",
    parents: ["mock-subject"],
  },
];
export function isMockDrive() {
  if (process.env.DRIVE_PROVIDER !== "mock") return false;
  if (
    process.env.APP_ENV !== "local" ||
    process.env.FIREBASE_PROJECT_ID !== "demo-tafaqquh" ||
    process.env.FIREBASE_USE_EMULATORS !== "true" ||
    process.env.NODE_ENV === "production"
  )
    throw new ApiError(503, "المحاكاة مسموحة محليًا مع مشروع المحاكيات فقط.");
  return true;
}
export function driveRoots() {
  if (isMockDrive()) return ["mock-root"];
  if (process.env.DRIVE_ENABLED !== "true")
    throw new ApiError(
      503,
      "تكامل Drive غير مفعّل. يلزم إذن القراءة وإعداد هوية الخادم أولًا.",
    );
  const roots = (process.env.DRIVE_ALLOWED_ROOTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!roots.length || roots.length > 20 || roots.some((r) => !safeId(r)))
    throw new ApiError(503, "قائمة مجلدات Drive المسموحة غير مهيأة.");
  return roots;
}
async function driveFetch(path: string, media = false, headers?: HeadersInit) {
  driveRoots();
  if (media && process.env.DRIVE_MEDIA_ENABLED !== "true")
    throw new ApiError(503, "تشغيل التسجيلات لم يُفعّل بعد.");
  const auth = new GoogleAuth({
    scopes: [
      `https://www.googleapis.com/auth/drive.${media ? "readonly" : "metadata.readonly"}`,
    ],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new ApiError(503, "تعذّر الحصول على اعتماد Drive.");
  const r = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { ...headers, Authorization: `Bearer ${token.token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok)
    throw new ApiError(
      r.status === 404 || r.status === 403 ? 403 : 503,
      "تعذّرت قراءة الملف أو أن إذن Drive غير متاح.",
    );
  return r;
}
export async function driveFile(id: string): Promise<DriveFile> {
  if (!safeId(id)) throw new ApiError(400, "معرف Drive غير صالح.");
  if (isMockDrive()) {
    const f = fixture.find((f) => f.id === id);
    if (!f) throw new ApiError(404, "ملف غير موجود.");
    return f;
  }
  const r = await driveFetch(
    `files/${id}?supportsAllDrives=true&fields=id,name,mimeType,parents,size,modifiedTime,trashed,capabilities(canDownload)`,
  );
  return r.json();
}
export async function driveChildren(
  id: string,
  pageToken?: string,
): Promise<DrivePage> {
  if (!safeId(id)) throw new ApiError(400, "مجلد غير صالح.");
  if (isMockDrive()) {
    const all = fixture.filter((f) => f.parents?.includes(id));
    const offset = Number(pageToken ?? 0);
    return {
      files: all.slice(offset, offset + 1),
      ...(offset + 1 < all.length ? { nextPageToken: String(offset + 1) } : {}),
    };
  }
  const params = new URLSearchParams({
    q: `'${id}' in parents and trashed = false`,
    pageSize: "100",
    fields:
      "nextPageToken,incompleteSearch,files(id,name,mimeType,parents,size,modifiedTime,trashed)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    ...(pageToken ? { pageToken } : {}),
  });
  return (await driveFetch(`files?${params}`)).json();
}
export async function withinRoot(id: string, root: string) {
  let current = id;
  const seen = new Set<string>();
  for (let depth = 0; depth < 64; depth++) {
    if (seen.has(current)) break;
    seen.add(current);
    const file = await driveFile(current);
    if (file.trashed) return false;
    if (current === root) return true;
    if (file.parents?.length !== 1) return false;
    current = file.parents[0];
  }
  return false;
}
export async function allowedRoot(id: string) {
  for (const root of driveRoots()) if (await withinRoot(id, root)) return;
  throw new ApiError(403, "المجلد خارج النطاق المسموح.");
}
export async function driveMedia(id: string, start: number, end: number) {
  if (isMockDrive()) {
    const bytes = Buffer.alloc(76);
    bytes.write("RIFF");
    bytes.writeUInt32LE(68, 4);
    bytes.write("WAVEfmt ", 8);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(8000, 24);
    bytes.writeUInt32LE(16000, 28);
    bytes.writeUInt16LE(2, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write("data", 36);
    bytes.writeUInt32LE(32, 40);
    return new Response(bytes.subarray(start, end + 1), { status: 206 });
  }
  return driveFetch(`files/${id}?alt=media&supportsAllDrives=true`, true, {
    Range: `bytes=${start}-${end}`,
  });
}
