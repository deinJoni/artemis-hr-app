import * as React from "react";
import type { Route } from "./+types/dashboard";
import { BarChart3, BriefcaseBusiness, CalendarDays, UserPlus, Clock, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Link, useNavigate } from "react-router";
import { useTheme } from "~/hooks/use-theme";
import { APP_THEME_OPTIONS } from "~/lib/theme-options";
import { supabase } from "~/lib/supabase";
import { MyTimeWidget } from "~/components/my-time-widget";
import { RequestTimeOffDialog } from "~/components/timeoff/request-dialog";
import { ActionItems } from "~/components/action-items";
import { LeaveBalanceWidget } from "~/components/leave/leave-balance-widget";
import { PendingApprovalsWidget } from "~/components/leave/pending-approvals-widget";
import { BentoGrid, BentoCard } from "~/components/bento-grid";
import { FloatingActionButton } from "~/components/floating-action-button";
import { QuickActionsMenu } from "~/components/quick-actions-menu";
import { ManualEntryDialog } from "~/components/time/manual-entry-dialog";
import { useKeyboardShortcuts } from "~/hooks/use-keyboard-shortcuts";
import { useToast } from "~/components/toast";
import { useDashboardAuth } from "~/features/dashboard/hooks/use-dashboard-auth";
import { useDashboardTenant } from "~/features/dashboard/hooks/use-dashboard-tenant";
import { useDashboardEmployees } from "~/features/dashboard/hooks/use-dashboard-employees";
import { useClockStatus } from "~/features/dashboard/hooks/use-clock-status";
import {
  DashboardCenteredState,
  DashboardErrorState,
  DashboardThemeSelector,
} from "~/features/dashboard/components/dashboard-states";
import { useTranslation } from "~/lib/i18n";

const THEME_MENU_OPTIONS: string[] = ["system", ...APP_THEME_OPTIONS];

