import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase";
import { Button } from "~/components/ui/button";

export function AuthStatus() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session?.user) {
    const email = session.user.email ?? session.user.identities?.[0]?.identity_data?.email ?? "Signed in";
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{email}</span>
        <Button
          variant="secondary"
          onClick={async () => {
            await supabase.auth.signOut();
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) throw error;
        setMessage("Check your email for a verification link.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("Signed in.");
      }
    } catch (err: any) {
      setError(err?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-72">
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          className={`px-2 py-1 rounded ${mode === "signin" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`px-2 py-1 rounded ${mode === "signup" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          onClick={() => setMode("signup")}
        >
          Register
        </button>
      </div>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        autoComplete="email"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
      />

      {error && <div className="text-sm text-red-600">{error}</div>}
      {message && <div className="text-sm text-green-600">{message}</div>}

      <Button type="submit" disabled={loading}>
        {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}