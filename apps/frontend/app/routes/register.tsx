import * as React from "react";
import type { Route } from "./+types/register";
import { Link, useLocation, useNavigate } from "react-router";
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

// eslint-disable-next-line react-refresh/only-export-components
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Register | Artemis" },
    {
      name: "description",
      content: "Create an Artemis account using Supabase authentication.",
    },
  ];
}

type RegisterState = {
  email?: string;
  fromLogin?: boolean;
} | null;

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const registerState = (location.state as RegisterState) ?? null;

  const [email, setEmail] = React.useState(registerState?.email ?? "");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
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

  React.useEffect(() => {
    if (registerState?.fromLogin) {
      setMessage({
        kind: "error",
        text: "We could not find an account with that email. Create one below to continue.",
      });
    }
  }, [registerState?.fromLogin]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!email || !password || !confirmPassword) {
      setMessage({ kind: "error", text: "Please complete all fields to continue." });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ kind: "error", text: "Passwords do not match. Try again." });
      return;
    }

    setAuthLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/onboarding`
          : undefined;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;
      navigate("/onboarding", { replace: true, state: { email, fromSignup: true } });
    } catch (error: any) {
      setMessage({
        kind: "error",
        text: error?.message ?? "We could not create your account. Try again shortly.",
      });
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setMessage(null);
    setGoogleLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/onboarding?method=google`
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

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-background via-background to-muted/40">
      <div className="container mx-auto flex min-h-[calc(100vh-64px)] flex-col justify-center px-4 py-12 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_minmax(0,420px)]">
          <section className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Create your account
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Welcome to Artemis
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Join researchers and builders shaping new explorations. Use your email or Google
              account to get started in minutes.
            </p>
            <div className="hidden lg:flex lg:flex-col lg:gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">Set your credentials</p>
                  <p className="text-muted-foreground text-sm">
                    Create a secure password or choose Google for a one-click experience.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Confirm your email</p>
                  <p className="text-muted-foreground text-sm">
                    Supabase will send a confirmation link to verify your address.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">Start onboarding</p>
                  <p className="text-muted-foreground text-sm">
                    We will guide you through the initial setup to personalize your workspace.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Card className="w-full border-border/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">Create your Artemis account</CardTitle>
              <CardDescription>
                Sign up with email and password or connect your Google account. We will take you straight to onboarding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignUp}
                disabled={googleLoading}
              >
                <GoogleIcon className="mr-2 size-4" />
                {googleLoading ? "Connecting to Google..." : "Continue with Google"}
              </Button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden />
                Or sign up with email
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
                  <label className="text-sm font-medium text-foreground" htmlFor="register-email">
                    Email
                  </label>
                  <input
                    id="register-email"
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
                  <label className="text-sm font-medium text-foreground" htmlFor="register-password">
                    Password
                  </label>
                  <input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Create a strong password"
                    required
                  />
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-sm font-medium text-foreground" htmlFor="register-confirm-password">
                    Confirm password
                  </label>
                  <input
                    id="register-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Repeat your password"
                    required
                  />
                </div>

                <Button type="submit" disabled={authLoading} className="w-full">
                  {authLoading ? "Creating account..." : "Create account"}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                Already part of Artemis?{" "}
                <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                  Sign in instead
                </Link>
              </span>
              <Link to="/" className="text-primary underline-offset-4 hover:underline">
                Return home
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}
