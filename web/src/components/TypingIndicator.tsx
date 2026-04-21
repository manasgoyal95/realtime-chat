export function TypingIndicator(props: { users: string[] }) {
  const { users } = props;
  if (users.length === 0) {
    return <div className="h-5" />; // reserve space to avoid layout jump
  }
  const label =
    users.length === 1
      ? `${users[0]} is typing`
      : users.length === 2
        ? `${users[0]} and ${users[1]} are typing`
        : `${users.length} people are typing`;
  return (
    <div className="h-5 px-4 flex items-center gap-2 text-xs text-ink-400">
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-400 animate-pulse-dot [animation-delay:-0.32s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-ink-400 animate-pulse-dot [animation-delay:-0.16s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-ink-400 animate-pulse-dot" />
      </span>
      <span>{label}…</span>
    </div>
  );
}
