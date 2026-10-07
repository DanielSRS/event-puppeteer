/* hooks/useAuth.ts */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type SessionUser = {
  id: string;
  name: string;
};

/* TELLS EVERY COMPONENT USING THIS HOOK THAT THE SESSION CHANGED */
const AUTH_EVENT = "auth-change";

export function NotifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/users/me", { credentials: "include", signal });
      const data = await response.json();

      setUser(response.ok ? data.user : null);
    }

    catch {
      if (!signal?.aborted)
        setUser(null);
    }

    finally {
      if (!signal?.aborted)
        setLoading(false);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSession(controller.signal);

    const onAuthChange = () => loadSession();
    window.addEventListener(AUTH_EVENT, onAuthChange);

    return () => {
      controller.abort();
      window.removeEventListener(AUTH_EVENT, onAuthChange);
    };
  }, [loadSession]);

  const logout = useCallback(async () => {
    await fetch("/api/users/logout", { method: "POST", credentials: "include" });

    setUser(null);
    NotifyAuthChange();

    router.push("/");
    router.refresh();
  }, [router]);

  return { user, loading, logout };
};
