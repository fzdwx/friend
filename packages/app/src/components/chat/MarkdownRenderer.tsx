import { memo, useState, useCallback, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { File, type FileContents } from "@pierre/diffs/react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/configStore";
import { FileIcon } from "@/components/ui/FileIcon";

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
  node?: { data?: { meta?: string | null } };
}

// Map common language names to file extensions
const langToExt: Record<string, string> = {
  js: "js",
  javascript: "js",
  ts: "ts",
  typescript: "ts",
  jsx: "jsx",
  tsx: "tsx",
  py: "py",
  python: "py",
  rb: "rb",
  ruby: "rb",
  go: "go",
  rs: "rs",
  rust: "rs",
  java: "java",
  kt: "kt",
  kotlin: "kt",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  cs: "cs",
  csharp: "cs",
  php: "php",
  lua: "lua",
  r: "r",
  sql: "sql",
  sh: "sh",
  bash: "sh",
  shell: "sh",
  zsh: "zsh",
  fish: "fish",
  ps1: "ps1",
  powershell: "ps1",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  html: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  md: "md",
  markdown: "md",
  dockerfile: "dockerfile",
  makefile: "makefile",
  vim: "vim",
  vimscript: "vim",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  graphql: "graphql",
  gql: "graphql",
  prisma: "prisma",
  dotenv: "env",
  env: "env",
};

function CodeBlock({ className, children, node }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const activeThemeId = useConfigStore((s) => s.activeThemeId);

  // Parse language and filename from className
  // Supports: `language-tsx`, `language-tsx:App.tsx`, or meta from node
  const match = /language-(\w+)(?::([^\s]+))?/.exec(className || "");
  const language = match ? match[1].toLowerCase() : "";
  const metaFilename = match?.[2];

  // Try to get filename from meta string (e.g. ```tsx filename="App.tsx")
  const meta = (node as { data?: { meta?: string } })?.data?.meta;
  const metaMatch = meta?.match(/filename=["']?([^"'\s]+)["']?/);
  const filename = metaFilename || metaMatch?.[1];

  const code = String(children).replace(/\n$/, "");

  // Determine theme for code highlighting
  const isDark = activeThemeId.includes("dark");
  const diffsTheme = isDark ? "pierre-dark" : "pierre-light";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  // Inline code (no language specified and short)
  if (!language && code.length < 100 && !code.includes("\n")) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-muted/50 text-primary font-mono text-xs">
        {children}
      </code>
    );
  }

  // Use @pierre/diffs File component for syntax highlighting
  const ext = langToExt[language] || language || "txt";
  // Use provided filename or generate from language
  const displayFilename = filename || `code.${ext}`;

  const file: FileContents = useMemo(
    () => ({
      name: displayFilename,
      contents: code,
    }),
    [displayFilename, code],
  );

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-border">
      {/* Header with filename and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <FileIcon filename={displayFilename} size={14} />
          <span className="text-xs text-muted-foreground font-mono">
            {displayFilename}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted"
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code block - let @pierre/diffs handle its own background */}
      <div className="[&_[data-diffs]]:rounded-none [&_[data-diffs]]:border-none [&_[data-code]]:p-4">
        <File
          file={file}
          options={{
            disableFileHeader:true,
            theme: { dark: "pierre-dark", light: "pierre-light" },
            themeType: isDark ? "dark" : "light",
          }}
        />
      </div>
    </div>
  );
}

function Table({ children }: { children?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full text-sm border-collapse rounded-lg border border-border">
        {children}
      </table>
    </div>
  );
}

function Tr({ children }: { children?: React.ReactNode }) {
  return <tr className="border-b border-border last:border-b-0">{children}</tr>;
}

function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-4 py-2 border border-border">{children}</td>;
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 bg-muted/30 font-medium text-left border border-border">
      {children}
    </th>
  );
}

function Checkbox({ checked }: { checked?: boolean }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled
      className="w-4 h-4 rounded border-border bg-background accent-primary cursor-not-allowed"
    />
  );
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  children,
  className,
}: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "text-sm max-w-none break-words",
        "[&_p]:leading-relaxed [&_p]:my-2",
        "[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4",
        "[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2",
        "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]} components={{
          code: CodeBlock,
          table: Table,
          tr: Tr,
          td: Td,
          th: Th,
          input: (props) => {
            if (props.type === "checkbox") {
              return <Checkbox checked={props.checked} />;
            }
            return <input {...props} />;
          },
        }}
      >
        {children}
      </Markdown>
    </div>
  );
});
