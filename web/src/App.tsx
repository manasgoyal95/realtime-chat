import { useCallback, useEffect } from "react";
import { Landing } from "./components/Landing";
import { ChatRoom } from "./ChatRoom";
import { usePath, roomCodeFromPath } from "./lib/router";
import { normalizeSlug } from "./lib/slug";

export default function App() {
  const { pathname, navigate } = usePath();
  const roomId = roomCodeFromPath(pathname);

  // If the URL starts with /r/ but the slug is malformed, try to normalize
  // it; if nothing salvageable, bounce back to landing.
  useEffect(() => {
    if (pathname.startsWith("/r/") && roomId === null) {
      const raw = pathname.slice(3).replace(/\/$/, "");
      const normalized = normalizeSlug(raw);
      if (normalized) {
        navigate(`/r/${normalized}`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [pathname, roomId, navigate]);

  const enterRoom = useCallback(
    (code: string) => {
      navigate(`/r/${code}`);
    },
    [navigate],
  );

  const leaveRoom = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (roomId) {
    return <ChatRoom roomId={roomId} onLeave={leaveRoom} />;
  }
  return <Landing onEnterRoom={enterRoom} />;
}
