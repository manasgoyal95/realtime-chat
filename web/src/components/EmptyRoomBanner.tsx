import { useState } from "react";

export function EmptyRoomBanner(props: { roomId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard denied — ignore */
    }
  };

  return (
    <div className="mx-4 mt-4 rounded-xl border border-ink-700 bg-ink-800/60 px-4 py-3 flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-300 grid place-items-center text-sm">
        ✦
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-100">
          You're alone in <span className="font-mono text-ink-200">{props.roomId}</span>
        </p>
        <p className="text-xs text-ink-400">
          Copy this page's link and send it to anyone you want to chat with.
        </p>
      </div>
      <button
        onClick={copy}
        className="flex-shrink-0 text-xs font-medium rounded-md bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 transition"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
