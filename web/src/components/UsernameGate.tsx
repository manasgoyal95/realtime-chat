import { useState } from "react";

const NAMES = [
  "Nova",
  "Echo",
  "Sage",
  "Orbit",
  "Atlas",
  "Piper",
  "Wren",
  "Kai",
  "Lumen",
  "Juno",
];

function sanitize(s: string) {
  return s.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 32);
}

export function UsernameGate(props: {
  onSubmit: (name: string) => void;
  roomId?: string;
}) {
  const [name, setName] = useState("");
  const suggestion = NAMES[Math.floor(Math.random() * NAMES.length)];

  return (
    <div className="w-full max-w-sm bg-ink-800 border border-ink-700 rounded-2xl p-6 shadow-xl">
      <h1 className="text-xl font-semibold mb-1">
        {props.roomId ? "Join room" : "Join the chat"}
      </h1>
      <p className="text-ink-300 text-sm mb-5">
        {props.roomId ? (
          <>
            You're joining{" "}
            <span className="font-mono text-ink-100">{props.roomId}</span>.
            Pick a display name — everyone in the room will see it.
          </>
        ) : (
          "Pick a display name. It'll be visible to everyone in the room."
        )}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = sanitize(name || suggestion).trim();
          if (trimmed) props.onSubmit(trimmed);
        }}
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(sanitize(e.target.value))}
          placeholder={suggestion}
          maxLength={32}
          className="w-full rounded-lg bg-ink-900 border border-ink-700 focus:border-indigo-500 focus:ring-0 text-ink-50 px-3 py-2 outline-none"
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 transition"
        >
          Join
        </button>
      </form>
      <p className="text-xs text-ink-400 mt-4">
        No account, no password. Your name is saved locally so you don't have
        to re-enter it.
      </p>
    </div>
  );
}
