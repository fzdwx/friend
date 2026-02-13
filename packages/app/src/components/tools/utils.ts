/**
 * Shorten a file path for display.
 * Keeps the filename and last few directory segments.
 * 
 * @example
 * shortenPath("/home/user/projects/myapp/src/components/Button.tsx")
 * // → ".../src/components/Button.tsx"
 */
export function shortenPath(path: string, maxSegments = 3): string {
  if (!path) return "";
  
  // Normalize path separators
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  
  // If path is short enough, return as-is
  if (segments.length <= maxSegments + 1) {
    return path;
  }
  
  // Keep last N segments
  const lastSegments = segments.slice(-maxSegments);
  return ".../" + lastSegments.join("/");
}

/**
 * Get file name from path.
 */
export function getFileName(path: string): string {
  if (!path) return "";
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] || path;
}
