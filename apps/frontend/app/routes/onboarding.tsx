import * as React from "react";
import type { Route } from "./+types/onboarding";
import { Link, useLocation, useNavigate } from "react-router";
import type { Session } from "@supabase/supabase-js";
import {
  AccountBootstrapResponseSchema,
  type AccountBootstrapResponse,
  type OnboardingStepPayload,
  OnboardingStepPayloadSchema,
  OnboardingStepResponseSchema,
} from "@vibe/shared";
import { supabase } from "~/lib/supabase";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type OnboardingState = {
  email?: string;
  fromSignup?: boolean;
} | null;

const TOTAL_STEPS = 3;
const BOOTSTRAP_CACHE_KEY = "artemis-bootstrap-cache";

const debugOnboarding = (label: string, details?: Record<string, unknown>) => {
  const debugFlag =
    typeof window !== "undefined" &&
    Boolean(
      (window as typeof window & { __ARTEMIS_DEBUG_ONBOARDING__?: boolean })
        .__ARTEMIS_DEBUG_ONBOARDING__
    );
  if (import.meta.env.DEV && debugFlag) {
    if (details) {
      console.debug(`[onboarding] ${label}`, details);
    } else {
      console.debug(`[onboarding] ${label}`);
    }
  }
};
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Onboarding | Artemis" },
    {
      name: "description",
      content: "Guide your Artemis workspace through its initial setup.",
    },
  ];
}

export async function loader() {
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";

  return { baseUrl };
}

