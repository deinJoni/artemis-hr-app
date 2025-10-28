import * as React from "react";

import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
  NavLink,
  Navigate,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import type { Session } from "@supabase/supabase-js";
import {
  AccountBootstrapResponseSchema,
  type AccountBootstrapResponse,
} from "@vibe/shared";
import { AppSidebar } from "~/components/app-sidebar";
import { ThemeProvider } from "~/components/theme-provider";
import { ModeToggle } from "~/components/mode-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { supabase } from "~/lib/supabase";
import { cn } from "~/lib/utils";
import "./app.css";

const DEFAULT_BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ??
  (typeof process !== "undefined"
    ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
    : undefined) ??
  "http://localhost:8787";

const API_BASE_URL = DEFAULT_BACKEND_URL.replace(/\/$/, "");

// eslint-disable-next-line react-refresh/only-export-components
export const links = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

function NoFlashThemeScript() {
  const code = `
  (function() {
    try {
      var key = ${JSON.stringify("vite-ui-theme")};
      var t = localStorage.getItem(key) || ${JSON.stringify("system")};
      if (t === 'system') {
        t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      var root = document.documentElement;
      root.classList.remove('light','dark');
      root.classList.add(t);
      root.style.colorScheme = (t === 'dark') ? 'dark' : 'light';
    } catch (e) {}
  })();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <NoFlashThemeScript />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          <AppShell>{children}</AppShell>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [session, setSession] = React.useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [tenant, setTenant] = React.useState<AccountBootstrapResponse["tenant"] | null>(null);
  const [tenantStatus, setTenantStatus] = React.useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [tenantError, setTenantError] = React.useState<string | null>(null);
  const tenantRef = React.useRef<AccountBootstrapResponse["tenant"] | null>(null);

  React.useEffect(() => {
    tenantRef.current = tenant;
  }, [tenant]);

  React.useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!session) {
      setTenant(null);
      setTenantStatus("idle");
      setTenantError(null);
      return;
    }

    const path = location.pathname;
    const shouldCheckTenant =
      path === "/" ||
      path.startsWith("/members") ||
      path.startsWith("/employees") ||
      path.startsWith("/settings") ||
      path.startsWith("/support") ||
      path.startsWith("/onboarding");

    if (!shouldCheckTenant) {
      setTenantStatus((status) => (status === "idle" ? status : "idle"));
      setTenantError(null);
      return;
    }

    if (tenantRef.current?.setup_completed && !location.pathname.startsWith("/onboarding")) {
      setTenantStatus("ready");
      return;
    }

    let cancelled = false;
    setTenantStatus("loading");
    setTenantError(null);

    async function loadTenant() {
      try {
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const response = await fetch(`${API_BASE_URL}/api/account/bootstrap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        const payload = await response.json().catch(() => ({} as Record<string, unknown>));
        if (!response.ok) {
          const message =
            (typeof payload.error === "string" && payload.error) ||
            response.statusText ||
            "Unable to load workspace";
          throw new Error(message);
        }

        const parsed = AccountBootstrapResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("Unexpected response from the server");
        }

        if (cancelled) return;

        setTenant(parsed.data.tenant);
        setTenantStatus(parsed.data.tenant.setup_completed ? "ready" : "idle");
      } catch (error: unknown) {
        if (cancelled) return;
        setTenant(null);
        setTenantStatus("error");
        setTenantError(error instanceof Error ? error.message : "Unable to load workspace");
      }
    }

    void loadTenant();

    return () => {
      cancelled = true;
    };
  }, [session, location.pathname]);

  if (checkingSession) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (!session) {
    const path = location.pathname;
    const allowUnauthed = path === "/login" || path === "/register" || path === "/reset-password";
    if (allowUnauthed) {
      return <div className="min-h-screen bg-background">{children}</div>;
    }
    return <Navigate to="/login" replace />;
  }

  const isTenantReady = tenant?.setup_completed ?? false;

  if (!isTenantReady) {
    return (
      <div className="min-h-screen bg-background">
        {tenantStatus === "error" ? (
          <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {tenantError}
          </div>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <AuthenticatedLayout
      session={session}
      tenant={tenant!}
      tenantError={tenantStatus === "error" ? tenantError : null}
      pathname={location.pathname}
    >
      {children}
    </AuthenticatedLayout>
  );
}

const marketingLinks = [
  { to: "/", label: "Welcome" },
  { to: "/example", label: "Example" },
  { to: "/login", label: "Login" },
  { to: "/register", label: "Register" },
  { to: "/dashboard", label: "Dashboard" },
];

function _MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <nav className="flex items-center gap-4">
            {marketingLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "transition-colors",
                    isActive
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ModeToggle />
          </div>
        </div>
      </header>
      {children}
    </>
  );
}

type AuthenticatedLayoutProps = {
  children: React.ReactNode;
  session: Session;
  tenant: AccountBootstrapResponse["tenant"];
  tenantError: string | null;
  pathname: string;
};

function AuthenticatedLayout({
  children,
  session,
  tenant,
  tenantError,
  pathname,
}: AuthenticatedLayoutProps) {
  const breadcrumbs = React.useMemo(() => buildBreadcrumbs(pathname), [pathname]);

  // Simple role guard: allow Calendar only for manager+ when we can check via backend
  const [canViewCalendar, setCanViewCalendar] = React.useState<boolean>(false);
  const [canManageTeam, setCanManageTeam] = React.useState<boolean>(false);
  React.useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/permissions/${tenant.id}?permission=calendar.read`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await res.json().catch(() => ({} as any));
        if (!cancelled) setCanViewCalendar(Boolean(payload.allowed));
      } catch {
        if (!cancelled) setCanViewCalendar(false);
      }
    }
    void check();
    return () => { cancelled = true };
  }, [tenant.id, session.access_token]);

  React.useEffect(() => {
    let cancelled = false;
    async function checkTeamAccess() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/permissions/${tenant.id}?permission=check_ins.read`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await res.json().catch(() => ({} as any));
        if (!cancelled) setCanManageTeam(Boolean(payload.allowed));
      } catch {
        if (!cancelled) setCanManageTeam(false);
      }
    }
    void checkTeamAccess();
    return () => { cancelled = true };
  }, [tenant.id, session.access_token]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar
          session={session}
          tenant={tenant}
          canViewCalendar={canViewCalendar}
          canManageTeam={canManageTeam}
        />
        <SidebarInset>
          <div className="flex min-h-screen flex-col">
            <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1 lg:hidden" />
                <Separator
                  orientation="vertical"
                  className="mr-2 hidden lg:block data-[orientation=vertical]:h-6"
                />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden sm:block">
                      <BreadcrumbLink asChild>
                        <Link to="/">Dashboard</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    {breadcrumbs.length > 0 ? (
                      <BreadcrumbSeparator className="hidden sm:block" />
                    ) : null}
                    {breadcrumbs.map((crumb, index) => {
                      const isLast = index === breadcrumbs.length - 1;
                      return (
                        <React.Fragment key={crumb.href}>
                          {isLast ? (
                            <BreadcrumbItem>
                              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                            </BreadcrumbItem>
                          ) : (
                            <>
                              <BreadcrumbItem className="hidden sm:block">
                                <BreadcrumbLink asChild>
                                  <Link to={crumb.href}>{crumb.label}</Link>
                                </BreadcrumbLink>
                              </BreadcrumbItem>
                              <BreadcrumbSeparator className="hidden sm:block" />
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {breadcrumbs.length === 0 ? (
                      <BreadcrumbItem>
                        <BreadcrumbPage>Overview</BreadcrumbPage>
                      </BreadcrumbItem>
                    ) : null}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className="flex items-center gap-2">
                <ModeToggle />
              </div>
            </header>
            {tenantError ? (
              <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive sm:px-6">
                {tenantError}
              </div>
            ) : null}
            <main className="flex flex-1 flex-col gap-4 p-4 pb-8 pt-4 sm:p-6 sm:pt-4">
              {children}
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

type Crumb = { href: string; label: string };

function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [];
  }

  let href = "";
  const crumbs: Crumb[] = [];

  for (const segment of segments) {
    href += `/${segment}`;
    if (href === "/") continue;
    crumbs.push({
      href,
      label: formatSegment(segment),
    });
  }

  return crumbs;
}

function formatSegment(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
