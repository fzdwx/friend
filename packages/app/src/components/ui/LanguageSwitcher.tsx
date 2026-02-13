/**
 * LanguageSwitcher Component
 *
 * Allows users to switch between supported languages.
 * Persists choice to localStorage via i18next-browser-languagedetector.
 */

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { supportedLanguages, type SupportedLanguage } from "@/i18n";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLang = supportedLanguages.find((l) => l.code === i18n.language) || supportedLanguages[0];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = async (langCode: SupportedLanguage) => {
    await i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{currentLang.nativeName}</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-1 left-0 z-50 min-w-[120px] py-1 bg-popover border border-border rounded-md shadow-md">
          {supportedLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={cn(
                "w-full px-3 py-1.5 text-xs text-left hover:bg-accent/50 transition-colors",
                i18n.language === lang.code
                  ? "text-primary font-medium"
                  : "text-popover-foreground",
              )}
            >
              <span className="flex items-center justify-between">
                <span>{lang.nativeName}</span>
                <span className="text-muted-foreground text-[10px] ml-2">{lang.name}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
