import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  GitBranch,
  History,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  Network,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  User,
  UserCircle2,
  Users,
} from "lucide-react";
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { useKeyboardShortcuts } from "~/hooks/use-keyboard-shortcuts";
import { useTranslation } from "~/lib/i18n";
import { useFeatureFlag } from "~/lib/feature-flags";
import type { FeatureSlug } from "~/components/feature-gate";
import { usePermissions } from "~/lib/permissions";

type PermissionRequirement = "calendar" | "team";

type NavItemConfig = {
  key: string;
  labelKey: string;
  to: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  requires?: PermissionRequirement;
  badge?: number;
  keywords?: string[];
  feature?: FeatureSlug;
  superadminOnly?: boolean;
  permissionKey?: string;
  children?: NavItemConfig[];
};

type FeatureNavGroup = {
  id: string;
  labelKey: string;
  feature?: FeatureSlug;
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItemConfig[];
};

type AppSidebarProps = {
  session: Session;
  tenant: AccountBootstrapResponse["tenant"] | null;
  isSuperadmin?: boolean;
};

const FEATURE_NAV: FeatureNavGroup[] = [
  {
    id: "overview",
    labelKey: "sidebar.groupOverview",
    items: [
      {
        key: "dashboard",
        labelKey: "sidebar.dashboard",
        to: "/",
        icon: LayoutDashboard,
        keywords: ["home", "main"],
      },
      {
        key: "myProfile",
        labelKey: "sidebar.myProfile",
        to: "/profile",
        icon: User,
        keywords: ["profile", "self-service", "contact"],
      },
      {
        key: "chat",
        labelKey: "sidebar.chat",
        to: "/chat",
        icon: MessageCircle,
        keywords: ["assistant", "ai", "support", "chat"],
      },
      {
        key: "tasks",
        labelKey: "sidebar.tasks",
        to: "/tasks",
        icon: ClipboardList,
        keywords: ["checklist", "todo", "tasks"],
      },
    ],
  },
  {
    id: "peopleOps",
    labelKey: "sidebar.groupPeopleOps",
    feature: "core_hr",
    items: [
      {
        key: "employees",
        labelKey: "sidebar.employees",
        to: "/employees",
        icon: Users,
        permissionKey: "employees.read",
        keywords: ["staff", "workers"],
      },
      {
        key: "members",
        labelKey: "sidebar.members",
        to: "/members",
        icon: Users,
        permissionKey: "members.manage",
        keywords: ["directory", "people"],
      },
      {
        key: "myTeam",
        labelKey: "sidebar.myTeam",
        to: "/my-team",
        icon: UserCircle2,
        requires: "team",
        keywords: ["team", "manager"],
      },
      {
        key: "approvals",
        labelKey: "sidebar.approvals",
        to: "/approvals",
        icon: CheckCircle,
        requires: "team",
        keywords: ["approve", "review"],
      },
    ],
  },
  {
    id: "teamOrg",
    labelKey: "sidebar.groupTeamOrg",
    feature: "core_hr",
    items: [
      {
        key: "departments",
        labelKey: "sidebar.departments",
        to: "/departments",
        icon: Building2,
        permissionKey: "departments.read",
        keywords: ["org", "structure"],
      },
      {
        key: "teams",
        labelKey: "sidebar.teams",
        to: "/teams",
        icon: Users,
        permissionKey: "teams.read",
        keywords: ["groups", "organization"],
      },
      {
        key: "officeLocations",
        labelKey: "sidebar.officeLocations",
        to: "/office-locations",
        icon: MapPin,
        permissionKey: "office_locations.read",
        keywords: ["location", "office"],
      },
      {
        key: "orgStructure",
        labelKey: "sidebar.orgStructure",
        to: "/org-structure",
        icon: Network,
        permissionKey: "employees.read",
        keywords: ["org", "chart", "hierarchy", "structure"],
      },
    ],
  },
  {
    id: "timeAttendance",
    labelKey: "sidebar.groupTimeAttendance",
    feature: "time_attendance",
    items: [
      {
        key: "timeEntries",
        labelKey: "sidebar.timeEntries",
        to: "/time/entries",
        icon: Clock,
        keywords: ["time", "hours", "timesheet"],
      },
      {
        key: "overtime",
        labelKey: "sidebar.overtime",
        to: "/time/overtime",
        icon: TrendingUp,
        keywords: ["ot", "extra"],
      },
      {
        key: "timeApprovals",
        labelKey: "sidebar.timeApprovals",
        to: "/time/approvals",
        icon: CheckCircle,
        requires: "team",
        keywords: ["approvals", "manager"],
      },
      {
        key: "calendar",
        labelKey: "sidebar.calendar",
        to: "/calendar",
        icon: CalendarDays,
        requires: "calendar",
        keywords: ["schedule", "events"],
        children: [
          {
            key: "teamCalendarTime",
            labelKey: "sidebar.teamCalendar",
            to: "/team-calendar",
            icon: CalendarDays,
            requires: "team",
            keywords: ["calendar", "team"],
          },
        ],
      },
    ],
  },
  {
    id: "leave",
    labelKey: "sidebar.leaveAbsence",
    feature: "leave_management",
    items: [
      {
        key: "leaveRequests",
        labelKey: "sidebar.myRequests",
        to: "/leave/requests",
        icon: Calendar,
        keywords: ["leave", "pto", "vacation"],
      },
      {
        key: "leaveApprovals",
        labelKey: "sidebar.leaveApprovals",
        to: "/leave/approvals",
        icon: CheckCircle,
        requires: "team",
        keywords: ["approvals", "manager"],
      },
      {
        key: "leaveTeamCalendar",
        labelKey: "sidebar.teamCalendar",
        to: "/leave/team-calendar",
        icon: CalendarCheck,
        requires: "team",
        keywords: ["calendar", "schedule"],
      },
      {
        key: "leaveReports",
        labelKey: "sidebar.leaveReports",
        to: "/leave/reports",
        icon: BarChart3,
        keywords: ["reports", "analytics"],
      },
      {
        key: "leaveAdmin",
        labelKey: "sidebar.leaveAdmin",
        to: "/leave/admin",
        icon: Settings,
        keywords: ["admin", "config"],
      },
    ],
  },
  {
    id: "communications",
    labelKey: "sidebar.groupCommunications",
    feature: "company_news",
    items: [
      {
        key: "companyNews",
        labelKey: "sidebar.companyNews",
        to: "/news",
        icon: Megaphone,
        permissionKey: "communications.news.read",
        keywords: ["news", "announcements", "communications"],
      },
    ],
  },
  {
    id: "recruiting",
    labelKey: "sidebar.groupRecruiting",
    feature: "recruiting",
    items: [
      {
        key: "jobs",
        labelKey: "sidebar.jobs",
        to: "/recruiting/jobs",
        icon: Briefcase,
        keywords: ["jobs", "postings", "positions"],
      },
      {
        key: "analytics",
        labelKey: "sidebar.analytics",
        to: "/recruiting/analytics",
        icon: TrendingUp,
        keywords: ["stats", "metrics", "reports"],
      },
    ],
  },
  {
    id: "workflows",
    labelKey: "sidebar.groupWorkflows",
    feature: "workflows",
    items: [
      {
        key: "workflows",
        labelKey: "sidebar.workflows",
        to: "/workflows",
        icon: GitBranch,
        keywords: ["automation", "process"],
      },
    ],
  },
  {
    id: "supportAdmin",
    labelKey: "sidebar.groupSupportAdmin",
    items: [
      {
        key: "settings",
        labelKey: "sidebar.settings",
        to: "/settings",
        icon: Settings,
        keywords: ["config", "preferences"],
      },
      {
        key: "featureFlags",
        labelKey: "sidebar.featureFlags",
        to: "/admin/features",
        icon: ShieldCheck,
        superadminOnly: true,
        keywords: ["feature", "flags", "admin"],
      },
      {
        key: "support",
        labelKey: "sidebar.support",
        to: "/support",
        icon: LifeBuoy,
        disabled: true,
        keywords: ["help"],
      },
    ],
  },
];

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
  const communicationsEnabled = useFeatureFlag("company_news", true);
  const navPermissionKeys = React.useMemo(() => {
    const keys = new Set<string>();
    const collect = (items: NavItemConfig[]) => {
      items.forEach((item) => {
        if (item.permissionKey) {
          keys.add(item.permissionKey);
        }
        if (item.children) {
          collect(item.children);
        }
      });
    };
    FEATURE_NAV.forEach((group) => collect(group.items));
    return Array.from(keys);
  }, []);
  const { permissions: navPermissions, loading: navPermissionsLoading } = usePermissions(navPermissionKeys, {
    tenantId: tenant?.id ?? null,
    skip: !tenant?.id || navPermissionKeys.length === 0,
  });

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
        case "company_news":
          return communicationsEnabled;
        default:
          return true;
      }
    },
    [coreHrEnabled, timeEnabled, leaveEnabled, recruitingEnabled, workflowsEnabled, communicationsEnabled]
  );

  type ResolvedNavItem = Omit<NavItemConfig, "children"> & {
    label: string;
    children: ResolvedNavItem[];
  };

  type ResolvedFeatureGroup = Omit<FeatureNavGroup, "items"> & {
    label: string;
    items: ResolvedNavItem[];
  };

  const resolvedGroups = React.useMemo<ResolvedFeatureGroup[]>(() => {
    const mapItem = (item: NavItemConfig): ResolvedNavItem => ({
      ...item,
      label: t(item.labelKey),
      children: item.children ? item.children.map(mapItem) : [],
    });

    return FEATURE_NAV.map((group) => ({
      id: group.id,
      labelKey: group.labelKey,
      feature: group.feature,
      icon: group.icon,
      label: t(group.labelKey),
      items: group.items.map(mapItem),
    }));
  }, [t]);

  const filterItem = React.useCallback(
    (item: ResolvedNavItem): ResolvedNavItem | null => {
      if (item.superadminOnly && !isSuperadmin) return null;
      if (item.feature && !isFeatureEnabled(item.feature)) return null;
      if (
        item.permissionKey &&
        (!tenant?.id || navPermissionsLoading || !(navPermissions[item.permissionKey] ?? false))
      ) {
        return null;
      }
      if (item.requires === "calendar" && !canViewCalendar) return null;
      if (item.requires === "team" && !canManageTeam) return null;

      const children = item.children
        .map((child) => filterItem(child))
        .filter(Boolean) as ResolvedNavItem[];

      return { ...item, children };
    },
    [canManageTeam, canViewCalendar, isFeatureEnabled, isSuperadmin]
  );

  const filteredGroups = React.useMemo<ResolvedFeatureGroup[]>(() => {
    return resolvedGroups
      .map((group) => {
        if (group.feature && !isFeatureEnabled(group.feature)) return null;
        const items = group.items
          .map((item) => filterItem(item))
          .filter(Boolean) as ResolvedNavItem[];
        if (items.length === 0) return null;
        return { ...group, items };
      })
      .filter(Boolean) as ResolvedFeatureGroup[];
  }, [filterItem, isFeatureEnabled, resolvedGroups]);

  const searchableNavItems = React.useMemo<ResolvedNavItem[]>(() => {
    const result: ResolvedNavItem[] = [];
    const walk = (items: ResolvedNavItem[]) => {
      for (const item of items) {
        result.push(item);
        if (item.children.length) {
          walk(item.children);
        }
      }
    };
    filteredGroups.forEach((group) => walk(group.items));
    return result;
  }, [filteredGroups]);

  const filteredNavItems = React.useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return searchableNavItems;
    return searchableNavItems.filter(
      (item) =>
        item.label.toLowerCase().includes(trimmed) ||
        item.to.toLowerCase().includes(trimmed) ||
        item.keywords?.some((kw) => kw.toLowerCase().includes(trimmed))
    );
  }, [searchQuery, searchableNavItems]);

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

  const trimmedSearchQuery = searchQuery.trim();
  const isSearching = showSearch && trimmedSearchQuery.length > 0;

  const handleNavigate = React.useCallback(
    (path: string) => {
      navigate(path);
      if (isMobile) {
        setOpen(false);
      }
      setShowSearch(false);
      setSearchQuery("");
    },
    [isMobile, navigate, setOpen]
  );

  React.useEffect(() => {
    const currentPath = location.pathname;
    setRecentVisits((prev) => {
      const filtered = prev.filter((p) => p !== currentPath);
      return [currentPath, ...filtered].slice(0, 5);
    });
  }, [location.pathname]);

  const toggleGroup = React.useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const renderSubItem = (item: ResolvedNavItem) => {
    if (item.disabled) {
      return (
        <SidebarMenuSubItem key={item.key}>
          <span className="flex h-8 items-center gap-2 rounded-md px-2 text-xs text-sidebar-foreground/50">
            {item.icon ? <item.icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            <span className="truncate">{item.label}</span>
            <span className="ml-auto text-[10px] uppercase">{t("common.soon")}</span>
          </span>
        </SidebarMenuSubItem>
      );
    }

    return (
      <SidebarMenuSubItem key={item.key}>
        <NavLink
          to={item.to}
          className={({ isActive }) =>
            cn(
              "flex h-8 items-center gap-2 rounded-md px-2 text-xs transition-colors",
              isActive
                ? "bg-sidebar-accent/60 text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground"
            )
          }
          onClick={() => handleNavigate(item.to)}
        >
          {item.icon ? <item.icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          <span className="truncate">{item.label}</span>
        </NavLink>
      </SidebarMenuSubItem>
    );
  };

  const renderNavItem = (item: ResolvedNavItem) => {
    const Icon = item.icon;
    const baseClasses = cn(
      "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm transition-colors",
      !open && "justify-center px-2"
    );

    if (item.disabled) {
      return (
        <SidebarMenuItem key={item.key}>
          <span
            aria-disabled="true"
            className={cn(baseClasses, "cursor-not-allowed text-sidebar-foreground/50")}
          >
            {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
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
      <SidebarMenuItem key={item.key}>
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
          {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
          <span className={cn("truncate", !open && "sr-only")}>{item.label}</span>
          {item.badge && item.badge > 0 && open && (
            <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
              {item.badge}
            </Badge>
          )}
        </NavLink>
        {item.children.length > 0 ? (
          <SidebarMenuSub>{item.children.map((child) => renderSubItem(child))}</SidebarMenuSub>
        ) : null}
      </SidebarMenuItem>
    );
  };

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
                    {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
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
                const item = searchableNavItems.find((i) => i.to === path);
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.key}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )
                      }
                      onClick={() => handleNavigate(item.to)}
                    >
                      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        )}

        {!isSearching && (
          <div className="px-2 pb-2">
            {filteredGroups.map((group, index) => {
              const collapsed = collapsedGroups.has(group.id);
              const GroupIcon = group.icon;
              return (
                <div key={group.id} className={cn(index > 0 && "mt-4")}>
                  <button type="button" onClick={() => toggleGroup(group.id)} className="w-full">
                    <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-sidebar-foreground">
                      <span className="flex items-center gap-2">
                        {GroupIcon ? (
                          <GroupIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : null}
                        {group.label}
                      </span>
                      {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </SidebarGroupLabel>
                  </button>
                  {!collapsed && (
                    <SidebarMenu>{group.items.map((item) => renderNavItem(item))}</SidebarMenu>
                  )}
                </div>
              );
            })}
          </div>
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
