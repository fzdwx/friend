import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SettingsSidebar } from "@/components/config/SettingsSidebar";
import { ProvidersContent } from "@/components/config/ProvidersContent";
import { useConfigStore } from "@/stores/configStore";

export function SettingsModal() {
  const isSettingsOpen = useConfigStore((s) => s.isSettingsOpen);
  const setIsSettingsOpen = useConfigStore((s) => s.setIsSettingsOpen);
  const [activeSection, setActiveSection] = useState<"providers">("providers");

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      title="Settings"
      size="xl"
    >
      <div className="flex h-[600px]">
        <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <div className="flex-1">{activeSection === "providers" && <ProvidersContent />}</div>
      </div>
    </Modal>
  );
}
