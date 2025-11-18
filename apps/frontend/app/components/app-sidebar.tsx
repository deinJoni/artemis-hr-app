import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { CalendarDays, GitBranch, LayoutDashboard, LifeBuoy, Settings, Users, UserCircle2, LogOut, Clock, CheckCircle, TrendingUp, Calendar, CalendarCheck, Search, History, ChevronDown, ChevronRight, Briefcase, MessageCircle, ShieldCheck } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router";
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
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { useKeyboardShortcuts } from "~/hooks/use-keyboard-shortcuts";
import { useTranslation } from "~/lib/i18n";
import { useFeatureFlag } from "~/lib/feature-flags";
import type { FeatureSlug } from "~/components/feature-gate";

type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  requires?: "calendar" | "team";
  badge?: number;
  keywords?: string[];
  feature?: FeatureSlug;
  superadminOnly?: boolean;
};

type AppSidebarProps = {
  session: Session;
  tenant: AccountBootstrapResponse["tenant"] | null;
  isSuperadmin?: boolean;
};

// Nav items will be created inside component to use translations

export function AppSidebar({
  session,
  tenant,
  canViewCalendar = false,
  canManageTeam = false,
  isSuperadmin = false,
}: AppSidebarProps & { canViewCalendar?: boolean; canManageTeam?: boolean }) {
  const { t } = useTranslation();
  const { open, isMobile, setOpen } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [recentVisits, setRecentVisits] = React.useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [showSearch, setShowSearch] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const coreHrEnabled = useFeatureFlag("core_hr", true);
  const timeEnabled = useFeatureFlag("time_attendance", true);
  const leaveEnabled = useFeatureFlag("leave_management", true);
  const recruitingEnabled = useFeatureFlag("recruiting", false);
  const workflowsEnabled = useFeatureFlag("workflows", false);
  const isFeatureEnabled = React.useCallback(
    (slug?: FeatureSlug) => {
      if (!slug) return true;
      switch (slug) {
        case "core_hr":
          return coreHrEnabled;
        case "time_attendance":
          return timeEnabled;
        case "leave_management":
          return leaveEnabled;
        case "recruiting":
          return recruitingEnabled;
        case "workflows":
          return workflowsEnabled;
        default:
          return true;
      }
    },
    [coreHrEnabled, timeEnabled, leaveEnabled, recruitingEnabled, workflowsEnabled]
  );

  const navItems: NavItem[] = React.useMemo(() => [
    { label: t("sidebar.dashboard"), to: "/", icon: LayoutDashboard, disabled: false, keywords: ["home", "main"] },
    { label: t("sidebar.timeEntries"), to: "/time/entries", icon: Clock, disabled: false, keywords: ["time", "hours", "timesheet"], feature: "time_attendance" },
    { label: t("sidebar.overtime"), to: "/time/overtime", icon: TrendingUp, disabled: false, keywords: ["ot", "extra"], feature: "time_attendance" },
    { label: t("sidebar.approvals"), to: "/approvals", icon: CheckCircle, disabled: false, requires: "team", keywords: ["approve", "review", "time", "leave"], feature: "time_attendance" },
    { label: t("sidebar.chat"), to: "/chat", icon: MessageCircle, disabled: false, keywords: ["assistant", "ai", "support", "chat"] },
    { label: t("sidebar.calendar"), to: "/calendar", icon: CalendarDays, disabled: false, requires: "calendar", keywords: ["schedule", "events"], feature: "time_attendance" },
    { label: t("sidebar.myTeam"), to: "/my-team", icon: UserCircle2, disabled: false, requires: "team", keywords: ["team", "people"], feature: "core_hr" },
    { label: t("sidebar.workflows"), to: "/workflows", icon: GitBranch, disabled: false, keywords: ["automation", "process"], feature: "workflows" },
    { label: t("sidebar.members"), to: "/members", icon: Users, disabled: false, keywords: ["people", "directory"], feature: "core_hr" },
    { label: t("sidebar.employees"), to: "/employees", icon: Users, disabled: false, keywords: ["staff", "workers"], feature: "core_hr" },
    { label: t("sidebar.featureFlags"), to: "/admin/features", icon: ShieldCheck, disabled: false, keywords: ["feature", "flags", "admin"], superadminOnly: true },
    { label: t("sidebar.settings"), to: "/settings", icon: Settings, disabled: false, keywords: ["config", "preferences"] },
    { label: t("sidebar.support"), to: "/support", icon: LifeBuoy, disabled: true, keywords: ["help"] },
  ], [t]);

  const leaveNavItems: NavItem[] = React.useMemo(() => [
    { label: t("sidebar.myRequests"), to: "/leave/requests", icon: Calendar, disabled: false, keywords: ["leave", "pto", "vacation"], feature: "leave_management" },
    { label: t("sidebar.teamCalendar"), to: "/leave/team-calendar", icon: CalendarCheck, disabled: false, requires: "team", keywords: ["calendar", "schedule"], feature: "leave_management" },
    { label: t("sidebar.settings"), to: "/leave/admin", icon: Settings, disabled: false, requires: "calendar", keywords: ["admin", "config"], feature: "leave_management" },
  ], [t]);

  const recruitingNavItems: NavItem[] = React.useMemo(() => [
    { label: t("sidebar.jobs"), to: "/recruiting/jobs", icon: Briefcase, disabled: false, keywords: ["jobs", "postings", "positions"], feature: "recruiting" },
    { label: t("sidebar.analytics"), to: "/recruiting/analytics", icon: TrendingUp, disabled: false, keywords: ["stats", "metrics", "reports"], feature: "recruiting" },
  ], [t]);

  const displayName =
    tenant?.name ??
    session.user.user_metadata?.full_name ??
    session.user.email ??
    session.user.identities?.[0]?.identity_data?.email ??
    t("common.workspace");

  const email =
    session.user.email ??
    session.user.identities?.[0]?.identity_data?.email ??
    undefined;

  // Track recent visits
  React.useEffect(() => {
    const currentPath = location.pathname;
    setRecentVisits((prev) => {
      const filtered = prev.filter((p) => p !== currentPath);
      return [currentPath, ...filtered].slice(0, 5);
    });
  }, [location.pathname]);

  const filterNavItems = React.useCallback(
    (items: NavItem[]) =>
      items.filter((item) => {
        if (item.superadminOnly && !isSuperadmin) return false;
        if (!isFeatureEnabled(item.feature)) return false;
        if (item.requires === "calendar") return canViewCalendar;
        if (item.requires === "team") return canManageTeam;
        return true;
      }),
    [canManageTeam, canViewCalendar, isFeatureEnabled, isSuperadmin]
  );

  // Get all available nav items
  const allNavItems = React.useMemo(() => {
    return [
      ...filterNavItems(navItems),
      ...filterNavItems(leaveNavItems),
      ...filterNavItems(recruitingNavItems),
    ];
  }, [navItems, leaveNavItems, recruitingNavItems, filterNavItems]);

  // Filter items based on search
  const filteredNavItems = React.useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return allNavItems;
    const query = trimmedQuery.toLowerCase();
    return allNavItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.to.toLowerCase().includes(query) ||
        item.keywords?.some((kw) => kw.toLowerCase().includes(query))
    );
  }, [allNavItems, searchQuery]);

  const trimmedSearchQuery = searchQuery.trim();
  const isSearching = showSearch && trimmedSearchQuery.length > 0;

  const handleNavigate = React.useCallback((path: string) => {
    navigate(path);
    if (isMobile) {
      setOpen(false);
    }
    setShowSearch(false);
    setSearchQuery("");
  }, [isMobile, setOpen, navigate]);

  const toggleGroup = React.useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  // Keyboard navigation for search
  useKeyboardShortcuts({
    enabled: isSearching,
    shortcuts: [
      {
        key: "ArrowDown",
        handler: () => {
          setSelectedIndex((prev) => Math.min(prev + 1, filteredNavItems.length - 1));
        },
      },
      {
        key: "ArrowUp",
        handler: () => {
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
        },
      },
      {
        key: "Enter",
        handler: () => {
          if (selectedIndex >= 0 && filteredNavItems[selectedIndex]) {
            handleNavigate(filteredNavItems[selectedIndex].to);
          }
        },
      },
      {
        key: "Escape",
        handler: () => {
          setShowSearch(false);
          setSearchQuery("");
          setSelectedIndex(-1);
        },
      },
    ],
  });

  // Cmd+P for sidebar search
  useKeyboardShortcuts({
    enabled: true,
    shortcuts: [
      {
        key: "p",
        metaKey: true,
        handler: (e) => {
          e.preventDefault();
          setShowSearch(true);
          setTimeout(() => searchInputRef.current?.focus(), 100);
        },
      },
    ],
  });

  React.useEffect(() => {
    if (isSearching) {
      setSelectedIndex(filteredNavItems.length > 0 ? 0 : -1);
    } else {
      setSelectedIndex(-1);
    }
  }, [filteredNavItems.length, isSearching]);

  const workspaceItems = filterNavItems(navItems);
  const leaveItems = filterNavItems(leaveNavItems);
  const recruitingItems = filterNavItems(recruitingNavItems);

  const workspaceCollapsed = collapsedGroups.has("workspace");
  const leaveCollapsed = collapsedGroups.has("leave");
  const recruitingCollapsed = collapsedGroups.has("recruiting");

  return (
    <Sidebar>
      <SidebarHeader className="h-auto items-center justify-between px-4 py-3 space-y-3">
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
        {open && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={t("common.searchPages")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearch(true);
              }}
              onBlur={(e) => {
                if (!e.target.value.trim()) {
                  setShowSearch(false);
                  setSelectedIndex(-1);
                }
              }}
              onFocus={() => setShowSearch(true)}
              className="h-9 pl-9 pr-3 text-sm bg-sidebar/50 border-sidebar-border"
            />
            {!showSearch && (
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-sidebar-accent px-1.5 font-mono text-[10px] font-medium text-sidebar-foreground/70 opacity-100">
                ⌘P
              </kbd>
            )}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {isSearching && (
          <div className="px-2 pb-2">
            <div className="space-y-1">
              {filteredNavItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => handleNavigate(item.to)}
                    className={cn(
                      "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                      isSelected
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
              {filteredNavItems.length === 0 && (
                <div className="px-3 py-2 text-sm text-sidebar-foreground/50">
                  {t("common.noPagesFound")}
                </div>
              )}
            </div>
          </div>
        )}

        {!isSearching && recentVisits.length > 0 && (
          <div className="px-2 pb-2">
            <SidebarGroupLabel className="flex items-center gap-2">
              <History className="h-3.5 w-3.5" />
              {t("common.recent")}
            </SidebarGroupLabel>
            <SidebarMenu>
              {recentVisits.slice(0, 3).map((path) => {
                const item = allNavItems.find((i) => i.to === path);
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={path}>
                    <NavLink
                      to={path}
                      className={({ isActive }) =>
                        cn(
                          "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )
                      }
                      onClick={() => handleNavigate(path)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        )}

        {!isSearching && (
          <>
            <button
              type="button"
              onClick={() => toggleGroup("workspace")}
              className="w-full"
            >
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-sidebar-foreground">
                <span>{t("sidebar.workspace")}</span>
                {workspaceCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </SidebarGroupLabel>
            </button>
            {!workspaceCollapsed && (
              <SidebarMenu>
                {workspaceItems.map((item) => {
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
                              {t("common.soon")}
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
                        onClick={() => handleNavigate(item.to)}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className={cn("truncate", !open && "sr-only")}>{item.label}</span>
                        {item.badge && item.badge > 0 && open && (
                          <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                            {item.badge}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}

            {leaveItems.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => toggleGroup("leave")}
                  className="w-full mt-4"
                >
                  <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-sidebar-foreground">
                    <span>{t("sidebar.leaveAbsence")}</span>
                    {leaveCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </SidebarGroupLabel>
                </button>
                {!leaveCollapsed && (
                  <SidebarMenu>
                    {leaveItems.map((item) => {
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
                              {t("common.soon")}
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
                        onClick={() => handleNavigate(item.to)}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className={cn("truncate", !open && "sr-only")}>{item.label}</span>
                        {item.badge && item.badge > 0 && open && (
                          <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                            {item.badge}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuItem>
                  );
                    })}
                  </SidebarMenu>
                )}
              </>
            )}

            {recruitingItems.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => toggleGroup("recruiting")}
                  className="w-full mt-4"
                >
                  <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-sidebar-foreground">
                    <span>{t("sidebar.recruiting")}</span>
                    {recruitingCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </SidebarGroupLabel>
                </button>
                {!recruitingCollapsed && (
                  <SidebarMenu>
                    {recruitingItems.map((item) => {
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
                              {t("common.soon")}
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
                        onClick={() => handleNavigate(item.to)}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className={cn("truncate", !open && "sr-only")}>{item.label}</span>
                        {item.badge && item.badge > 0 && open && (
                          <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                            {item.badge}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuItem>
                  );
                    })}
                  </SidebarMenu>
                )}
              </>
            )}
          </>
        )}
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
            aria-label={t("common.signOut")}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
