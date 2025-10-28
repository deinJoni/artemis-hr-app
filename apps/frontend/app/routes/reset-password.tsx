import * as React from "react";
import type { Route } from "./+types/reset-password";
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
import { Link } from "react-router";

type MessageState =
  | { kind: "error"; text: string }
  | { kind: "success"; text: string }
  | null;

type ViewState = "checking" | "await_token" | "ready" | "success";

// eslint-disable-next-line react-refresh/only-export-components
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Reset Password | Artemis" },
    {
      name: "description",
      content: "Set a new password for your Artemis account.",
    },
  ];
}

export default function ResetPassword() {
  const [view, setView] = React.useState<ViewState>("checking");
  const [message, setMessage] = React.useState<MessageState>(null);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [updating, setUpdating] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function ensureSessionFromHash() {
      if (typeof window === "undefined") return;

      const searchParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = searchParams.get("access_token");
      const refreshToken = searchParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!isMounted) return;

        if (error) {
          setMessage({ kind: "error", text: error.message });
          setView("await_token");
          return;
        }

        if (data.session) {
          setView("ready");
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        } else {
          setView("await_token");
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;

        setView(data.session ? "ready" : "await_token");
      }
    }

    ensureSessionFromHash();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setView(session ? "ready" : "await_token");
      }

      if (event === "SIGNED_OUT") {
        setView((previous) => (previous === "success" ? "success" : "await_token"));
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!password || !confirmPassword) {
      setMessage({ kind: "error", text: "Enter your new password twice to continue." });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ kind: "error", text: "Passwords do not match. Try again." });
      return;
    }

    setUpdating(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setPassword("");
      setConfirmPassword("");
      setView("success");
      setMessage({
        kind: "success",
        text: "Password updated. Sign in with your new credentials.",
      });

      await supabase.auth.signOut();
    } catch (error: any) {
      setMessage({
        kind: "error",
        text: error?.message ?? "We could not update your password. Try again.",
      });
    } finally {
      setUpdating(false);
    }
  }

  function renderContent() {
    if (view === "checking") {
      return (
        <div className="space-y-4 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-r-transparent" />
          <p className="text-muted-foreground text-sm">Getting things ready...</p>
        </div>
      );
    }

    if (view === "await_token") {
      return (
        <div className="space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Check your inbox
          </div>
          <p className="text-lg font-medium text-foreground">Open the link we emailed to continue.</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We did not detect a recovery token. Please return to the login page and request a new
            password reset email, then open the link on the same device.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild variant="secondary">
              <Link to="/login">Back to login</Link>
            </Button>
            <Button asChild>
              <Link to="/">Go home</Link>
            </Button>
          </div>
        </div>
      );
    }

    if (view === "success") {
      return (
        <div className="space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Password updated
          </div>
          <p className="text-lg font-medium text-foreground">
            Your password is updated. Sign in again to continue.
          </p>
          <Button asChild className="w-full justify-center">
            <Link to="/login">Return to login</Link>
          </Button>
        </div>
      );
    }

    return (
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2 text-left">
          <label className="text-sm font-medium text-foreground" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Create a new password"
            required
          />
        </div>

        <div className="space-y-2 text-left">
          <label className="text-sm font-medium text-foreground" htmlFor="confirm-password">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Repeat your new password"
            required
          />
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

        <Button type="submit" className="w-full" disabled={updating}>
          {updating ? "Updating..." : "Save new password"}
        </Button>

        <p className="text-muted-foreground text-xs">
          Having trouble? Request a new password reset email from the{" "}
          <Link to="/login" className="text-primary underline-offset-2 hover:underline">
            login page
          </Link>
          .
        </p>
      </form>
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-background via-background to-muted/40">
      <div className="container mx-auto flex min-h-[calc(100vh-64px)] flex-col justify-center px-4 py-12 md:px-8">
        <div className="mx-auto max-w-xl">
          <Card className="border-border/60 backdrop-blur">
            <CardHeader className="space-y-3">
              <CardTitle className="text-3xl">Reset your password</CardTitle>
              <CardDescription>
                Use the secure form below to choose a new password for your Artemis account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {message && view !== "ready" && (
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
              {renderContent()}
            </CardContent>
            <CardFooter className="flex justify-between text-xs text-muted-foreground">
              <Link to="/" className="text-primary underline-offset-4 hover:underline">
                Return home
              </Link>
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Back to login
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}
