import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UsernameGate } from "./components/UsernameGate";
import { PresenceBar } from "./components/PresenceBar";
import { MessageList } from "./components/MessageList";
import { MessageInput } from "./components/MessageInput";
import { TypingIndicator } from "./components/TypingIndicator";
import { useChatSocket } from "./hooks/useChatSocket";
import { fetchMessages } from "./lib/api";
import type { Message, ServerEvent } from "./lib/types";

const USER_KEY = "pulse.username";

const randomClientId = () =>
  `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function App() {
  const [user, setUser] = useState<string | null>(() => {
    try {
      return localStorage.getItem(USER_KEY);
    } catch {
      return null;
    }
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSeenIdRef = useRef<number>(0);

  const updateLastSeen = (id: number) => {
    if (id > lastSeenIdRef.current) lastSeenIdRef.current = id;
  };

  const mergeMessages = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const byId = new Map<number, Message>();
      for (const m of prev) if (m.id > 0) byId.set(m.id, m);
      for (const m of incoming) byId.set(m.id, m);
      const pending = prev.filter((m) => m.id <= 0);
      const merged = [...byId.values(), ...pending].sort((a, b) => {
        // pending (id <= 0) sort to the end by clientId insertion order (stable via ts fallback)
        if (a.id <= 0 && b.id > 0) return 1;
        if (b.id <= 0 && a.id > 0) return -1;
        return a.id - b.id;
      });
      for (const m of incoming) updateLastSeen(m.id);
      return merged;
    });
  }, []);

  const handleEvent = useCallback(
    (ev: ServerEvent) => {
      switch (ev.type) {
        case "message": {
          updateLastSeen(ev.id);
          setMessages((prev) => {
            // if this is an ack of our pending message, replace it
            if (ev.clientId) {
              const idx = prev.findIndex((m) => m.clientId === ev.clientId && m.pending);
              if (idx >= 0) {
                const next = prev.slice();
                next[idx] = {
                  id: ev.id,
                  user: ev.user,
                  body: ev.body,
                  ts: ev.ts,
                  clientId: ev.clientId,
                };
                return next;
              }
            }
            if (prev.some((m) => m.id === ev.id)) return prev;
            return [
              ...prev,
              { id: ev.id, user: ev.user, body: ev.body, ts: ev.ts, clientId: ev.clientId },
            ];
          });
          break;
        }
        case "ack": {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.clientId === ev.clientId && m.pending);
            if (idx < 0) return prev;
            const next = prev.slice();
            next[idx] = { ...next[idx], id: ev.id, pending: false };
            return next;
          });
          updateLastSeen(ev.id);
          break;
        }
        case "presence":
          setOnline(ev.online);
          break;
        case "typing": {
          if (ev.user === user) break;
          setTypingUsers((t) => ({ ...t, [ev.user]: Date.now() }));
          if (typingTimers.current[ev.user]) clearTimeout(typingTimers.current[ev.user]);
          typingTimers.current[ev.user] = setTimeout(() => {
            setTypingUsers((t) => {
              const { [ev.user]: _ignore, ...rest } = t;
              return rest;
            });
            delete typingTimers.current[ev.user];
          }, 3500);
          break;
        }
        case "typing_stop":
          setTypingUsers((t) => {
            const { [ev.user]: _ignore, ...rest } = t;
            return rest;
          });
          if (typingTimers.current[ev.user]) {
            clearTimeout(typingTimers.current[ev.user]);
            delete typingTimers.current[ev.user];
          }
          break;
      }
    },
    [user],
  );

  const loadSince = useCallback(async () => {
    try {
      if (lastSeenIdRef.current === 0) {
        const recent = await fetchMessages({ limit: 50 });
        mergeMessages(recent);
      } else {
        const missed = await fetchMessages({ since: lastSeenIdRef.current });
        if (missed.length) mergeMessages(missed);
      }
    } catch (e) {
      console.warn("history fetch failed", e);
    }
  }, [mergeMessages]);

  const { status, send } = useChatSocket({
    user,
    onEvent: handleEvent,
    onReconnect: loadSince,
  });

  useEffect(() => {
    if (!user) return;
    void loadSince();
  }, [user, loadSince]);

  // Retry failed-send detection: if a pending message hasn't been acked in 8s, mark failed.
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages((prev) => {
        let changed = false;
        const now = Date.now();
        const next = prev.map((m) => {
          if (m.pending && !m.failed) {
            const age = now - new Date(m.ts).getTime();
            if (age > 8000) {
              changed = true;
              return { ...m, failed: true };
            }
          }
          return m;
        });
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = useCallback(
    (body: string) => {
      if (!user) return;
      const clientId = randomClientId();
      const optimistic: Message = {
        id: -Date.now(),
        user,
        body,
        ts: new Date().toISOString(),
        clientId,
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      const ok = send({ type: "message", body, clientId });
      if (!ok) {
        setMessages((prev) =>
          prev.map((m) => (m.clientId === clientId ? { ...m, failed: true } : m)),
        );
      }
    },
    [user, send],
  );

  const handleTyping = useCallback(() => {
    send({ type: "typing" });
  }, [send]);

  const handleUsername = useCallback((name: string) => {
    try {
      localStorage.setItem(USER_KEY, name);
    } catch {
      /* ignore */
    }
    setUser(name);
  }, []);

  const activeTyping = useMemo(
    () => Object.keys(typingUsers).filter((u) => u !== user),
    [typingUsers, user],
  );

  if (!user) {
    return <UsernameGate onSubmit={handleUsername} />;
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto bg-ink-900">
      <PresenceBar online={online} me={user} status={status} />
      <MessageList messages={messages} me={user} />
      <TypingIndicator users={activeTyping} />
      <MessageInput
        onSend={handleSend}
        onTyping={handleTyping}
        disabled={status !== "open"}
      />
    </div>
  );
}
