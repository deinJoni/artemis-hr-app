import * as React from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeft } from "lucide-react";
import { cn } from "~/lib/utils";

type SidebarContextValue = {
  open: boolean;
  isMobile: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggle: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

type SidebarProviderProps = {
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function SidebarProvider({ defaultOpen = true, children }: SidebarProviderProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 1024px)");

    const update = (matches: boolean) => {
      setIsMobile(matches);
      if (matches) {
        setOpen(false);
      } else if (defaultOpen) {
        setOpen(true);
      }
    };

    update(query.matches);

    const listener = (event: MediaQueryListEvent) => {
      update(event.matches);
    };

    query.addEventListener("change", listener);
    return () => {
      query.removeEventListener("change", listener);
    };
  }, [defaultOpen]);

  const toggle = React.useCallback(() => {
    setOpen((current) => !current);
  }, []);

  const value = React.useMemo(
    () => ({
      open,
      isMobile,
      setOpen,
      toggle,
    }),
    [open, isMobile, toggle]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

type SidebarProps = React.ComponentPropsWithoutRef<"aside"> & {
  collapsible?: boolean;
  collapsedWidth?: number;
  expandedWidth?: number;
};

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      className,
      children,
      collapsible = true,
      collapsedWidth = 72,
      expandedWidth = 280,
      ...props
    },
    ref
  ) => {
    const { open, isMobile, setOpen } = useSidebar();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    const width = open || !collapsible ? expandedWidth : collapsedWidth;

    return (
      <>
        <aside
          ref={ref}
          data-state={open ? "open" : "collapsed"}
          className={cn(
            "group/sidebar relative z-40 flex h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-300 ease-in-out lg:h-auto",
            isMobile
              ? "fixed inset-y-0 left-0 w-[--sidebar-width] bg-sidebar shadow-lg"
              : "static",
            !isMobile && collapsible ? "w-[--sidebar-width]" : "",
            isMobile && !open ? "-translate-x-full" : "translate-x-0",
            className
          )}
          style={
            {
              "--sidebar-width": `${width}px`,
            } as React.CSSProperties
          }
          {...props}
        >
          {children}
        </aside>
        {mounted && isMobile && open
          ? createPortal(
              <button
                type="button"
                aria-label="Close sidebar overlay"
                className="fixed inset-0 z-30 bg-black/40 lg:hidden"
                onClick={() => setOpen(false)}
              />,
              document.body
            )
          : null}
      </>
    );
  }
);
Sidebar.displayName = "Sidebar";

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4", className)}
      {...props}
    />
  )
);
SidebarContent.displayName = "SidebarContent";

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center gap-2 px-3 py-2 text-sm font-semibold", className)}
      {...props}
    />
  )
);
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mt-auto px-3 py-4", className)} {...props} />
  )
);
SidebarFooter.displayName = "SidebarFooter";

const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex min-h-dvh w-full flex-1 flex-col bg-background lg:min-h-screen",
        className
      )}
      {...props}
    />
  )
);
SidebarInset.displayName = "SidebarInset";

const SidebarMenu = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"nav">>(
  ({ className, ...props }, ref) => (
    <nav
      ref={ref}
      className={cn("flex flex-1 flex-col gap-1 text-sm font-medium", className)}
      {...props}
    />
  )
);
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center", className)} {...props} />
  )
);
SidebarMenuItem.displayName = "SidebarMenuItem";

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & { isActive?: boolean; asChild?: boolean }
>(({ className, isActive = false, asChild = false, ...props }, ref) => {
  const { open } = useSidebar();
  const Comp = asChild ? Slot : "button";
  const componentProps = asChild
    ? props
    : ({
        type: "button",
        ...props,
      } as React.ComponentPropsWithoutRef<"button">);

  return (
    <Comp
      ref={ref}
      data-active={isActive ? "true" : undefined}
      data-collapsed={open ? undefined : "true"}
      className={cn(
        "inline-flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[collapsed=true]:justify-center",
        className
      )}
      {...componentProps}
    />
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarGroupLabel = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => {
  const { open } = useSidebar();
  return (
    <span
      ref={ref}
      data-collapsed={open ? undefined : "true"}
      className={cn(
        "px-3 text-xs font-semibold text-sidebar-foreground/60 data-[collapsed=true]:sr-only",
        className
      )}
      {...props}
    />
  );
});
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button">
>(({ className, onClick, ...props }, ref) => {
  const { toggle } = useSidebar();

  return (
    <button
      ref={ref}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          toggle();
        }
      }}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        className
      )}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle sidebar</span>
    </button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
};
