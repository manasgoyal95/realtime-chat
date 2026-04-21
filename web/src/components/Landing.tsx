import { useEffect, useState } from "react";
import { newRoomSlug, normalizeSlug } from "../lib/slug";

const LAST_ROOM_KEY = "pulse.lastRoom";

export function Landing(props: { onEnterRoom: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [lastRoom, setLastRoom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLastRoom(localStorage.getItem(LAST_ROOM_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  const startNewChat = () => {
    props.onEnterRoom(newRoomSlug());
  };

  const joinWithCode = () => {
    const normalized = normalizeSlug(code);
    if (!normalized) {
      setError(
        "Room codes must be 3–40 chars, lowercase letters, digits, or dashes.",
      );
      return;
    }
    setError(null);
    props.onEnterRoom(normalized);
  };

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-indigo-500 grid place-items-center font-bold">
            P
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Pulse</h1>
            <p className="text-sm text-ink-400">Lightweight realtime chat.</p>
          </div>
        </div>

        <div className="bg-ink-800 border border-ink-700 rounded-2xl p-6 shadow-xl space-y-5">
          <div>
            <h2 className="font-semibold text-lg mb-1">Start a conversation</h2>
            <p className="text-sm text-ink-400 mb-3">
              Creates a fresh room with its own link. Share that link with
              anyone you want in the chat.
            </p>
            <button
              onClick={startNewChat}
              className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2.5 transition"
            >
              Start a new chat
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-ink-700" />
            <span className="text-xs uppercase tracking-wider text-ink-500">
              or
            </span>
            <div className="flex-1 h-px bg-ink-700" />
          </div>

          <div>
            <h2 className="font-semibold text-sm mb-2">
              Have a room code or invite link?
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                joinWithCode();
              }}
              className="flex gap-2"
            >
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="verdant-koala-241"
                maxLength={80}
                className="flex-1 rounded-lg bg-ink-900 border border-ink-700 focus:border-indigo-500 focus:ring-0 text-ink-50 px-3 py-2 outline-none text-sm"
              />
              <button
                type="submit"
                disabled={!code.trim()}
                className="rounded-lg bg-ink-700 hover:bg-ink-600 disabled:bg-ink-800 disabled:text-ink-500 text-ink-50 font-medium px-4 transition text-sm"
              >
                Join
              </button>
            </form>
            {error && (
              <p className="text-xs text-red-400 mt-1.5">{error}</p>
            )}
          </div>
        </div>

        {lastRoom && (
          <div className="mt-4 text-center">
            <button
              onClick={() => props.onEnterRoom(lastRoom)}
              className="text-sm text-ink-400 hover:text-indigo-400 transition"
            >
              ← Return to your last chat:{" "}
              <span className="font-mono text-ink-300">{lastRoom}</span>
            </button>
          </div>
        )}

        <p className="text-xs text-ink-500 mt-6 leading-relaxed text-center">
          No accounts. Each room is public to anyone with the link — this is
          not an end-to-end encrypted messenger.
        </p>
      </div>
    </div>
  );
}
