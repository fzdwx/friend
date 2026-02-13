import { Server, Palette, Sparkles, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsSection = "agents" | "appearance" | "providers" | "skills";

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

const SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: "agents", label: "Agents", icon: Bot },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "providers", label: "Provider", icon: Server },
  { id: "skills", label: "Skills", icon: Sparkles },
];

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <div className="w-48 flex-shrink-0 border-r border-border bg-card">
      <div className="p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Settings
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
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
