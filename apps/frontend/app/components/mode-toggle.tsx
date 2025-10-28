import { Check, Moon, Sun } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useTheme } from "~/hooks/use-theme"
import { APP_THEME_OPTIONS, formatThemeName } from "~/lib/theme-options"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Check className={`mr-2 h-4 w-4 ${theme === "system" ? "opacity-100" : "opacity-0"}`} />
          System
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {APP_THEME_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt} onClick={() => setTheme(opt)}>
            <Check className={`mr-2 h-4 w-4 ${theme === opt ? "opacity-100" : "opacity-0"}`} />
            {formatThemeName(opt)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


