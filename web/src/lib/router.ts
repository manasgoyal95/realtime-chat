import { useEffect, useState, useCallback } from "react";

// Minimal history-based router. Two routes in the whole app; a library is overkill.
export function usePath() {
  const [pathname, setPathname] = useState<string>(
    () => window.location.pathname || "/",
  );

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname || "/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) {
      window.history.replaceState({}, "", to);
    } else {
      window.history.pushState({}, "", to);
    }
    setPathname(window.location.pathname || "/");
  }, []);

  return { pathname, navigate };
}

export function roomCodeFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/r\/([a-z0-9][a-z0-9-]{2,39})\/?$/);
  return m ? m[1] : null;
}
