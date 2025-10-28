import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { CalendarDays, GitBranch, LayoutDashboard, LifeBuoy, Settings, Users, UserCircle2, LogOut } from "lucide-react";
import { NavLink } from "react-router";
import type { AccountBootstrapResponse } from "@vibe/shared";
import { supabase } from "~/lib/supabase";
import { cn } from "~/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";

type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  requires?: "calendar" | "team";
};

type AppSidebarProps = {
  session: Session;
  tenant: AccountBootstrapResponse["tenant"] | null;
};

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, disabled: false },
  { label: "Calendar", to: "/calendar", icon: CalendarDays, disabled: false, requires: "calendar" },
  { label: "My Team", to: "/my-team", icon: UserCircle2, disabled: false, requires: "team" },
  { label: "Workflows", to: "/workflows", icon: GitBranch, disabled: false },
  { label: "Members", to: "/members", icon: Users, disabled: false },
  { label: "Employees", to: "/employees", icon: Users, disabled: false },
  { label: "Settings", to: "/settings", icon: Settings, disabled: false },
  { label: "Support", to: "/support", icon: LifeBuoy, disabled: true },
];

export function AppSidebar({
  session,
  tenant,
  canViewCalendar = false,
  canManageTeam = false,
}: AppSidebarProps & { canViewCalendar?: boolean; canManageTeam?: boolean }) {
  const { open, isMobile, setOpen } = useSidebar();
  const displayName =
    tenant?.name ??
    session.user.user_metadata?.full_name ??
    session.user.email ??
    session.user.identities?.[0]?.identity_data?.email ??
    "Workspace";

  const email =
    session.user.email ??
    session.user.identities?.[0]?.identity_data?.email ??
    undefined;

  const handleNavigate = React.useCallback(() => {
    if (isMobile) {
      setOpen(false);
    }
  }, [isMobile, setOpen]);

  return (
    <Sidebar>
      <SidebarHeader className="h-16 items-center justify-between px-4">
        <div
          className={cn(
            "flex items-center gap-2 text-base font-semibold leading-tight",
            !open && "justify-center"
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-semibold">
            A
          </div>
          <div
            className={cn("flex flex-col", !open && "sr-only")}
          >
            <span className="truncate">{displayName}</span>
            <span className="text-xs font-normal text-sidebar-foreground/60">
              Artemis
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarMenu>
          {navItems
            .filter((item) => {
              if (item.requires === "calendar") return canViewCalendar;
              if (item.requires === "team") return canManageTeam;
              return true;
            })
            .map((item) => {
            const Icon = item.icon;
            const baseClasses = cn(
              "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm transition-colors",
              !open && "justify-center px-2"
            );

            if (item.disabled) {
              return (
                <SidebarMenuItem key={item.label}>
                  <span
                    aria-disabled="true"
                    className={cn(
                      baseClasses,
                      "cursor-not-allowed text-sidebar-foreground/50"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className={cn("truncate", !open && "sr-only")}>{item.label}</span>
                    {open ? (
                      <span className="ml-auto rounded-full bg-sidebar-accent/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/70">
                        Soon
                      </span>
                    ) : null}
                  </span>
                </SidebarMenuItem>
              );
            }

            return (
              <SidebarMenuItem key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      baseClasses,
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )
                  }
                  onClick={handleNavigate}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className={cn("truncate", !open && "sr-only")}>{item.label}</span>
                </NavLink>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar/40 px-3 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-sm font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className={cn("min-w-0 text-sm", !open && "sr-only")}>
            <p className="truncate font-medium text-sidebar-foreground">{displayName}</p>
            {email ? (
              <p className="truncate text-xs text-sidebar-foreground/70">{email}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
