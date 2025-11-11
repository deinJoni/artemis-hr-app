import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import type { NavigateFunction } from "react-router";

import { supabase } from "~/lib/supabase";

type UseDashboardAuthResult = {
  session: Session | null;
  checking: boolean;
};

export function useDashboardAuth(navigate: NavigateFunction): UseDashboardAuthResult {
  const [session, setSession] = React.useState<Session | null>(null);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const currentSession = data.session ?? null;
      setSession(currentSession);
      setChecking(false);
      if (!currentSession) {
        navigate("/login", { replace: true, state: { from: "/" } });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      if (nextSession) {
        setSession(nextSession);
      } else {
        setSession(null);
        navigate("/login", { replace: true, state: { from: "/" } });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return { session, checking };
}
