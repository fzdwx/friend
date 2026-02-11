interface FileReadProps {
  filePath: string;
  content: string;
}

export function FileRead({ filePath, content }: FileReadProps) {
  const lines = content.split("\n");
  const lineCount = lines.length;

  return (
    <div className="text-[11px] font-mono">
      <div className="px-3 py-1 bg-secondary/50 text-muted-foreground border-b border-border/50 flex justify-between">
        <span>{filePath}</span>
        <span>{lineCount} lines</span>
      </div>
      <pre className="p-3 whitespace-pre-wrap break-all leading-relaxed text-muted-foreground max-h-48 overflow-y-auto">
        {content.slice(0, 3000)}
        {content.length > 3000 && "\n... (truncated)"}
      </pre>
    </div>
  );
}
