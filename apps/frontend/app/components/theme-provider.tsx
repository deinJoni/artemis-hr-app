import { createContext, useEffect, useLayoutEffect, useState } from "react"
import { APP_THEME_OPTIONS, DEFAULT_THEME } from "~/lib/theme-options"

type Theme = "system" | string

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const THEME_SET = new Set(APP_THEME_OPTIONS)

const sanitizeTheme = (value: string | null | undefined, fallback: Theme): Theme => {
  if (!value) return fallback
  if (value === "system") return "system"
  if (THEME_SET.has(value)) return value
  return fallback === "system" ? "system" : DEFAULT_THEME
}

const resolveSystemTheme = () => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  if (prefersDark && THEME_SET.has("dark")) return "dark"
  if (THEME_SET.has("light")) return "light"
  return APP_THEME_OPTIONS[0] ?? "light"
}

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => sanitizeTheme(defaultTheme, defaultTheme))

  // Hydrate from localStorage on client
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined"
        ? (window.localStorage.getItem(storageKey) as Theme | null)
        : null
      if (stored) setTheme(sanitizeTheme(stored, defaultTheme))
    } catch {
      // ignore
    }
  }, [storageKey, defaultTheme])

  useLayoutEffect(() => {
    const root = window.document.documentElement

    // Remove all known theme classes before applying the new one
    root.classList.remove(...APP_THEME_OPTIONS)

    const applyDarkMarkerIfNeeded = (value: string) => {
      if (value === "dark" || value.endsWith("-dark")) {
        root.classList.add("dark")
      }
    }

    if (theme === "system") {
      const systemTheme = resolveSystemTheme()
      root.classList.add(systemTheme)
      applyDarkMarkerIfNeeded(systemTheme)
      return
    }

    const resolved = THEME_SET.has(theme) ? theme : APP_THEME_OPTIONS[0]
    if (resolved) {
      root.classList.add(resolved)
      applyDarkMarkerIfNeeded(resolved)
    }
  }, [theme])

  const value = {
    theme,
    setTheme: (next: Theme) => {
      const target = sanitizeTheme(next, defaultTheme)
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, target)
        }
      } catch {
        // ignore
      }
      setTheme(target)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
