import { useState } from "react";
import { hexToOklch, oklchToHex } from "@/lib/theme";
import type { ColorDefinition } from "@friend/shared";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: ColorDefinition;
  onChange: (color: ColorDefinition) => void;
  label?: string;
  className?: string;
}

export function ColorPicker({ value, onChange, label, className }: ColorPickerProps) {
  const hexValue = oklchToHex(value);
  const [hexInput, setHexInput] = useState(hexValue);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value;
    setHexInput(newHex);

    if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
      try {
        const oklchColor = hexToOklch(newHex);
        onChange(oklchColor);
      } catch {}
    }
  };

  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value;
    setHexInput(newHex);
    const oklchColor = hexToOklch(newHex);
    onChange(oklchColor);
  };

  const colorPreviewStyle = {
    backgroundColor: `oklch(${value.l} ${value.c} ${value.h})`,
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <label className="text-sm text-[var(--color-muted-foreground)]">{label}</label>}
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={hexValue}
          onChange={handleNativeColorChange}
          className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
          style={colorPreviewStyle}
        />
        <input
          type="text"
          value={hexInput}
          onChange={handleHexChange}
          placeholder="#000000"
          className="flex-1 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] uppercase font-mono"
        />
      </div>
    </div>
  );
}
