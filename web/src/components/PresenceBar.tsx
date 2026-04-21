import type { ConnectionStatus } from "../hooks/useChatSocket";

const colorForName = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 60% 55%)`;
};

function StatusDot({ status }: { status: ConnectionStatus }) {
  const label = {
    connecting: "Connecting…",
    open: "Live",
    reconnecting: "Reconnecting…",
    closed: "Offline",
  }[status];
  const color = {
    connecting: "bg-amber-400",
    open: "bg-emerald-400",
    reconnecting: "bg-amber-400 animate-pulse",
    closed: "bg-red-400",
  }[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-300">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export function PresenceBar(props: {
  online: string[];
  me: string;
  status: ConnectionStatus;
}) {
  const { online, me, status } = props;
  const others = online.filter((u) => u !== me);
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-ink-700 bg-ink-900/80 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-lg bg-indigo-500 grid place-items-center font-bold text-sm">
          P
        </div>
        <div className="leading-tight">
          <div className="font-semibold">Pulse</div>
          <div className="text-xs text-ink-400">Public room</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {online.slice(0, 5).map((u) => (
            <div
              key={u}
              title={u === me ? `${u} (you)` : u}
              className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ring-2 ring-ink-900"
              style={{ background: colorForName(u) }}
            >
              {u.slice(0, 1).toUpperCase()}
            </div>
          ))}
          {online.length > 5 && (
            <div className="h-6 w-6 rounded-full bg-ink-700 grid place-items-center text-[10px] font-bold ring-2 ring-ink-900">
              +{online.length - 5}
            </div>
          )}
        </div>
        <div className="hidden sm:block text-xs text-ink-300">
          {online.length} online
          {others.length > 0 && (
            <span className="text-ink-500">
              {" "}
              · {others.slice(0, 3).join(", ")}
              {others.length > 3 ? "…" : ""}
            </span>
          )}
        </div>
        <StatusDot status={status} />
      </div>
    </header>
  );
}

export { colorForName };
