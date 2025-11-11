import * as React from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

type ToastType = "success" | "error" | "info" | "warning";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = React.useCallback((
    message: string,
    type: ToastType = "info",
    options?: { duration?: number; action?: { label: string; onClick: () => void } }
  ) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = {
      id,
      message,
      type,
      duration: options?.duration ?? 5000,
      action: options?.action,
    };

    setToasts((prev) => [...prev, toast]);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toast.duration);
    }
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case "info":
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getBgColor = (type: ToastType) => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900";
      case "error":
        return "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900";
      case "warning":
        return "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900";
      case "info":
      default:
        return "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm sm:max-w-md">
            {toasts.map((toast, index) => (
              <div
                key={toast.id}
                className={cn(
                  "rounded-lg border p-4 shadow-lg backdrop-blur-sm flex items-start gap-3 toast-enter",
                  getBgColor(toast.type)
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {getIcon(toast.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{toast.message}</p>
                  {toast.action && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        toast.action?.onClick();
                        removeToast(toast.id);
                      }}
                      className="h-auto p-0 mt-1 text-xs"
                    >
                      {toast.action.label}
                    </Button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="rounded-md p-1 hover:bg-black/5 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

