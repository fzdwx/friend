import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SettingsSidebar } from "@/components/config/SettingsSidebar";
import { AgentsContent } from "@/components/config/AgentsContent";
import { ProvidersContent } from "@/components/config/ProvidersContent";
import { AppearanceContent } from "@/components/config/AppearanceContent";
import { SkillsContent } from "@/components/config/SkillsContent";
import { MemoryContent } from "@/components/config/MemoryContent";
import { useConfigStore } from "@/stores/configStore";

type SettingsSection = "agents" | "providers" | "memory" | "appearance" | "skills";

const SECTION_TITLES: Record<SettingsSection, string> = {
  agents: "Agents",
  providers: "Providers",
  memory: "Memory",
  appearance: "Appearance",
  skills: "Skills",
};

export function SettingsModal() {
  const isSettingsOpen = useConfigStore((s) => s.isSettingsOpen);
  const setIsSettingsOpen = useConfigStore((s) => s.setIsSettingsOpen);
  const [activeSection, setActiveSection] = useState<SettingsSection>("agents");

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      title={SECTION_TITLES[activeSection]}
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
        </div>
      </div>
    </Modal>
  );
}
