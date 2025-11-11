import * as React from "react";
import { cn } from "~/lib/utils";

type BentoGridProps = {
  children: React.ReactNode;
  className?: string;
};

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6",
        "sm:grid-cols-2",
        "lg:grid-cols-3",
        "xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

type BentoCardProps = {
  children: React.ReactNode;
  className?: string;
  span?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2;
  onClick?: () => void;
};

export function BentoCard({ 
  children, 
  className, 
  span = 1, 
  rowSpan = 1,
  onClick 
}: BentoCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/70 p-6 shadow-sm backdrop-blur-sm transition-all duration-300",
        "hover:shadow-md hover:border-primary/20",
        onClick && "cursor-pointer hover:scale-[1.02]",
        span === 2 && "sm:col-span-2",
        span === 3 && "sm:col-span-2 lg:col-span-3",
        span === 4 && "sm:col-span-2 lg:col-span-3 xl:col-span-4",
        rowSpan === 2 && "sm:row-span-2",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

