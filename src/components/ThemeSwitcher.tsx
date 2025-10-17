import { Moon, Sun, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/useTheme";

export function ThemeSwitcher() {
  const { theme, colorScheme, setTheme, setColorScheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Theme Mode
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
          {theme === "light" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
          {theme === "dark" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Palette className="mr-2 h-4 w-4" />
          System
          {theme === "system" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Color Scheme
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setColorScheme("default")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-primary" />
          Default (Green & Gold)
          {colorScheme === "default" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorScheme("ocean")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
          Ocean Blue
          {colorScheme === "ocean" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorScheme("sunset")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500" />
          Sunset
          {colorScheme === "sunset" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorScheme("forest")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600" />
          Forest Green
          {colorScheme === "forest" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorScheme("royal")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600" />
          Royal Purple
          {colorScheme === "royal" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
