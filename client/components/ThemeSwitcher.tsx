import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { Palette, Moon, Sun, Sparkles } from "lucide-react";

export const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "ai-assistant" as const, label: "AI Assistant", icon: Sparkles },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          title="Switch theme"
        >
          <Palette className="h-4 w-4" />
          <span className="sr-only">Switch theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {themes.map((t) => {
          const IconComponent = t.icon;
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`cursor-pointer ${theme === t.value ? "bg-accent" : ""}`}
            >
              <IconComponent className="mr-2 h-4 w-4" />
              <span>{t.label}</span>
              {theme === t.value && (
                <span className="ml-auto text-xs font-bold">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
