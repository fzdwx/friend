/**
 * Worker factory for @pierre/diffs syntax highlighting worker pool.
 * This offloads syntax highlighting to background threads for better performance.
 */
import { useEffect } from "react";
import { WorkerPoolContextProvider, useWorkerPool } from "@pierre/diffs/react";
import { useConfigStore } from "@/stores/configStore";

// Vite requires ?url suffix to get the URL to the worker module
// Use the portable worker which is self-contained
// @ts-expect-error Vite url import
import WorkerUrl from "@pierre/diffs/worker/worker-portable.js?url";

export function workerFactory(): Worker {
  return new Worker(WorkerUrl, { type: "module" });
}

// Pool configuration
export const poolOptions = {
  workerFactory,
  poolSize: 4, // Number of workers
};

/**
 * Syncs the worker pool theme with the app theme.
 * Must be used inside WorkerPoolContextProvider.
 */
export function DiffThemeSync() {
  const workerPool = useWorkerPool();
  const activeThemeId = useConfigStore((s) => s.activeThemeId);

  useEffect(() => {
    if (!workerPool) return;

    // Determine if dark or light theme based on theme ID
    const isDark = activeThemeId.includes("dark");
    const theme = isDark ? "pierre-dark" : "pierre-light";

    workerPool.setRenderOptions({ theme }).catch((err) => {
      console.error("Failed to update worker pool theme:", err);
    });
  }, [workerPool, activeThemeId]);

  return null;
}

export { WorkerPoolContextProvider };
