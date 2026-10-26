import type { User } from "firebase/auth";
export async function adminCall<T>(
  user: User,
  url: string,
  body?: unknown,
): Promise<T> {
  const token = await user.getIdToken();
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "تعذّر إتمام الطلب.");
  return data;
}
