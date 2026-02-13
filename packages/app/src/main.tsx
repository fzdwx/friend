import "@/styles/globals.css";
import "@/components/tools/registry/renderers";
import "@/i18n"; // Initialize i18n
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useConfigStore } from "./stores/configStore";
import { applyThemeToDOM } from "./lib/theme";
import {
  WorkerPoolContextProvider,
  poolOptions,
  DiffThemeSync,
} from "./lib/diffsWorker";

function applyThemeBeforeRender() {
  const store = useConfigStore.getState();
  const theme = store.getActiveTheme();

  if (theme) {
    applyThemeToDOM(theme);
  }
}

applyThemeBeforeRender();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorkerPoolContextProvider
      poolOptions={poolOptions}
      highlighterOptions={{ theme: "pierre-dark" }}
    >
      <DiffThemeSync />
      <App />
    </WorkerPoolContextProvider>
  </StrictMode>,
);
