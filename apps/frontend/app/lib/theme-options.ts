import appCssRaw from "../app.css?raw"

const FALLBACK_THEMES = ["light", "dark"] as const

function parseThemes(css: string): string[] {
  const themes = new Set<string>()

  if (/:root\s*\{[\s\S]*?--background\s*:/m.test(css)) {
    themes.add("light")
  }

  const classRegex =
    /(?:^|})\s*\.([A-Za-z0-9_-]+)[^{]*\{[\s\S]*?--background\s*:[\s\S]*?\}/gm

  let match: RegExpExecArray | null
  while ((match = classRegex.exec(css)) !== null) {
    themes.add(match[1])
  }

  const prioritized = new Map<string, number>([
    ["light", 0],
    ["dark", 1],
  ])

  return Array.from(themes).sort((a, b) => {
    const priorityA = prioritized.get(a) ?? Number.POSITIVE_INFINITY
    const priorityB = prioritized.get(b) ?? Number.POSITIVE_INFINITY

    if (priorityA !== priorityB) return priorityA - priorityB
    return a.localeCompare(b)
  })
}

const parsedThemes = (() => {
  try {
    return parseThemes(appCssRaw)
  } catch {
    return []
  }
})()

export const APP_THEME_OPTIONS: readonly string[] = Object.freeze(
  parsedThemes.length > 0 ? parsedThemes : [...FALLBACK_THEMES],
)

export const DEFAULT_THEME = APP_THEME_OPTIONS[0] ?? "light"

export function formatThemeName(theme: string) {
  return theme
    .split(/[-_]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}
