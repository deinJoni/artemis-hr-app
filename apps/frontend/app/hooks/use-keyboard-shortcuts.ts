import * as React from "react";

type ShortcutConfig = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
};

type UseKeyboardShortcutsOptions = {
  enabled?: boolean;
  shortcuts: ShortcutConfig[];
};

export function useKeyboardShortcuts({
  enabled = true,
  shortcuts,
}: UseKeyboardShortcutsOptions) {
  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
        const requiresCtrl = shortcut.ctrlKey ?? false;
        const requiresMeta = shortcut.metaKey ?? false;
        const effectiveMetaRequired = requiresMeta && isMac;
        const effectiveCtrlRequired = requiresCtrl || (requiresMeta && !isMac);

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = effectiveCtrlRequired ? e.ctrlKey : !e.ctrlKey;
        const metaMatch = effectiveMetaRequired ? e.metaKey : !e.metaKey;
        const shiftMatch = shortcut.shiftKey === undefined ? true : e.shiftKey === shortcut.shiftKey;
        const altMatch = shortcut.altKey === undefined ? true : e.altKey === shortcut.altKey;

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.handler(e);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, shortcuts]);
}

type GlobalShortcutRegistry = {
  [key: string]: {
    handler: (e: KeyboardEvent) => void;
    description: string;
    category?: string;
  };
};

const globalRegistry: GlobalShortcutRegistry = {};

export function registerGlobalShortcut(
  key: string,
  config: {
    handler: (e: KeyboardEvent) => void;
    description: string;
    category?: string;
  }
) {
  globalRegistry[key] = config;
}

export function unregisterGlobalShortcut(key: string) {
  delete globalRegistry[key];
}

export function getGlobalShortcuts() {
  return globalRegistry;
}
