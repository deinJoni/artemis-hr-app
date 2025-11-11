import * as React from "react";
import { Link } from "react-router";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { formatThemeName } from "~/lib/theme-options";

type DashboardCenteredStateProps = {
  message: string;
  ariaLabel: string;
};

export function DashboardCenteredState({ message, ariaLabel }: DashboardCenteredStateProps) {
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

export function DashboardErrorState({ message }: DashboardErrorStateProps) {
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

export function DashboardThemeSelector({
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
