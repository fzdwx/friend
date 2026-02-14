import { Server, Palette, Sparkles, Bot, Brain, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type SettingsSection = "agents" | "appearance" | "providers" | "memory" | "skills" | "subagents";

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  const { t } = useTranslation();
  
  const SECTIONS: { id: SettingsSection; labelKey: string; icon: React.ElementType }[] = [
    { id: "agents", labelKey: "settings.sections.agents", icon: Bot },
    { id: "appearance", labelKey: "settings.sections.appearance", icon: Palette },
    { id: "providers", labelKey: "settings.sections.providers", icon: Server },
    { id: "subagents", labelKey: "settings.sections.subagents", icon: Users },
    { id: "memory", labelKey: "settings.sections.memory", icon: Brain },
    { id: "skills", labelKey: "settings.sections.skills", icon: Sparkles },
  ];

  return (
    <div className="w-48 flex-shrink-0 border-r border-border bg-card">
      <div className="p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("settings.title")}
        </h3>
      </div>

      <nav className="px-2 py-1 space-y-0.5">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t(section.labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
