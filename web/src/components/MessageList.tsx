import { useEffect, useRef } from "react";
import type { Message } from "../lib/types";
import { colorForName } from "./PresenceBar";

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayHeader(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function MessageList(props: { messages: Message[]; me: string }) {
  const { messages, me } = props;
  const endRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  // Track whether user is scrolled to bottom; auto-scroll only if so.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 60;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  let lastDay = "";
  let lastUser = "";

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
    >
      {messages.length === 0 && (
        <div className="h-full grid place-items-center text-ink-400 text-sm">
          No messages yet — say hello 👋
        </div>
      )}
      {messages.map((m) => {
        const day = formatDayHeader(m.ts);
        const dayBreak = day !== lastDay;
        lastDay = day;
        const userBreak = m.user !== lastUser || dayBreak;
        lastUser = m.user;
        const mine = m.user === me;
        return (
          <div key={`${m.id}-${m.clientId ?? ""}`}>
            {dayBreak && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-ink-700" />
                <span className="text-xs uppercase tracking-wider text-ink-400">
                  {day}
                </span>
                <div className="flex-1 h-px bg-ink-700" />
              </div>
            )}
            <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <div className="w-8 flex-shrink-0">
                {userBreak && (
                  <div
                    className="h-8 w-8 rounded-full grid place-items-center text-xs font-bold"
                    style={{ background: colorForName(m.user) }}
                  >
                    {m.user.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div
                className={`max-w-[75%] ${mine ? "text-right items-end" : ""}`}
              >
                {userBreak && (
                  <div
                    className={`text-xs text-ink-400 mb-0.5 ${mine ? "text-right" : ""}`}
                  >
                    <span className="font-semibold text-ink-200">
                      {mine ? "You" : m.user}
                    </span>
                    <span className="ml-2">{formatTime(m.ts)}</span>
                  </div>
                )}
                <div
                  className={`inline-block rounded-2xl px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words ${
                    mine
                      ? "bg-indigo-500 text-white rounded-br-md"
                      : "bg-ink-800 text-ink-50 rounded-bl-md border border-ink-700"
                  } ${m.pending ? "opacity-60" : ""} ${m.failed ? "ring-1 ring-red-400/70" : ""}`}
                >
                  {m.body}
                </div>
                {m.failed && (
                  <div className="text-xs text-red-400 mt-0.5">
                    Failed to send
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
