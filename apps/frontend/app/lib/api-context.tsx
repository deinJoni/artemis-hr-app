import * as React from "react";
import type { Session } from "@supabase/supabase-js";

type ApiContextValue = {
  session: Session | null;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  apiBaseUrl: string;
};

const ApiContext = React.createContext<ApiContextValue | null>(null);

export function ApiProvider({
  value,
  children,
}: {
  value: ApiContextValue;
  children: React.ReactNode;
}) {
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApiContext() {
  const context = React.useContext(ApiContext);
  if (!context) {
    throw new Error("useApiContext must be used within an ApiProvider");
  }
  
  // Runtime validation for API base URL
  if (!context.apiBaseUrl || context.apiBaseUrl.trim() === "") {
    const error = new Error(
      "API base URL is not configured. Please set VITE_BACKEND_URL environment variable."
    );
    console.error("[ApiContext] Missing API base URL:", error);
    // In development, throw to catch configuration issues early
    if (import.meta.env.DEV) {
      throw error;
    }
    // In production, log warning but allow app to continue (may have fallback)
    console.warn("[ApiContext] API base URL is missing. API calls may fail.");
  } else if (!context.apiBaseUrl.startsWith("http://") && !context.apiBaseUrl.startsWith("https://")) {
    console.warn(
      `[ApiContext] API base URL may be invalid: "${context.apiBaseUrl}". Expected URL starting with http:// or https://`
    );
  }
  
  return context;
}

export type { ApiContextValue };
