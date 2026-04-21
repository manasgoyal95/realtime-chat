import { useCallback, useRef, useState } from "react";

export function MessageInput(props: {
  onSend: (body: string) => void;
  onTyping: () => void;
  disabled?: boolean;
}) {
  const { onSend, onTyping, disabled } = props;
  const [value, setValue] = useState("");
  const lastTypingAt = useRef(0);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingAt.current > 3000) {
      lastTypingAt.current = now;
      onTyping();
    }
  }, [onTyping]);

  const handleSend = () => {
    const body = value.trim();
    if (!body || disabled) return;
    onSend(body);
    setValue("");
    lastTypingAt.current = 0;
    // reset textarea height
    if (taRef.current) taRef.current.style.height = "auto";
  };

  return (
    <div className="border-t border-ink-700 bg-ink-900 px-3 py-3">
      <div className="flex items-end gap-2 bg-ink-800 border border-ink-700 rounded-2xl px-3 py-2 focus-within:border-indigo-500 transition">
        <textarea
          ref={taRef}
          value={value}
          rows={1}
          placeholder={disabled ? "Connecting…" : "Message the room"}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            if (e.target.value.length > 0) emitTyping();
            // autoresize
            const t = e.target;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 bg-transparent resize-none outline-none text-[15px] placeholder:text-ink-500 disabled:opacity-60 max-h-40"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="h-8 px-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:bg-ink-700 disabled:text-ink-500 text-white text-sm font-medium transition"
        >
          Send
        </button>
      </div>
      <p className="text-[11px] text-ink-500 mt-1.5 px-1">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
