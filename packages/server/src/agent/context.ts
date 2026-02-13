import {readFile} from "node:fs/promises";
import {join} from "node:path";

const WORKSPACE_FILES = [
    "SOUL.md",
    "IDENTITY.md",
    "USER.md",
    "TOOLS.md",
    "HEARTBEAT.md",
    "BOOTSTRAP.md",
    "MEMORY.md",
] as const;

export type WorkspaceFile = { path: string; content: string };

export async function loadWorkspaceFiles(cwd: string): Promise<WorkspaceFile[]> {
    const friendDir = join(cwd, ".friend");
    const results: WorkspaceFile[] = [];
    for (const name of WORKSPACE_FILES) {
        try {
            let path = join(friendDir, name);
            const content = await readFile(path, "utf-8");
            if (content.trim()) {
                results.push({path, content});
            }
        } catch {
        }
    }
    return results;
}

/** Build system prompt section from workspace files*/
export function buildWorkspacePrompt(cwd:string,files: WorkspaceFile[]): string {
    const lines: string[] = [
        "You are a personal assistant running inside Friend.",
        "",
    ];

    if (files.length === 0) return lines.join("\n");

    lines.push(...[
        "## Workspace",
        `Your working directory is: ${cwd}`,
        "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
    ])

    const hasSoul = files.some((f) => f.path.toLowerCase() === "soul.md");
    if (hasSoul) {
        lines.push(
            "If SOUL.md is present, embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it.",
        );
    }
    lines.push("");

    for (const file of files) {
        lines.push("---")
        lines.push(`## ${file.path}`, "", file.content, "");
        lines.push("---")
    }

    return lines.join("\n");
}
