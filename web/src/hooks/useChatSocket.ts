import { useCallback, useEffect, useRef, useState } from "react";
import type { SendPayload, ServerEvent } from "../lib/types";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

export function useChatSocket(opts: {
  user: string | null;
  room: string | null;
  onEvent: (ev: ServerEvent) => void;
  onReconnect?: () => void;
}) {
  const { user, room, onEvent, onReconnect } = opts;
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(250);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const hasConnectedOnceRef = useRef(false);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  const connect = useCallback(() => {
    if (!user || !room) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws?user=${encodeURIComponent(user)}&room=${encodeURIComponent(room)}`;
    setStatus(hasConnectedOnceRef.current ? "reconnecting" : "connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 250;
      setStatus("open");
      if (hasConnectedOnceRef.current) {
        onReconnectRef.current?.();
      }
      hasConnectedOnceRef.current = true;
    };
    ws.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as ServerEvent;
        onEventRef.current(ev);
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      if (!shouldReconnectRef.current) {
        setStatus("closed");
        return;
      }
      setStatus("reconnecting");
      const delay = backoffRef.current;
      backoffRef.current = Math.min(5000, Math.floor(delay * 1.8));
      retryRef.current = setTimeout(connect, delay);
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [user, room]);

  useEffect(() => {
    if (!user || !room) return;
    shouldReconnectRef.current = true;
    hasConnectedOnceRef.current = false; // reset so room switches show "connecting" not "reconnecting"
    connect();
    return () => {
      shouldReconnectRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user, room, connect]);

  const send = useCallback((payload: SendPayload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  return { status, send };
}
