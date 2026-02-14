import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SettingsSidebar } from "@/components/config/SettingsSidebar";
import { AgentsContent } from "@/components/config/AgentsContent";
import { ProvidersContent } from "@/components/config/ProvidersContent";
import { AppearanceContent } from "@/components/config/AppearanceContent";
import { SkillsContent } from "@/components/config/SkillsContent";
import { MemoryContent } from "@/components/config/MemoryContent";
import { SubagentsContent } from "@/components/config/SubagentsContent";
import { useConfigStore } from "@/stores/configStore";
import { useTranslation } from "react-i18next";

type SettingsSection = "agents" | "providers" | "memory" | "appearance" | "skills" | "subagents";

export function SettingsModal() {
  const { t } = useTranslation();
  const isSettingsOpen = useConfigStore((s) => s.isSettingsOpen);
  const setIsSettingsOpen = useConfigStore((s) => s.setIsSettingsOpen);
  const [activeSection, setActiveSection] = useState<SettingsSection>("agents");

  const getSectionTitle = (section: SettingsSection): string => {
    const keyMap: Record<SettingsSection, string> = {
      agents: "settings.sections.agents",
      providers: "settings.sections.providers",
      memory: "settings.sections.memory",
      appearance: "settings.sections.appearance",
      skills: "settings.sections.skills",
      subagents: "settings.sections.subagents",
    };
    return t(keyMap[section]);
  };

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      title={getSectionTitle(activeSection)}
      size="xl"
    >
      <div className="flex h-[600px]">
        <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <div className="flex-1 overflow-y-auto">
          {activeSection === "agents" && <AgentsContent />}
          {activeSection === "providers" && <ProvidersContent />}
          {activeSection === "memory" && <MemoryContent />}
          {activeSection === "appearance" && <AppearanceContent />}
          {activeSection === "skills" && <SkillsContent />}
          {activeSection === "subagents" && <SubagentsContent />}
        </div>
      </div>
    </Modal>
  );
}
