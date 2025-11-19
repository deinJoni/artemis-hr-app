import * as React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Search, Clock, Calendar, UserPlus, FileText, TrendingUp, Users, Settings, Megaphone } from "lucide-react";
import { cn } from "~/lib/utils";
import { useKeyboardShortcuts } from "~/hooks/use-keyboard-shortcuts";

type QuickAction = {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  handler: () => void;
  keywords?: string[];
};

type QuickActionsMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClockInOut?: () => void;
  onRequestTimeOff?: () => void;
  onAddTimeEntry?: () => void;
  onAddEmployee?: () => void;
};

export function QuickActionsMenu({
  open,
  onOpenChange,
  onClockInOut,
  onRequestTimeOff,
  onAddTimeEntry,
  onAddEmployee,
}: QuickActionsMenuProps) {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const actions: QuickAction[] = React.useMemo(() => {
    const baseActions: QuickAction[] = [
      {
        id: "clock-in-out",
        label: "Clock In/Out",
        description: "Start or end your work session",
        icon: Clock,
        category: "Time",
        handler: () => {
          onClockInOut?.();
          onOpenChange(false);
        },
        keywords: ["clock", "time", "in", "out", "start", "end"],
      },
      {
        id: "request-time-off",
        label: "Request Time Off",
        description: "Submit a leave request",
        icon: Calendar,
        category: "Leave",
        handler: () => {
          onRequestTimeOff?.();
          onOpenChange(false);
        },
        keywords: ["leave", "time off", "vacation", "pto", "request"],
      },
      {
        id: "add-time-entry",
        label: "Add Time Entry",
        description: "Manually log work hours",
        icon: Clock,
        category: "Time",
        handler: () => {
          onAddTimeEntry?.();
          onOpenChange(false);
        },
        keywords: ["time", "entry", "log", "hours", "manual"],
      },
      {
        id: "add-employee",
        label: "Add Employee",
        description: "Create a new employee profile",
        icon: UserPlus,
        category: "HR",
        handler: () => {
          onAddEmployee?.();
          onOpenChange(false);
        },
        keywords: ["employee", "add", "create", "new", "onboard"],
      },
      {
        id: "view-time-entries",
        label: "View Time Entries",
        description: "See all your logged hours",
        icon: FileText,
        category: "Time",
        handler: () => {
          navigate("/time/entries");
          onOpenChange(false);
        },
        keywords: ["time", "entries", "hours", "view", "list"],
      },
      {
        id: "view-overtime",
        label: "View Overtime",
        description: "Check overtime requests and status",
        icon: TrendingUp,
        category: "Time",
        handler: () => {
          navigate("/time/overtime");
          onOpenChange(false);
        },
        keywords: ["overtime", "ot", "extra", "hours"],
      },
      {
        id: "view-employees",
        label: "View Employees",
        description: "Browse employee directory",
        icon: Users,
        category: "HR",
        handler: () => {
          navigate("/employees");
          onOpenChange(false);
        },
        keywords: ["employees", "directory", "people", "team"],
      },
      {
        id: "share-announcement",
        label: "Share Announcement",
        description: "Open company news to draft an update",
        icon: Megaphone,
        category: "Communications",
        handler: () => {
          navigate("/news");
          onOpenChange(false);
        },
        keywords: ["news", "announcement", "communications"],
      },
      {
        id: "settings",
        label: "Settings",
        description: "Configure your preferences",
        icon: Settings,
        category: "General",
        handler: () => {
          navigate("/settings");
          onOpenChange(false);
        },
        keywords: ["settings", "preferences", "config", "options"],
      },
    ];

    if (!search.trim()) {
      return baseActions;
    }

    const searchLower = search.toLowerCase();
    return baseActions.filter(
      (action) =>
        action.label.toLowerCase().includes(searchLower) ||
        action.description?.toLowerCase().includes(searchLower) ||
        action.keywords?.some((kw) => kw.toLowerCase().includes(searchLower))
    );
  }, [search, navigate, onClockInOut, onRequestTimeOff, onAddTimeEntry, onAddEmployee, onOpenChange]);

  const categories = React.useMemo(() => {
    const cats = new Set(actions.map((a) => a.category));
    return Array.from(cats);
  }, [actions]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: open,
    shortcuts: [
      {
        key: "k",
        metaKey: true,
        handler: () => {
          onOpenChange(!open);
        },
      },
      {
        key: "Escape",
        handler: () => {
          onOpenChange(false);
        },
      },
      {
        key: "ArrowDown",
        handler: () => {
          setSelectedIndex((prev) => Math.min(prev + 1, actions.length - 1));
        },
      },
      {
        key: "ArrowUp",
        handler: () => {
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        },
      },
      {
        key: "Enter",
        handler: () => {
          if (actions[selectedIndex]) {
            actions[selectedIndex].handler();
          }
        },
      },
    ],
  });

  React.useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  React.useEffect(() => {
    if (open && actions.length > 0) {
      setSelectedIndex(0);
    }
  }, [search, open, actions.length]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actions or type a command..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {actions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No actions found
            </div>
          ) : (
            categories.map((category) => {
              const categoryActions = actions.filter((a) => a.category === category);
              if (categoryActions.length === 0) return null;

              return (
                <div key={category} className="mb-4">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {category}
                  </div>
                  {categoryActions.map((action) => {
                    const actionIndex = actions.indexOf(action);
                    const Icon = action.icon;
                    const isSelected = actionIndex === selectedIndex;

                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={action.handler}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          isSelected ? "bg-accent" : "hover:bg-accent/50"
                        )}
                        onMouseEnter={() => setSelectedIndex(actionIndex)}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{action.label}</div>
                          {action.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {action.description}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border/60 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <span>{actions.length} action{actions.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
