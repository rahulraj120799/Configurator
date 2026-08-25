"use client";

import { useEffect, useState } from "react";
import {
  SESSION_USER_EVENT,
  readSessionUser,
  type SessionUser,
} from "@/lib/session-user";

type SessionUserState = {
  user: SessionUser | null;
  isLoading: boolean;
};

export function useSessionUser(): SessionUserState {
  const [state, setState] = useState<SessionUserState>({
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    const sync = () => setState({ user: readSessionUser(), isLoading: false });

    sync();
    window.addEventListener(SESSION_USER_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(SESSION_USER_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return state;
}
