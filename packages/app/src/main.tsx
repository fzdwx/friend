import "@/styles/globals.css";
import "@/components/tools/registry/renderers";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useConfigStore } from "./stores/configStore";
import { applyThemeToDOM } from "./lib/theme";

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
    <App />
  </StrictMode>,
);
