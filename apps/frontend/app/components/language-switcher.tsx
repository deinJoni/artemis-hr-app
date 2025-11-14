import { Check, Languages } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useTranslation } from "~/lib/i18n";
import { i18n } from "~/lib/i18n";

const languages = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
] as const;

export function LanguageSwitcher() {
  const { i18n: i18nInstance } = useTranslation();
  const currentLanguage = i18nInstance.language || "en";

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Change language">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>Language</DropdownMenuLabel>
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
          >
            <Check
              className={`mr-2 h-4 w-4 ${
                currentLanguage === lang.code ? "opacity-100" : "opacity-0"
              }`}
            />
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

