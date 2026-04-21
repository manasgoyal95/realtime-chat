import type { Message } from "./types";

export async function fetchMessages(params?: { since?: number; limit?: number }): Promise<Message[]> {
  const q = new URLSearchParams();
  if (params?.since !== undefined) q.set("since", String(params.since));
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  const res = await fetch(`/api/messages${q.toString() ? `?${q}` : ""}`);
  if (!res.ok) throw new Error(`messages fetch failed: ${res.status}`);
  return (await res.json()) as Message[];
}
