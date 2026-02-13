/**
 * Resolve user path with ~ expansion
 */
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

export function resolveUserPath(path: string): string {
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return path;
}
