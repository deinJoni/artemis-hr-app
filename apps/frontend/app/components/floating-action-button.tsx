import * as React from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Plus, Clock, Calendar, UserPlus } from "lucide-react";
import { cn } from "~/lib/utils";

type FloatingActionButtonProps = {
  onClockInOut?: () => void;
  onRequestTimeOff?: () => void;
  onAddTimeEntry?: () => void;
  onAddEmployee?: () => void;
  className?: string;
};

export function FloatingActionButton({
  onClockInOut,
  onRequestTimeOff,
  onAddTimeEntry,
  onAddEmployee,
  className,
}: FloatingActionButtonProps) {
  const [open, setOpen] = React.useState(false);

  const actions = [
    {
      label: "Clock In/Out",
      icon: Clock,
      onClick: onClockInOut,
      shortcut: "C",
    },
    {
      label: "Request Time Off",
      icon: Calendar,
      onClick: onRequestTimeOff,
      shortcut: "L",
    },
    {
      label: "Add Time Entry",
      icon: Clock,
      onClick: onAddTimeEntry,
      shortcut: "T",
    },
    {
      label: "Add Employee",
      icon: UserPlus,
      onClick: onAddEmployee,
      shortcut: "E",
    },
  ].filter((action) => action.onClick);

  if (actions.length === 0) return null;

  return (
    <div className={cn("fixed bottom-6 right-6 z-50 hidden sm:block", className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full bg-primary shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all duration-300"
            aria-label="Quick actions"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="top"
          className="mb-2 w-56 rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-lg"
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={action.label}
                onClick={() => {
                  action.onClick?.();
                  setOpen(false);
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer focus:bg-accent"
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{action.label}</span>
                {action.shortcut && (
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    {action.shortcut}
                  </kbd>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
