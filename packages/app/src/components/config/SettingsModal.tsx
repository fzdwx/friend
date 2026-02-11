import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SettingsSidebar } from "@/components/config/SettingsSidebar";
import { ProvidersContent } from "@/components/config/ProvidersContent";
import { AppearanceContent } from "@/components/config/AppearanceContent";
import { useConfigStore } from "@/stores/configStore";

const SECTION_TITLES: Record<"providers" | "appearance", string> = {
  providers: "Providers",
  appearance: "Appearance",
};

export function SettingsModal() {
  const isSettingsOpen = useConfigStore((s) => s.isSettingsOpen);
  const setIsSettingsOpen = useConfigStore((s) => s.setIsSettingsOpen);
  const [activeSection, setActiveSection] = useState<"providers" | "appearance">("appearance");

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
          {activeSection === "providers" && <ProvidersContent />}
          {activeSection === "appearance" && <AppearanceContent />}
        </div>
      </div>
    </Modal>
  );
}
