/* hooks/useAuth.ts */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { GetToken, SetToken } from "@/lib/api/session";
import type { User } from "@/lib/api/types";

export type SessionUser = User;

/* TELLS EVERY COMPONENT USING THIS HOOK THAT THE SESSION CHANGED */
const AUTH_EVENT = "auth-change";

export function NotifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
};

/* STORES THE TOKEN RETURNED BY LOGIN/REGISTER AND WAKES UP EVERY useAuth */
export function StartSession(token: string) {
  SetToken(token);
  NotifyAuthChange();
};

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    /* NO TOKEN MEANS NO SESSION, SO WE DON'T EVEN ASK THE SERVER */
    if (!GetToken()) {
      setUser(null);
      setLoading(false);
      return;
    };

    try {
      setUser(await api.auth.me());
    }

    catch {
      setUser(null);
    }

    finally {
      setLoading(false);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => { if (active) loadSession(); };

    load();
    window.addEventListener(AUTH_EVENT, load);

    return () => {
      active = false;
      window.removeEventListener(AUTH_EVENT, load);
    };
  }, [loadSession]);

  const logout = useCallback(() => {
    SetToken(null);
    setUser(null);
    NotifyAuthChange();

    router.push("/");
    router.refresh();
  }, [router]);

  return { user, loading, logout };
};
