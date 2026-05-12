import { useEffect, useRef } from "react";
import { Palette as PaletteIcon, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PALETTES, type PaletteId, applyPalette } from "@/lib/palettes";
import { usePaletteSync } from "@/hooks/usePaletteSync";

export function PaletteSwitcher() {
  const { current, setPalette } = usePaletteSync();

  // Keep a ref of the latest committed palette so hover-restore logic
  // never reads a stale value from a closure (which caused the picked
  // palette to be reverted right after selection).
  const currentRef = useRef<PaletteId>(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const handleSelect = (id: PaletteId) => {
    // Update ref synchronously so the imminent menu-close handler
    // restores to the freshly chosen palette, not the previous one.
    currentRef.current = id;
    void setPalette(id);
  };

  const handleHover = (id: PaletteId) => {
    // Temporarily preview without persisting
    applyPalette(id);
  };

  const handleLeave = () => {
    // Restore the saved/active palette
    applyPalette(currentRef.current);
  };

  // Restore current palette when the menu closes (covers Esc / outside click)
  const handleOpenChange = (open: boolean) => {
    if (!open) applyPalette(currentRef.current);
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          title="Цветовая палитра"
        >
          <PaletteIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onMouseLeave={handleLeave}>
        <DropdownMenuLabel>Цветовая палитра</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PALETTES.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => handleSelect(p.id)}
            onMouseEnter={() => handleHover(p.id)}
            onFocus={() => handleHover(p.id)}
            className="flex items-center gap-3 py-2 cursor-pointer"
          >
            <div className="flex gap-1 flex-shrink-0">
              <span
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: `hsl(${p.swatch.primary})` }}
              />
            </div>
            <div className="flex-1 min-w-0 text-sm font-medium leading-tight">{p.name}</div>
            {current === p.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