export async function loader() {
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";

  return { baseUrl };
}

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
  const { t } = useTranslation();
  const toast = useToast();
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const { theme: activeTheme, setTheme: setActiveTheme } = useTheme();

  const navigate = useNavigate();
  const { session, checking } = useDashboardAuth(navigate);
  const { tenant, profile, tenantLoading, tenantError } = useDashboardTenant({
    apiBaseUrl,
    navigate,
    session,
  });
  const { employees, dataError } = useDashboardEmployees({
    apiBaseUrl,
    navigate,
    session,
    tenantId: tenant?.id,
  });
  const { isClockedIn, setIsClockedIn } = useClockStatus({
    apiBaseUrl,
    navigate,
    session,
  });

  const [requestOpen, setRequestOpen] = React.useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = React.useState(false);
  const [timeEntryOpen, setTimeEntryOpen] = React.useState(false);

  // Keyboard shortcut for Quick Actions (Cmd+K)
  useKeyboardShortcuts({
    enabled: true,
    shortcuts: [
      {
        key: "k",
        metaKey: true,
        handler: () => {
          setQuickActionsOpen(true);
        },
      },
    ],
  });

  const handleClockInOut = React.useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/time/${isClockedIn ? "clock-out" : "clock-in"}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (res.ok) {
        setIsClockedIn(!isClockedIn);
        toast.showToast(
          `Successfully clocked ${isClockedIn ? "out" : "in"}`,
          "success"
        );
      } else {
        if (res.status === 401) {
          await supabase.auth.signOut();
          navigate("/login", { replace: true, state: { from: "/" } });
          return;
        }
        const data = await res.json().catch(() => ({}));
        toast.showToast(
          (data as any)?.error || "Failed to clock in/out",
          "error"
        );
      }
    } catch (error) {
      toast.showToast(
        error instanceof Error ? error.message : "Failed to clock in/out",
        "error"
      );
    }
  }, [session, apiBaseUrl, isClockedIn, toast, navigate, setIsClockedIn]);

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
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t("dashboard.welcomeBack")}, {profile?.display_name ? profile.display_name.split(' ')[0] : t("dashboard.there")}.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {t("dashboard.youHave")}{" "}
            <span className="font-semibold text-primary">3</span>{" "}
            {t("dashboard.pendingTasks")} {t("dashboard.and")}{" "}
            <span className="font-semibold text-primary">2</span>{" "}
            {t("dashboard.newAnnouncements")}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickActionsOpen(true)}
            className="hidden sm:flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            {t("dashboard.quickActions")}
            <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              ⌘K
            </kbd>
          </Button>
          <DashboardThemeSelector
            currentTheme={activeTheme}
            options={THEME_MENU_OPTIONS}
            onSelect={setActiveTheme}
          />
        </div>
      </div>

      {/* Quick Actions Card */}
      <BentoCard className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {t("dashboard.quickActions")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{t("dashboard.oneClickAccess")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button
            onClick={handleClockInOut}
            className="h-auto flex-col gap-2 py-4 bg-background hover:bg-accent"
            variant="outline"
          >
            <Clock className="h-5 w-5" />
            <span className="text-sm font-medium">{isClockedIn ? t("time.clockOut") : t("time.clockIn")}</span>
          </Button>
          <Button
            onClick={() => setRequestOpen(true)}
            className="h-auto flex-col gap-2 py-4 bg-background hover:bg-accent"
            variant="outline"
          >
            <CalendarDays className="h-5 w-5" />
            <span className="text-sm font-medium">{t("dashboard.requestTimeOff")}</span>
          </Button>
          <Button
            onClick={() => setTimeEntryOpen(true)}
            className="h-auto flex-col gap-2 py-4 bg-background hover:bg-accent"
            variant="outline"
          >
            <Clock className="h-5 w-5" />
            <span className="text-sm font-medium">{t("dashboard.addTimeEntry")}</span>
          </Button>
          <Button
            onClick={() => navigate("/employees")}
            className="h-auto flex-col gap-2 py-4 bg-background hover:bg-accent"
            variant="outline"
          >
            <UserPlus className="h-5 w-5" />
            <span className="text-sm font-medium">{t("dashboard.addEmployee")}</span>
          </Button>
        </div>
      </BentoCard>

      <BentoGrid>
        <BentoCard span={2} className="lg:col-span-2">
          <ActionItems apiBaseUrl={apiBaseUrl} session={session} />
        </BentoCard>

        <BentoCard>
          <MyTimeWidget 
            apiBaseUrl={apiBaseUrl} 
            session={session} 
            onRequestTimeOff={() => setRequestOpen(true)}
            onTimeEntrySuccess={() => {
              // Refresh any relevant data if needed
              console.log('Time entry created successfully');
            }}
          />
        </BentoCard>

        <BentoCard>
          <LeaveBalanceWidget
            onRequestLeave={() => setRequestOpen(true)}
          />
        </BentoCard>

        <BentoCard>
          <PendingApprovalsWidget />
        </BentoCard>

        <BentoCard className="group relative overflow-hidden">
          <CardHeader className="space-y-1 pb-4">
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
        </BentoCard>

        <BentoCard>
          <CardHeader className="space-y-1 pb-4">
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
        </BentoCard>

        <BentoCard span={2} className="lg:col-span-2">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Jump into the tools you use most.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                to="/employees"
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
                to="/recruiting/jobs/new"
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background p-4 text-center text-sm font-semibold transition hover:border-primary hover:bg-muted"
              >
                <BriefcaseBusiness className="h-6 w-6 text-primary" />
                <span>Post a New Job</span>
              </Link>
              <Link
                to="/leave/reports"
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background p-4 text-center text-sm font-semibold transition hover:border-primary hover:bg-muted"
              >
                <BarChart3 className="h-6 w-6 text-primary" />
                <span>Run a Report</span>
              </Link>
            </div>
          </CardContent>
        </BentoCard>
      </BentoGrid>

      {/* Dialogs */}
      <RequestTimeOffDialog
        apiBaseUrl={apiBaseUrl}
        session={session}
        open={requestOpen}
        onOpenChange={setRequestOpen}
        onSubmitted={() => setRequestOpen(false)}
      />

      <ManualEntryDialog
        apiBaseUrl={apiBaseUrl}
        session={session}
        open={timeEntryOpen}
        onOpenChange={setTimeEntryOpen}
        onSuccess={() => {
          setTimeEntryOpen(false);
        }}
      >
        <button type="button" style={{ display: "none" }} />
      </ManualEntryDialog>

      {/* Quick Actions Menu */}
      <QuickActionsMenu
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        onClockInOut={handleClockInOut}
        onRequestTimeOff={() => {
          setQuickActionsOpen(false);
          setRequestOpen(true);
        }}
        onAddTimeEntry={() => {
          setQuickActionsOpen(false);
          setTimeEntryOpen(true);
        }}
        onAddEmployee={() => {
          setQuickActionsOpen(false);
          navigate("/employees");
        }}
      />

      {/* Floating Action Button */}
      <FloatingActionButton
        onClockInOut={handleClockInOut}
        onRequestTimeOff={() => setRequestOpen(true)}
        onAddTimeEntry={() => setTimeEntryOpen(true)}
        onAddEmployee={() => navigate("/employees")}
      />
    </div>
  );
}
