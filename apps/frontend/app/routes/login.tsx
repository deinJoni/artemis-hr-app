import * as React from "react";
import type { Route } from "./+types/login";
import { Link, useNavigate } from "react-router";
import { AuthApiError } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { GoogleIcon } from "~/components/icons/google-icon";

type MessageState =
  | { kind: "error"; text: string }
  | { kind: "success"; text: string }
  | null;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Login | Artemis" },
    {
      name: "description",
      content: "Sign in to Artemis using Supabase authentication.",
    },
  ];
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [resetLoading, setResetLoading] = React.useState(false);
  const [message, setMessage] = React.useState<MessageState>(null);

  React.useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (data.session) {
        navigate("/", { replace: true });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/", { replace: true });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!email || !password) {
      setMessage({ kind: "error", text: "Please provide both email and password." });
      return;
    }

    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMessage({ kind: "success", text: "Signed in. Redirecting to your dashboard..." });
      navigate("/", { replace: true });
    } catch (error: unknown) {
      if (error instanceof AuthApiError && error.status === 400) {
        navigate("/register", {
          replace: false,
          state: { email, fromLogin: true },
        });
        return;
      }

      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setMessage(null);
    setGoogleLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/`
          : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (error: any) {
      setMessage({
        kind: "error",
        text: error?.message ?? "We could not connect to Google. Try again shortly.",
      });
      setGoogleLoading(false);
    }
  }

  async function handlePasswordReset() {
    setMessage(null);

    if (!email) {
      setMessage({
        kind: "error",
        text: "Add the email you registered with so we can send a reset link.",
      });
      return;
    }

    setResetLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setMessage({
        kind: "success",
        text: "We just sent you instructions to reset your password.",
      });
    } catch (error: any) {
      setMessage({
        kind: "error",
        text: error?.message ?? "We could not send a reset email. Try again shortly.",
      });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-background via-background to-muted/40">
      <div className="container mx-auto flex min-h-[calc(100vh-64px)] flex-col justify-center px-4 py-12 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_minmax(0,420px)]">
          <section className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Welcome back
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Sign in to your Artemis workspace
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Jump back into your research, review your progress, and keep the momentum going. Supabase keeps every authentication flow secure.
            </p>
            <div className="hidden lg:flex lg:flex-col lg:gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">Choose your method</p>
                  <p className="text-muted-foreground text-sm">
                    Continue with your email and password or use Google to sign in instantly.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Stay in control</p>
                  <p className="text-muted-foreground text-sm">
                    Reset your password whenever you need and keep your account protected.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">Head to your dashboard</p>
                  <p className="text-muted-foreground text-sm">
                    Successful sign-ins take you straight to the dashboard so you can get back to work.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Card className="w-full border-border/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription>
                Use your Artemis credentials or sign in with Google to access your workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                <GoogleIcon className="mr-2 size-4" />
                {googleLoading ? "Connecting to Google..." : "Continue with Google"}
              </Button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden />
                Or continue with email
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>

              {message && (
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    message.kind === "error"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2 text-left">
                  <label className="text-sm font-medium text-foreground" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-sm font-medium text-foreground" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <Button type="submit" disabled={authLoading} className="w-full">
                  {authLoading ? "Please wait..." : "Sign in to Artemis"}
                </Button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  className="text-primary underline-offset-4 transition hover:underline disabled:pointer-events-none disabled:opacity-70"
                >
                  {resetLoading ? "Sending reset link..." : "Forgot your password?"}
                </button>
                <Link to="/register" className="text-muted-foreground transition hover:text-foreground">
                  Need an account? Register
                </Link>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between text-sm text-muted-foreground">
              <span>
                Prefer to explore first?{" "}
                <Link to="/" className="text-primary underline-offset-4 hover:underline">
                  Return home
                </Link>
              </span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}
