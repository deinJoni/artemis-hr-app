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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { useTranslation } from "~/lib/i18n";

type OnboardingState = {
  email?: string;
  fromSignup?: boolean;
} | null;

const TOTAL_STEPS = 3;
const BOOTSTRAP_CACHE_KEY = "artemis-bootstrap-cache";
const ONBOARDING_COMPANY_SIZE_PLACEHOLDER_VALUE = "__onboarding_company_size__";
const ONBOARDING_LANGUAGE_PLACEHOLDER_VALUE = "__onboarding_language__";

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
  const { t } = useTranslation();
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
    companySize: "",
    language: "",
    firstName: "",
    lastName: "",
    companyEmail: "",
    rolePosition: "",
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
      companySize: bootstrappedTenant.company_size ?? data.companySize,
      language: bootstrappedTenant.language ?? data.language,
      // Keep existing form data for step 2 fields (not stored in tenant)
      firstName: data.firstName,
      lastName: data.lastName,
      companyEmail: data.companyEmail,
      rolePosition: data.rolePosition,
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
                  {t("onboarding.step1")}
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {t("onboarding.companySetup")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("onboarding.companySetupDescription")}
                </p>
              </header>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = {
                    companyName: formData.companyName.trim(),
                    companySize: formData.companySize as "1-10" | "11-25" | "26-100" | "101-500" | "501-1000" | "> 1000",
                    language: formData.language as "German" | "English",
                  };
                  const parse = OnboardingStepPayloadSchema.safeParse({
                    step: 1,
                    ...trimmed,
                  });
                  if (!parse.success) {
                    const errors = parse.error.flatten().fieldErrors as Record<string, string[]>;
                    if (errors.companyName) {
                      setStepError("Please enter a company name.");
                    } else if (errors.companySize) {
                      setStepError("Please select a company size.");
                    } else if (errors.language) {
                      setStepError("Please select a language.");
                    } else {
                      setStepError("Please complete all required fields.");
                    }
                    return;
                  }
                  void submitStep(parse.data);
                }}
              >
                <label className="space-y-2 text-left">
                  <span className="text-sm font-medium text-foreground">{t("onboarding.companyName")}</span>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(event) =>
                      setFormData((data) => ({ ...data, companyName: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder={t("onboarding.companyNamePlaceholder")}
                    required
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-left">
                    <span className="text-sm font-medium text-foreground">{t("settings.companySize")}</span>
                    <Select
                      value={formData.companySize || ONBOARDING_COMPANY_SIZE_PLACEHOLDER_VALUE}
                      onValueChange={(value) =>
                        setFormData((data) => ({ ...data, companySize: value === ONBOARDING_COMPANY_SIZE_PLACEHOLDER_VALUE ? "" : value }))
                      }
                    >
                      <SelectTrigger className="h-11 w-full rounded-lg">
                        <SelectValue placeholder={t("onboarding.selectSize")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ONBOARDING_COMPANY_SIZE_PLACEHOLDER_VALUE}>
                          {t("onboarding.selectSize")}
                        </SelectItem>
                        <SelectItem value="1-10">1-10</SelectItem>
                        <SelectItem value="11-25">11-25</SelectItem>
                        <SelectItem value="26-100">26-100</SelectItem>
                        <SelectItem value="101-500">101-500</SelectItem>
                        <SelectItem value="501-1000">501-1000</SelectItem>
                        <SelectItem value="> 1000">&gt; 1000</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-2 text-left">
                    <span className="text-sm font-medium text-foreground">{t("settings.language")}</span>
                    <Select
                      value={formData.language || ONBOARDING_LANGUAGE_PLACEHOLDER_VALUE}
                      onValueChange={(value) =>
                        setFormData((data) => ({ ...data, language: value === ONBOARDING_LANGUAGE_PLACEHOLDER_VALUE ? "" : value }))
                      }
                    >
                      <SelectTrigger className="h-11 w-full rounded-lg">
                        <SelectValue placeholder={t("onboarding.selectLanguage")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ONBOARDING_LANGUAGE_PLACEHOLDER_VALUE}>
                          {t("onboarding.selectLanguage")}
                        </SelectItem>
                        <SelectItem value="German">{t("onboarding.german")}</SelectItem>
                        <SelectItem value="English">{t("onboarding.english")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                {stepError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {stepError}
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3">
                  <Button type="button" variant="outline" onClick={() => navigate("/login")}>
                    {t("onboarding.cancelSetup")}
                  </Button>
                  <Button type="submit" disabled={stepSubmitting}>
                    {stepSubmitting ? t("onboarding.saving") : t("onboarding.continueToStep2")}
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
                  {t("onboarding.step2")}
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {t("onboarding.addFirstEmployee")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("onboarding.addFirstEmployeeDescription")}
                </p>
              </header>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = {
                    firstName: formData.firstName.trim(),
                    lastName: formData.lastName.trim(),
                    companyEmail: formData.companyEmail.trim(),
                    rolePosition: formData.rolePosition.trim(),
                  };
                  const parse = OnboardingStepPayloadSchema.safeParse({
                    step: 2,
                    ...trimmed,
                  });
                  if (!parse.success) {
                    const errors = parse.error.flatten().fieldErrors as Record<string, string[]>;
                    if (errors.firstName) {
                      setStepError("Please enter a first name.");
                    } else if (errors.lastName) {
                      setStepError("Please enter a last name.");
                    } else if (errors.companyEmail) {
                      setStepError("Please enter a valid email address.");
                    } else if (errors.rolePosition) {
                      setStepError("Please enter a role or position.");
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
                    <span className="text-sm font-medium text-foreground">First name</span>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(event) =>
                        setFormData((data) => ({ ...data, firstName: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder={t("onboarding.firstNamePlaceholder")}
                      required
                    />
                  </label>
                  <label className="space-y-2 text-left">
                    <span className="text-sm font-medium text-foreground">Last name</span>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(event) =>
                        setFormData((data) => ({ ...data, lastName: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder={t("onboarding.lastNamePlaceholder")}
                      required
                    />
                  </label>
                </div>
                <label className="space-y-2 text-left">
                  <span className="text-sm font-medium text-foreground">Company email</span>
                  <input
                    type="email"
                    value={formData.companyEmail}
                    onChange={(event) =>
                      setFormData((data) => ({ ...data, companyEmail: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder={t("onboarding.companyEmailPlaceholder")}
                    required
                  />
                </label>
                <label className="space-y-2 text-left">
                  <span className="text-sm font-medium text-foreground">Role + Position</span>
                  <input
                    type="text"
                    value={formData.rolePosition}
                    onChange={(event) =>
                      setFormData((data) => ({ ...data, rolePosition: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder={t("onboarding.rolePositionPlaceholder")}
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
              <header className="space-y-2 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Step 3 · Welcome
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Welcome to Artemis!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Your workspace is ready. You can now start managing your team and organization.
                </p>
              </header>

              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Setup complete. You'll be redirected to your dashboard shortly.
                  </p>
                </div>

                {stepError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {stepError}
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3">
                  <Button type="button" variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={stepSubmitting}
                    onClick={() => {
                      void submitStep({ step: 3 });
                    }}
                  >
                    {stepSubmitting ? "Finishing..." : "Complete onboarding"}
                  </Button>
                </div>
              </div>
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
                  ? `${t("onboarding.weSentMessage")} ${email}. ${t("onboarding.onceConfirmed")}`
                  : `${t("onboarding.signedInAs")} ${email}.`}
              </p>
            )}
            {(checkingSession || awaitingBootstrap) && (
              <div className="mx-auto flex h-10 w-10 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent" />
              </div>
            )}
            {bootstrapStatus === "error" && (
              <div className="mx-auto max-w-md rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {bootstrapError ?? t("onboarding.weCouldNotPrepare")}
                <div className="mt-3 flex justify-center">
                  <Button variant="outline" onClick={retryBootstrap}>
                    {t("common.tryAgain")}
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
                    Language:{" "}
                    <span className="text-foreground">
                      {bootstrappedTenant.language ?? "–"}
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
