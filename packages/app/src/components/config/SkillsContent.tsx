import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import type { SkillInfo, SkillPaths } from "@friend/shared";
import {
  RefreshCw,
  FolderOpen,
  BookOpen,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface SkillGroup {
  title: string;
  type: "global" | "agent";
  agentId?: string;
  path: string;
  skills: SkillInfo[];
}

export function SkillsContent() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [paths, setPaths] = useState<SkillPaths | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = async () => {
    try {
      setError(null);
      const [skillsRes, pathsRes] = await Promise.all([api.getSkills(), api.getSkillPaths()]);

      if (skillsRes.ok && skillsRes.data) {
        setSkills(skillsRes.data);
      }
      if (pathsRes.ok && pathsRes.data) {
        setPaths(pathsRes.data);
      }
    } catch (err) {
      setError(t("skills.errorLoad"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await api.reloadSkills();
      await loadSkills();
    } finally {
      setReloading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  // Group skills by source (global vs agent)
  const skillGroups = useMemo((): SkillGroup[] => {
    const groups: SkillGroup[] = [];

    // Global skills (source === "user")
    const globalSkills = skills.filter((s) => s.source === "user");
    if (globalSkills.length > 0) {
      groups.push({
        title: t("skills.globalSkills"),
        type: "global",
        path: paths?.global || globalSkills[0]?.baseDir || "",
        skills: globalSkills,
      });
    }

    // Agent skills - group by agentId
    const agentSkills = skills.filter((s) => s.source === "agent");
    const agentGroups = new Map<string, SkillInfo[]>();

    for (const skill of agentSkills) {
      // Extract agentId from path: ~/.config/friend/agents/{agentId}/skills/...
      const match = skill.filePath.match(/\/agents\/([^/]+)\/skills\//);
      const agentId = match ? match[1] : "unknown";

      if (!agentGroups.has(agentId)) {
        agentGroups.set(agentId, []);
      }
      agentGroups.get(agentId)!.push(skill);
    }

    // Convert to groups, using baseDir from skills
    for (const [agentId, agentSkillList] of agentGroups) {
      // Use baseDir from first skill, or fallback to paths.agents
      const agentPath = agentSkillList[0]?.baseDir || paths?.agents.find((a) => a.agentId === agentId)?.path || "";
      groups.push({
        title: t("skills.agentSkills", { agentId }),
        type: "agent",
        agentId,
        path: agentPath,
        skills: agentSkillList,
      });
    }

    return groups;
  }, [skills, paths, t]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("skills.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("skills.description")}
          </p>
        </div>
        <button
          onClick={handleReload}
          disabled={reloading}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <RefreshCw className={cn("w-4 h-4", reloading && "animate-spin")} />
          {t("skills.reload")}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : skills.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-sm font-medium mb-2">{t("skills.noSkills")}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {t("skills.noSkillsHint")}
          </p>
          {paths?.global && (
            <div className="flex items-center justify-center gap-2 mt-4 px-3 py-2 rounded-md bg-muted/50 text-sm max-w-md mx-auto">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <code className="font-mono text-xs">{paths.global}</code>
            </div>
          )}
          <a
            href="https://agentskills.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-4 text-sm text-primary hover:underline"
          >
            {t("skills.learnMore")}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        /* Skills List grouped by source */
        <div className="space-y-4">
          {skillGroups.map((group) => (
            <SkillSection key={group.type === "agent" ? group.agentId : "global"} group={group} />
          ))}
        </div>
      )}

      {/* Help Link */}
      <div className="pt-4 border-t border-border">
        <a
          href="https://agentskills.io"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          {t("skills.browseSkills")}
        </a>
      </div>
    </div>
  );
}

interface SkillSectionProps {
  group: SkillGroup;
}

function SkillSection({ group }: SkillSectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Section Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            {group.type === "agent" && <Bot className="w-4 h-4 text-primary" />}
            <span className="font-medium text-sm">{group.title}</span>
            <span
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-medium rounded",
                group.type === "global"
                  ? "bg-primary/10 text-primary"
                  : "bg-accent text-accent-foreground",
              )}
            >
              {group.type === "global" ? t("skills.global") : t("skills.agent")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("skills.skillCount", { count: group.skills.length, plural: group.skills.length !== 1 ? "s" : "" })}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <FolderOpen className="w-3 h-3 text-muted-foreground" />
            <code className="font-mono text-[10px] text-muted-foreground truncate">
              {group.path}
            </code>
          </div>
        </div>
      </button>

      {/* Skills List */}
      {expanded && (
        <div className="divide-y divide-border/50">
          {group.skills.map((skill) => (
            <SkillCard key={skill.filePath} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SkillCardProps {
  skill: SkillInfo;
}

function SkillCard({ skill }: SkillCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="hover:bg-accent/20 transition-colors">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{skill.name}</span>
              {skill.disableModelInvocation && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground">
                  {t("skills.manualOnly")}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{skill.description}</p>
          </div>
          <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-0 border-t border-border/30">
          <div className="pt-3 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground flex-shrink-0">{t("skills.file")}</span>
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded break-all">
                {skill.filePath}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
