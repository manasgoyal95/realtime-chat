import type { Message } from "./types";

export async function fetchMessages(params: {
  room: string;
  since?: number;
  limit?: number;
}): Promise<Message[]> {
  const q = new URLSearchParams();
  q.set("room", params.room);
  if (params.since !== undefined) q.set("since", String(params.since));
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  const res = await fetch(`/api/messages?${q.toString()}`);
  if (!res.ok) throw new Error(`messages fetch failed: ${res.status}`);
  return (await res.json()) as Message[];
}