export default function Onboarding({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const navigate = useNavigate();
  const location = useLocation();
  const onboardingState = (location.state as OnboardingState) ?? null;
  const params = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const method = params.get("method");

  const [session, setSession] = React.useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = React.useState(true);

  const [bootstrapStatus, setBootstrapStatus] = React.useState<
    "idle" | "working" | "done" | "error"
  >("idle");
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);
  const [bootstrappedTenant, setBootstrappedTenant] =
    React.useState<AccountBootstrapResponse["tenant"] | null>(null);
  const [bootstrappedProfile, setBootstrappedProfile] =
    React.useState<AccountBootstrapResponse["profile"] | null>(null);
  const [bootstrapCreated, setBootstrapCreated] = React.useState(false);
  const [bootstrapAttempt, setBootstrapAttempt] = React.useState(0);
  const bootstrapStatusRef = React.useRef(bootstrapStatus);

  const [stepSubmitting, setStepSubmitting] = React.useState(false);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const [direction, setDirection] = React.useState<"forward" | "backward">("forward");

  const awaitingVerification =
    !session && (!!onboardingState?.fromSignup || method !== null);

  const email =
    session?.user?.email ??
    onboardingState?.email ??
    session?.user?.identities?.[0]?.identity_data?.email ??
    "";

  const derivedStep = React.useMemo(() => {
    if (!bootstrappedTenant || bootstrappedTenant.setup_completed) {
      return TOTAL_STEPS;
    }
    const stepFromTenant = bootstrappedTenant.onboarding_step ?? 0;
    return Math.min(Math.max(stepFromTenant + 1, 1), TOTAL_STEPS);
  }, [bootstrappedTenant]);

  const [currentStep, setCurrentStep] = React.useState(derivedStep);

  React.useEffect(() => {
    setCurrentStep(derivedStep);
  }, [derivedStep]);

  const [formData, setFormData] = React.useState({
    companyName: "",
    companyLocation: "",
    companySize: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    needsSummary: "",
    keyPriorities: "",
  });

  const bootstrapInitiatedRef = React.useRef(false);
  const hasCachedBootstrap = React.useRef(false);
  const noop = React.useCallback(() => {}, []);

  React.useEffect(() => {
    bootstrapStatusRef.current = bootstrapStatus;
  }, [bootstrapStatus]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.sessionStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!cached) return;
    try {
      const parsed = AccountBootstrapResponseSchema.safeParse(JSON.parse(cached));
      if (!parsed.success) {
        window.sessionStorage.removeItem(BOOTSTRAP_CACHE_KEY);
        return;
      }
      hasCachedBootstrap.current = true;
      setBootstrappedTenant(parsed.data.tenant);
      setBootstrappedProfile(parsed.data.profile);
      setBootstrapCreated(parsed.data.created);
      setBootstrapStatus("done");
    } catch {
      window.sessionStorage.removeItem(BOOTSTRAP_CACHE_KEY);
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session ?? null);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!session) {
      setBootstrapStatus("idle");
      bootstrapStatusRef.current = "idle";
      setBootstrapError(null);
      setBootstrappedTenant(null);
      setBootstrappedProfile(null);
      setBootstrapCreated(false);
      bootstrapInitiatedRef.current = false;
      setBootstrapAttempt(0);
      hasCachedBootstrap.current = false;
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(BOOTSTRAP_CACHE_KEY);
      }
    }
  }, [session]);

  React.useEffect(() => {
    if (!bootstrappedTenant) return;

    setFormData((data) => ({
      ...data,
      companyName: bootstrappedTenant.company_name ?? data.companyName,
      companyLocation: bootstrappedTenant.company_location ?? data.companyLocation,
      companySize: bootstrappedTenant.company_size ?? data.companySize,
      contactName: bootstrappedTenant.contact_name ?? data.contactName,
      contactEmail: bootstrappedTenant.contact_email ?? data.contactEmail,
      contactPhone: bootstrappedTenant.contact_phone ?? data.contactPhone,
      needsSummary: bootstrappedTenant.needs_summary ?? data.needsSummary,
      keyPriorities: bootstrappedTenant.key_priorities ?? data.keyPriorities,
    }));
  }, [bootstrappedTenant]);

  const startBootstrap = React.useCallback(() => {
    if (!session) return noop;
    if (bootstrapInitiatedRef.current) return noop;
    if (bootstrapStatusRef.current === "working") return noop;

    const token = session.access_token;
    if (!token) {
      setBootstrapError("Missing access token.");
      return noop;
    }

    bootstrapInitiatedRef.current = true;
    let ignore = false;

    setBootstrapStatus("working");
    bootstrapStatusRef.current = "working";
    setBootstrapError(null);

    debugOnboarding("bootstrap:start");

    void (async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/account/bootstrap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });
        debugOnboarding("bootstrap:response", {
          status: response.status,
          ok: response.ok,
        });

        const payload = await response.json().catch(() => ({} as Record<string, unknown>));
        debugOnboarding("bootstrap:payload", {
          hasTenant: Boolean((payload as AccountBootstrapResponse | undefined)?.tenant),
          hasProfile: Boolean((payload as AccountBootstrapResponse | undefined)?.profile),
        });

        if (!response.ok) {
          const message =
            (typeof payload.error === "string" && payload.error) ||
            response.statusText ||
            "Failed to prepare your workspace.";
          throw new Error(message);
        }

        const parsed = AccountBootstrapResponseSchema.safeParse(payload);
        debugOnboarding("bootstrap:parse", { success: parsed.success });

        if (!parsed.success) {
          throw new Error("Received an unexpected response from the server.");
        }

        if (ignore) {
          debugOnboarding("bootstrap:cancelled");
          return;
        }

        setBootstrappedTenant(parsed.data.tenant);
        setBootstrappedProfile(parsed.data.profile);
        setBootstrapCreated(parsed.data.created);
        setBootstrapStatus("done");
        bootstrapStatusRef.current = "done";
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify(parsed.data));
          hasCachedBootstrap.current = true;
        }
        debugOnboarding("bootstrap:complete", {
          tenantId: parsed.data.tenant.id,
          setupCompleted: parsed.data.tenant.setup_completed,
        });
      } catch (error: unknown) {
        if (ignore) return;
        console.error("[Bootstrap] Error:", error);
        setBootstrapError(
          error instanceof Error ? error.message : "We could not prepare your workspace."
        );
        setBootstrapStatus("error");
        bootstrapStatusRef.current = "error";
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(BOOTSTRAP_CACHE_KEY);
        }
      } finally {
        if (!ignore) {
          bootstrapInitiatedRef.current = false;
        }
      }
    })();

    return () => {
      if (bootstrapStatusRef.current === "working") {
        setBootstrapStatus("idle");
        bootstrapStatusRef.current = "idle";
      }
      ignore = true;
      bootstrapInitiatedRef.current = false;
    };
  }, [apiBaseUrl, session, noop]);

  React.useEffect(() => {
    if (!session) return;
    return startBootstrap();
  }, [session, startBootstrap, bootstrapAttempt]);

  const retryBootstrap = React.useCallback(() => {
    if (!session) return;
    setBootstrapError(null);
    setBootstrapStatus("idle");
    bootstrapStatusRef.current = "idle";
    setBootstrapAttempt((attempt) => attempt + 1);
  }, [session]);

  React.useEffect(() => {
    if (bootstrappedTenant?.setup_completed) {
      navigate("/", { replace: true });
    }
  }, [bootstrappedTenant?.setup_completed, navigate]);

  const onboardingMessage = React.useMemo(() => {
    if (awaitingVerification) {
      return "Check your inbox for a confirmation link. We will unlock onboarding as soon as you verify your email.";
    }
    if (!session) {
      return "Sign in to continue your onboarding.";
    }
    if (!bootstrappedTenant && bootstrapStatus === "working") {
      return "We are preparing your workspace. This will only take a moment.";
    }
    if (bootstrapStatus === "error") {
      return bootstrapError ?? "We could not prepare your workspace. Please try again.";
    }
    if (bootstrappedTenant) {
      return `Your workspace "${bootstrappedTenant.name}" is ready for setup.`;
    }
    return "A guided onboarding experience will appear here soon. Stay tuned!";
  }, [awaitingVerification, session, bootstrapStatus, bootstrapError, bootstrappedTenant]);

  async function submitStep(payload: OnboardingStepPayload) {
    if (!session) return;
    setStepSubmitting(true);
    setStepError(null);
    try {
      const token = session.access_token;
      const response = await fetch(`${apiBaseUrl}/api/onboarding/step`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const payloadJson = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        const message =
          (typeof payloadJson.error === "string" && payloadJson.error) ||
          response.statusText ||
          "We could not save your progress.";
        throw new Error(message);
      }
      const parsed = OnboardingStepResponseSchema.safeParse(payloadJson);
      if (!parsed.success) {
        throw new Error("Unexpected response from the server.");
      }

      setBootstrappedTenant(parsed.data.tenant);
      if (typeof window !== "undefined" && bootstrappedProfile) {
        window.sessionStorage.setItem(
          BOOTSTRAP_CACHE_KEY,
          JSON.stringify({
            tenant: parsed.data.tenant,
            profile: bootstrappedProfile,
            created: bootstrapCreated,
          })
        );
      }

      if (payload.step < TOTAL_STEPS) {
        setDirection("forward");
        setCurrentStep(payload.step + 1);
      }
    } catch (error: unknown) {
      setStepError(
        error instanceof Error ? error.message : "We could not save your progress."
      );
    } finally {
      setStepSubmitting(false);
    }
  }

  function handleBack() {
    if (currentStep <= 1) return;
    setStepError(null);
    setDirection("backward");
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  const progress = React.useMemo(() => {
    return Math.round(((currentStep - 1) / (TOTAL_STEPS - 1)) * 100) || 100;
  }, [currentStep]);

  const StepShell = React.useCallback(
    ({ children }: { children: React.ReactNode }) => (
      <div
        key={currentStep}
        className={cn(
          "step-panel rounded-xl border border-border/60 bg-card p-6 shadow-sm backdrop-blur",
          direction === "backward" ? "step-panel-back" : "step-panel-forward"
        )}
      >
        {children}
      </div>
    ),
    [currentStep, direction]
  );

  function renderStepContent() {
    switch (currentStep) {
      case 1:
        return (
          <StepShell>
            <div className="space-y-6">
              <header className="space-y-2 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Step 1 · Company basics
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Tell us a little about your company
                </h2>
                <p className="text-sm text-muted-foreground">
                  This helps us personalize Artemis for your organization size and footprint.
                </p>
              </header>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = {
                    companyName: formData.companyName.trim(),
                    companyLocation: formData.companyLocation.trim(),
                    companySize: formData.companySize.trim(),
                  };
                  const parse = OnboardingStepPayloadSchema.safeParse({
                    step: 1,
                    ...trimmed,
                  });
                  if (!parse.success) {
                  const errors = parse.error.flatten().fieldErrors as Record<string, string[]>;
                    if (errors.companyName) {
                      setStepError("Please enter a company name.");
                    } else if (errors.companyLocation) {
                      setStepError("Please enter a company location.");
                    } else if (errors.companySize) {
                      setStepError("Please enter a company size.");
                    } else {
                      setStepError("Please complete all required fields.");
                    }
                    return;
                  }
                  void submitStep(parse.data);
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-left">
                    <span className="text-sm font-medium text-foreground">Company name</span>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(event) =>
                        setFormData((data) => ({ ...data, companyName: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="Acme Labs"
                      required
                    />
                  </label>
                  <label className="space-y-2 text-left">
                    <span className="text-sm font-medium text-foreground">Company size</span>
                    <input
                      type="text"
                      value={formData.companySize}
                      onChange={(event) =>
                        setFormData((data) => ({ ...data, companySize: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="10-50 teammates"
                      required
                    />
                  </label>
                </div>
                <label className="space-y-2 text-left">
                  <span className="text-sm font-medium text-foreground">Where are you based?</span>
                  <input
                    type="text"
                    value={formData.companyLocation}
                    onChange={(event) =>
                      setFormData((data) => ({ ...data, companyLocation: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="San Francisco, CA"
                    required
                  />
                </label>

                {stepError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {stepError}
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3">
                  <Button type="button" variant="outline" onClick={() => navigate("/login")}>
                    Cancel setup
                  </Button>
                  <Button type="submit" disabled={stepSubmitting}>
                    {stepSubmitting ? "Saving..." : "Continue to step 2"}
                  </Button>
                </div>
              </form>
            </div>
          </StepShell>
        );
      case 2:
        return (
          <StepShell>
            <div className="space-y-6">
              <header className="space-y-2 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Step 2 · Contact details
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Who should we reach out to?
                </h2>
                <p className="text-sm text-muted-foreground">
                  We will use this information for onboarding support and account notices.
                </p>
              </header>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = {
                    contactName: formData.contactName.trim(),
                    contactEmail: formData.contactEmail.trim(),
                    contactPhone: formData.contactPhone.trim(),
                  };
                  const parse = OnboardingStepPayloadSchema.safeParse({
                    step: 2,
                    ...trimmed,
                  });
                  if (!parse.success) {
                    const errors = parse.error.flatten().fieldErrors as Record<string, string[]>;
                    if (errors.contactName) {
                      setStepError("Please enter a valid contact name.");
                    } else if (errors.contactEmail) {
                      setStepError("Please enter a valid email address.");
                    } else if (errors.contactPhone) {
                      setStepError("Please enter a valid phone number (at least 3 characters).");
                    } else {
                      setStepError("Please complete all required fields.");
                    }
                    return;
                  }
                  void submitStep(parse.data);
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-left">
                    <span className="text-sm font-medium text-foreground">Primary contact</span>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(event) =>
                        setFormData((data) => ({ ...data, contactName: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="Ada Lovelace"
                      required
                    />
                  </label>
                  <label className="space-y-2 text-left">
                    <span className="text-sm font-medium text-foreground">Contact email</span>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(event) =>
                        setFormData((data) => ({ ...data, contactEmail: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="ada@acmelabs.com"
                      required
                    />
                  </label>
                </div>
                <label className="space-y-2 text-left">
                  <span className="text-sm font-medium text-foreground">Contact phone</span>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(event) =>
                      setFormData((data) => ({ ...data, contactPhone: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="+1 (415) 555-0199"
                    required
                  />
                </label>

                {stepError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {stepError}
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3">
                  <Button type="button" variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                  <Button type="submit" disabled={stepSubmitting}>
                    {stepSubmitting ? "Saving..." : "Continue to step 3"}
                  </Button>
                </div>
              </form>
            </div>
          </StepShell>
        );
      default:
        return (
          <StepShell>
            <div className="space-y-6">
              <header className="space-y-2 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Step 3 · Your goals
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Align Artemis with your priorities
                </h2>
                <p className="text-sm text-muted-foreground">
                  Share the needs and initiatives you have in mind. We will tailor upcoming
                  features and recommendations to match.
                </p>
              </header>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = {
                    needsSummary: formData.needsSummary.trim(),
                    keyPriorities: formData.keyPriorities.trim(),
                  };
                  const parse = OnboardingStepPayloadSchema.safeParse({
                    step: 3,
                    ...trimmed,
                  });
                  if (!parse.success) {
                    const errors = parse.error.flatten().fieldErrors as Record<string, string[]>;
                    if (errors.needsSummary) {
                      setStepError("Please describe what you need most (at least 3 characters).");
                    } else if (errors.keyPriorities) {
                      setStepError("Please describe your key priorities (at least 3 characters).");
                    } else {
                      setStepError("Please complete all required fields.");
                    }
                    return;
                  }
                  void submitStep(parse.data);
                }}
              >
                <label className="space-y-2 text-left">
                  <span className="text-sm font-medium text-foreground">What do you need most right now?</span>
                  <textarea
                    value={formData.needsSummary}
                    onChange={(event) =>
                      setFormData((data) => ({ ...data, needsSummary: event.target.value }))
                    }
                    className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="We're looking to centralize research insights..."
                    required
                  />
                </label>

                <label className="space-y-2 text-left">
                  <span className="text-sm font-medium text-foreground">Key priorities for the next quarter</span>
                  <textarea
                    value={formData.keyPriorities}
                    onChange={(event) =>
                      setFormData((data) => ({ ...data, keyPriorities: event.target.value }))
                    }
                    className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Launch our new lab program, onboard data scientists..."
                    required
                  />
                </label>

                {stepError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {stepError}
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3">
                  <Button type="button" variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                  <Button type="submit" disabled={stepSubmitting}>
                    {stepSubmitting ? "Finishing..." : "Complete onboarding"}
                  </Button>
                </div>
              </form>
            </div>
          </StepShell>
        );
    }
  }

  const stepStatusMessage = React.useMemo(() => {
    if (bootstrappedTenant) {
      if (bootstrappedTenant.setup_completed) {
        return "Onboarding complete";
      }
      return `Step ${currentStep} of ${TOTAL_STEPS}`;
    }
    if (session && bootstrapStatus === "working") {
      return "Preparing workspace...";
    }
    if (bootstrapStatus === "error" && bootstrapError) {
      return bootstrapError;
    }
    return null;
  }, [bootstrappedTenant, currentStep, session, bootstrapStatus, bootstrapError]);

  const awaitingBootstrap = session && bootstrapStatus === "working" && !bootstrappedTenant;

  React.useEffect(() => {
    debugOnboarding("render:status", {
      session: !!session,
      bootstrapStatus,
      bootstrappedTenant: !!bootstrappedTenant,
      setupCompleted: bootstrappedTenant?.setup_completed,
      shouldShowForm: session && bootstrappedTenant && !bootstrappedTenant.setup_completed,
    });
  }, [session, bootstrapStatus, bootstrappedTenant]);

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-background via-background to-muted/40">
      <div className="container mx-auto flex min-h-[calc(100vh-64px)] flex-col justify-center px-4 py-12 md:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 text-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Onboarding
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              We are preparing your Artemis workspace
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">{onboardingMessage}</p>
            {email && (
              <p className="text-sm text-muted-foreground">
                {awaitingVerification
                  ? `We sent a message to ${email}. Once confirmed, refresh this page to continue.`
                  : `Signed in as ${email}.`}
              </p>
            )}
            {(checkingSession || awaitingBootstrap) && (
              <div className="mx-auto flex h-10 w-10 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent" />
              </div>
            )}
            {bootstrapStatus === "error" && (
              <div className="mx-auto max-w-md rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {bootstrapError ?? "We could not prepare your workspace."}
                <div className="mt-3 flex justify-center">
                  <Button variant="outline" onClick={retryBootstrap}>
                    Try again
                  </Button>
                </div>
              </div>
            )}
            {bootstrappedTenant && (
              <div className="mx-auto flex w-full max-w-md flex-col gap-3">
                <div className="h-1 w-full overflow-hidden rounded-full bg-border/60">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {stepStatusMessage && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {stepStatusMessage}
                  </p>
                )}
                <div className="flex items-center justify-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {[1, 2, 3].map((step) => (
                    <React.Fragment key={step}>
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full border text-sm",
                          currentStep === step
                            ? "border-primary bg-primary/10 text-primary"
                            : bootstrappedTenant.onboarding_step >= step
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30 text-muted-foreground"
                        )}
                      >
                        {step}
                      </span>
                      {step < TOTAL_STEPS && <span className="h-px flex-1 bg-border/70" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

          {session && bootstrappedTenant && !bootstrappedTenant.setup_completed ? (
            <div className="space-y-6">
              {renderStepContent()}
              <div className="w-full rounded-xl border border-border/60 bg-card p-6 text-left shadow-sm backdrop-blur">
                <h2 className="text-lg font-semibold">Workspace summary</h2>
                <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                  <p>
                    Workspace:{" "}
                    <span className="text-foreground">{bootstrappedTenant.name}</span>
                  </p>
                  <p>
                    Member:{" "}
                    <span className="text-foreground">
                      {bootstrappedProfile?.display_name ?? "Owner"}
                    </span>
                  </p>
                  <p>
                    Company size:{" "}
                    <span className="text-foreground">
                      {bootstrappedTenant.company_size ?? "–"}
                    </span>
                  </p>
                  <p>
                    Location:{" "}
                    <span className="text-foreground">
                      {bootstrappedTenant.company_location ?? "–"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="default">
                <Link to={session ? "/" : "/login"}>
                  {session ? "Continue to dashboard" : "Return to login"}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Back to home</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
