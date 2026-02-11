export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export async function selectDirectory(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }

  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
    });

    return selected as string | null;
  } catch (error) {
    console.error("Failed to open directory picker:", error);
    return null;
  }
}
