/**
 * Worker factory for @pierre/diffs syntax highlighting worker pool.
 * This offloads syntax highlighting to background threads for better performance.
 */
import { WorkerPoolContextProvider } from "@pierre/diffs/react";

// Vite requires this specific pattern for web workers
const workerUrl = new URL("@pierre/diffs/worker", import.meta.url);

export function workerFactory(): Worker {
  return new Worker(workerUrl, { type: "module" });
}

// Pool configuration
export const poolOptions = {
  workerFactory,
  poolSize: 4, // Number of workers
};

// Highlighter configuration
export const highlighterOptions = {
  theme: "pierre-dark" as const,
};

export { WorkerPoolContextProvider };
