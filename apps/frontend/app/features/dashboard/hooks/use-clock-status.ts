import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import type { NavigateFunction } from "react-router";

import { supabase } from "~/lib/supabase";

type UseClockStatusArgs = {
  apiBaseUrl: string;
  navigate: NavigateFunction;
  session: Session | null;
};

export function useClockStatus({ apiBaseUrl, navigate, session }: UseClockStatusArgs) {
  const [isClockedIn, setIsClockedIn] = React.useState(false);

  React.useEffect(() => {
    if (!session) return;
    const activeSession = session;
    let cancelled = false;

    async function checkClockStatus() {
      try {
        const res = await fetch(`${apiBaseUrl}/api/time/summary`, {
          headers: { Authorization: `Bearer ${activeSession.access_token}` },
        });
        if (cancelled) return;
        if (res.status === 401) {
          await supabase.auth.signOut();
          navigate("/login", { replace: true, state: { from: "/" } });
          return;
        }
        const data = await res.json().catch(() => ({}));
        setIsClockedIn(Boolean(data?.activeEntry));
      } catch {
        // ignore errors for heartbeat
      }
    }

    void checkClockStatus();
    const interval = setInterval(checkClockStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session, apiBaseUrl, navigate]);

  return { isClockedIn, setIsClockedIn } as const;
}
