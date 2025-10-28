import * as React from "react";
import type { Route } from "./+types/dashboard";
import { BarChart3, BriefcaseBusiness, CalendarDays, Check, ChevronDown, UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase";
import { type AccountBootstrapResponse, type Employee, type EmployeeListResponse } from "@vibe/shared";
import { useTheme } from "~/hooks/use-theme";
import { APP_THEME_OPTIONS, formatThemeName } from "~/lib/theme-options";
import { MyTimeWidget } from "~/components/my-time-widget";
import { RequestTimeOffDialog } from "~/components/timeoff/request-dialog";
import { ActionItems } from "~/components/action-items";

const THEME_MENU_OPTIONS: string[] = ["system", ...APP_THEME_OPTIONS];

// eslint-disable-next-line react-refresh/only-export-components
export async function loader() {
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";

  return { baseUrl };
}

// eslint-disable-next-line react-refresh/only-export-components
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dashboard | Artemis" },
    {
      name: "description",
      content: "A quick overview of your Artemis workspace.",
    },
  ];
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const { theme: activeTheme, setTheme: setActiveTheme } = useTheme();

  const navigate = useNavigate();
  const [session, setSession] = React.useState<Session | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [tenantLoading, setTenantLoading] = React.useState(true);
  const [tenantError, setTenantError] = React.useState<string | null>(null);
  const [tenant, setTenant] = React.useState<AccountBootstrapResponse["tenant"] | null>(null);

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

  React.useEffect(() => {
    if (!session) return;

    let cancelled = false;
    async function fetchTenant() {
      setTenantLoading(true);
      setTenantError(null);
      try {
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const response = await fetch(`${apiBaseUrl}/api/account/bootstrap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });
        const payload = (await response.json().catch(() => ({}))) as Partial<AccountBootstrapResponse>;
        if (!response.ok) {
          const message =
            (payload && typeof (payload as any).error === "string" && (payload as any).error) ||
            response.statusText ||
            "Unable to load workspace";
          throw new Error(message);
        }

        if (cancelled) return;

        const boot = payload as AccountBootstrapResponse;
        if (!boot?.tenant || !boot?.profile) {
          throw new Error("Unexpected response from the server");
        }

        if (!boot.tenant.setup_completed) {
          navigate("/onboarding", { replace: true });
          return;
        }

        setTenant(boot.tenant);
      } catch (error: unknown) {
        if (cancelled) return;
        setTenantError(
          error instanceof Error ? error.message : "Unable to load workspace details"
        );
      } finally {
        if (!cancelled) {
          setTenantLoading(false);
        }
      }
    }

    void fetchTenant();

    return () => {
      cancelled = true;
    };
  }, [session, navigate, apiBaseUrl]);

  const [employees, setEmployees] = React.useState<Employee[] | null>(null);
  const [dataError, setDataError] = React.useState<string | null>(null);
  const [requestOpen, setRequestOpen] = React.useState(false);

  React.useEffect(() => {
    if (!session) return;
    const token = session.access_token;
    if (!token) return;
    const tenantId = tenant?.id;
    if (!tenantId) return;

    let cancelled = false;
    const headers = { Authorization: `Bearer ${token}` } as const;

    async function loadEmployees() {
      setDataError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}`, {
          headers,
        });

        if (!response.ok) {
          throw new Error("Unable to load employees");
        }

        const payload = (await response.json()) as EmployeeListResponse;
        if (!cancelled) {
          setEmployees(payload.employees ?? []);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setEmployees([]);
          setDataError(
            error instanceof Error ? error.message : "Unable to load workspace data"
          );
        }
      }
    }

    void loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [session, apiBaseUrl, tenant?.id]);

  const headcountTrend = React.useMemo(() => {
    const current = Math.max(employees?.length ?? 3, 0);
    if (current === 0) {
      return [0, 0.3, 0.6, 0.9, 1.2, 1.5];
    }

    return [
      Math.max(current * 0.5, 0),
      Math.max(current * 0.65, 0),
      Math.max(current * 0.8, 0),
      Math.max(current * 0.9, 0),
      Math.max(current * 0.95, 0),
      current,
    ];
  }, [employees?.length]);

  const headcountSparklinePath = React.useMemo(() => {
    if (!headcountTrend.length) return "";

    const max = Math.max(...headcountTrend);
    const min = Math.min(...headcountTrend);
    const range = max - min || 1;

    return headcountTrend
      .map((value, index) => {
        const x = (index / Math.max(headcountTrend.length - 1, 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [headcountTrend]);

  if (checking || !session) {
    return (
      <DashboardCenteredState
        ariaLabel="Loading dashboard"
        message="Loading your dashboard..."
      />
    );
  }

  if (tenantLoading) {
    return (
      <DashboardCenteredState
        ariaLabel="Preparing workspace"
        message="Preparing your workspace..."
      />
    );
  }

  if (tenantError) {
    return <DashboardErrorState message={tenantError} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {dataError && (
        <div className="mx-auto max-w-md rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {dataError}
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Welcome back, Testi.</h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            You have{" "}
            <span className="font-semibold text-primary">3</span>{" "}
            pending tasks and{" "}
            <span className="font-semibold text-primary">2</span>{" "}
            new announcements.
          </p>
        </div>
        <DashboardThemeSelector
          currentTheme={activeTheme}
          options={THEME_MENU_OPTIONS}
          onSelect={setActiveTheme}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActionItems apiBaseUrl={apiBaseUrl} session={session} />
        </div>

        <MyTimeWidget 
          apiBaseUrl={apiBaseUrl} 
          session={session} 
          onRequestTimeOff={() => setRequestOpen(true)}
          onTimeEntrySuccess={() => {
            // Refresh any relevant data if needed
            console.log('Time entry created successfully');
          }}
        />

        <RequestTimeOffDialog
          apiBaseUrl={apiBaseUrl}
          session={session}
          open={requestOpen}
          onOpenChange={setRequestOpen}
          onSubmitted={() => setRequestOpen(false)}
        />

        <Card className="group relative overflow-hidden border border-border/60 bg-muted/40">
          <CardHeader className="space-y-1">
            <CardTitle>Team Headcount</CardTitle>
            <CardDescription>Active employees</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <span className="text-5xl font-semibold leading-tight tracking-tight">
              {employees?.length ?? 0}
            </span>
            <span className="text-xs text-muted-foreground/80">Hover to view the last 6 months.</span>
          </CardContent>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-20 translate-y-full items-end justify-center bg-gradient-to-t from-background via-background/90 to-transparent opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <svg viewBox="0 0 100 100" className="h-full w-[85%] text-primary/70">
              <path
                d={headcountSparklinePath}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </Card>

        <Card className="border border-border/60 bg-muted/40">
          <CardHeader className="space-y-1">
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>Celebrate your team.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-lg" aria-hidden="true">
                  🎂
                </span>
                <span>Mark&apos;s birthday is this Friday (Oct 31).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lg" aria-hidden="true">
                  🎉
                </span>
                <span>Javier&apos;s 3-year work anniversary is next Tuesday.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-muted/40">
          <CardHeader className="space-y-1">
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Jump into the tools you use most.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                to="/employees#new"
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background p-4 text-center text-sm font-semibold transition hover:border-primary hover:bg-muted"
              >
                <UserPlus className="h-6 w-6 text-primary" />
                <span>Add a New Employee</span>
              </Link>
              <Link
                to="/calendar"
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background p-4 text-center text-sm font-semibold transition hover:border-primary hover:bg-muted"
              >
                <CalendarDays className="h-6 w-6 text-primary" />
                <span>View Company Calendar</span>
              </Link>
              <Link
                to="/jobs/new"
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background p-4 text-center text-sm font-semibold transition hover:border-primary hover:bg-muted"
              >
                <BriefcaseBusiness className="h-6 w-6 text-primary" />
                <span>Post a New Job</span>
              </Link>
              <Link
                to="/reports"
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background p-4 text-center text-sm font-semibold transition hover:border-primary hover:bg-muted"
              >
                <BarChart3 className="h-6 w-6 text-primary" />
                <span>Run a Report</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type DashboardCenteredStateProps = {
  message: string;
  ariaLabel: string;
};

function DashboardCenteredState({ message, ariaLabel }: DashboardCenteredStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-r-transparent"
        aria-label={ariaLabel}
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

type DashboardErrorStateProps = {
  message: string;
};

function DashboardErrorState({ message }: DashboardErrorStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="mx-auto max-w-md rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {message}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link to="/onboarding">Return to onboarding</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}

type DashboardThemeSelectorProps = {
  currentTheme: string;
  options: string[];
  onSelect: (value: string) => void;
};

function DashboardThemeSelector({
  currentTheme,
  options,
  onSelect,
}: DashboardThemeSelectorProps) {
  if (!options.length) return null;

  const getLabel = (value: string) =>
    value === "system" ? "System (Auto)" : formatThemeName(value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Select theme"
          variant="outline"
          size="sm"
          className="inline-flex min-w-[11rem] justify-between gap-2"
        >
          <span className="text-sm font-semibold">Theme</span>
          <span className="text-sm text-muted-foreground">{getLabel(currentTheme)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {options.map((option) => {
          const isActive = option === currentTheme;
          return (
            <DropdownMenuItem
              key={option}
              onClick={() => {
                if (!isActive) onSelect(option);
              }}
              className="flex items-center gap-2 text-sm"
            >
              <Check className={`h-3.5 w-3.5 ${isActive ? "opacity-100" : "opacity-0"}`} />
              <span>{getLabel(option)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
