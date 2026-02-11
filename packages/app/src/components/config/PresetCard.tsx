import { Check } from "lucide-react";
import { applyThemeToDOM } from "@/lib/theme";
import type { ThemeConfig } from "@friend/shared";
import { cn } from "@/lib/utils";

interface PresetCardProps {
  theme: ThemeConfig;
  isSelected: boolean;
  onClick: () => void;
}

export function PresetCard({ theme, isSelected, onClick }: PresetCardProps) {
  const colors = theme.colors;

  const handleClick = () => {
    onClick();
    applyThemeToDOM(theme);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "relative p-3 rounded-lg border-2 transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col h-[140px] w-full text-left",
        isSelected
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
          : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50",
      )}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 text-[var(--color-primary)]">
          <Check className="w-4 h-4" />
        </div>
      )}

      <div className="flex-1 flex flex-col space-y-2 w-full min-w-0">
        <div className="flex gap-1 h-4">
          <div
            className="flex-1 rounded-l-sm"
            style={{
              backgroundColor: `oklch(${colors.background.l} ${colors.background.c} ${colors.background.h})`,
            }}
          />
          <div
            className="flex-1"
            style={{ backgroundColor: `oklch(${colors.card.l} ${colors.card.c} ${colors.card.h})` }}
          />
          <div
            className="flex-1"
            style={{
              backgroundColor: `oklch(${colors.muted.l} ${colors.muted.c} ${colors.muted.h})`,
            }}
          />
          <div
            className="flex-1 rounded-r-sm"
            style={{
              backgroundColor: `oklch(${colors.primary.l} ${colors.primary.c} ${colors.primary.h})`,
            }}
          />
        </div>
        <div className="flex gap-1 h-4">
          <div
            className="flex-1 rounded-l-sm"
            style={{
              backgroundColor: `oklch(${colors.foreground.l} ${colors.foreground.c} ${colors.foreground.h})`,
            }}
          />
          <div
            className="flex-1"
            style={{
              backgroundColor: `oklch(${colors.accent.l} ${colors.accent.c} ${colors.accent.h})`,
            }}
          />
          <div
            className="flex-1"
            style={{
              backgroundColor: `oklch(${colors.border.l} ${colors.border.c} ${colors.border.h})`,
            }}
          />
          <div
            className="flex-1 rounded-r-sm"
            style={{
              backgroundColor: `oklch(${colors.sidebar.l} ${colors.sidebar.c} ${colors.sidebar.h})`,
            }}
          />
        </div>

        <div className="pt-2 text-left mt-auto w-full min-w-0">
          <div className="text-sm font-medium text-[var(--color-foreground)] line-clamp-2 leading-tight break-words">
            {theme.name}
          </div>
          <div className="text-xs text-[var(--color-muted-foreground)] capitalize mt-0.5">
            {theme.isBuiltIn ? "Built-in" : "Custom"}
          </div>
        </div>
      </div>
    </button>
  );
}
