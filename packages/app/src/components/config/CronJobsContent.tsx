/**
 * Cron Jobs Management UI
 */

import { useState, useEffect } from "react";
import { api, type CronJobInfo, type CronSchedule, type CreateCronJobInput, type AgentInfo } from "@/lib/api";
import { Plus, Trash2, Play, Pause, Clock, RefreshCw, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type ScheduleType = "at" | "every" | "cron";

export function CronJobsContent() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<CronJobInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJobInfo | null>(null);

  useEffect(() => {
    loadJobs();
    loadAgents();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    const res = await api.listCronJobs();
    if (res.ok && res.data) {
      setJobs(res.data);
    }
    setLoading(false);
  };

  const loadAgents = async () => {
    const res = await api.listAgents();
    if (res.ok && res.data) {
      setAgents(res.data);
    }
  };

  const getAgentName = (agentId: string): string => {
    const agent = agents.find((a) => a.id === agentId);
    return agent ? (agent.name || agent.id) : agentId;
  };

  const handleToggleEnabled = async (job: CronJobInfo) => {
    const res = await api.setCronJobEnabled(job.id, !job.enabled);
    if (res.ok) {
      setJobs(jobs.map((j) => (j.id === job.id ? { ...j, enabled: !j.enabled } : j)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("cron.confirmDelete"))) return;
    const res = await api.deleteCronJob(id);
    if (res.ok) {
      setJobs(jobs.filter((j) => j.id !== id));
    }
  };

  const handleCreate = async (input: CreateCronJobInput) => {
    const res = await api.addCronJob(input);
    if (res.ok && res.data) {
      await loadJobs();
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string, updates: { name: string; message: string; schedule: any }) => {
    const res = await api.updateCronJob(id, updates);
    if (res.ok) {
      await loadJobs();
      setEditingJob(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-[640px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{t("cron.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("cron.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadJobs}
              className="p-1.5 hover:bg-accent rounded-md"
              title={t("common.refresh")}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("cron.addJob")}
            </button>
          </div>
        </div>

        {/* Job List */}
        <div className="space-y-2">
          {jobs.length === 0 && !creating && !editingJob && (
            <div className="text-center py-12 text-xs text-muted-foreground border border-dashed border-border rounded-md">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {t("cron.noJobs")}
              <br />
              <span className="text-[11px]">{t("cron.createFirst")}</span>
            </div>
          )}

          {jobs.map((job) => (
            <div
              key={job.id}
              className={cn(
                "border border-border rounded-md p-3 transition-opacity",
                !job.enabled && "opacity-60",
              )}
            >
              {editingJob?.id === job.id ? (
                <JobForm
                  job={job}
                  agents={agents}
                  onSave={(updates) => handleUpdate(job.id, updates)}
                  onCancel={() => setEditingJob(null)}
                  t={t}
                />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{job.name}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {getAgentName(job.agentId)}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded",
                          job.enabled
                            ? "bg-green-500/20 text-green-600 dark:text-green-400"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {job.enabled ? t("cron.enabled") : t("cron.disabled")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {job.payload?.kind === "agentTurn" ? job.payload.message : job.payload?.kind === "systemEvent" ? job.payload.text : ""}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatSchedule(job.schedule)}
                      </div>
                      {job.nextRunAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t("cron.nextRun")}: {formatDate(job.nextRunAt)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleEnabled(job)}
                      className={cn(
                        "p-1.5 hover:bg-accent rounded",
                        job.enabled ? "text-green-600" : "text-muted-foreground",
                      )}
                      title={job.enabled ? t("cron.disable") : t("cron.enable")}
                    >
                      {job.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setEditingJob(job)}
                      className="px-2 py-1 text-xs hover:bg-accent rounded"
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="p-1.5 hover:bg-destructive/20 rounded"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Create Form */}
          {creating && (
            <div className="border border-border rounded-md p-3">
              <JobForm
                agents={agents}
                onSave={handleCreate}
                onCancel={() => setCreating(false)}
                t={t}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Job Form ─────────────────────────────────────────────

interface JobFormProps {
  job?: CronJobInfo;
  agents: AgentInfo[];
  onSave: (data: any) => void;
  onCancel: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function JobForm({ job, agents, onSave, onCancel, t }: JobFormProps) {
  const isEditing = !!job;

  const [name, setName] = useState(job?.name ?? "");
  const [agentId, setAgentId] = useState(job?.agentId ?? "coder");
  const [message, setMessage] = useState(() => {
    if (job?.payload?.kind === "agentTurn") return job.payload.message;
    if (job?.payload?.kind === "systemEvent") return job.payload.text;
    return "";
  });
  const [scheduleType, setScheduleType] = useState<ScheduleType>(() => {
    if (!job) return "every";
    return job.schedule.kind as ScheduleType;
  });
  const [atSeconds, setAtSeconds] = useState(() => {
    if (job?.schedule?.kind === "at") return String(Math.round(job.schedule.atMs / 1000));
    return "3600";
  });
  const [everySeconds, setEverySeconds] = useState(() => {
    if (job?.schedule?.kind === "every") return String(Math.round(job.schedule.everyMs / 1000));
    return "3600";
  });
  const [cronExpr, setCronExpr] = useState(() => {
    if (job?.schedule?.kind === "cron") return job.schedule.expr;
    return "0 9 * * *";
  });

  const handleSubmit = () => {
    if (!name.trim() || !message.trim()) return;

    // Build schedule in the format expected by API (seconds)
    let schedule: any;
    switch (scheduleType) {
      case "at":
        schedule = { kind: "at", at_seconds: parseInt(atSeconds) || 3600 };
        break;
      case "every":
        schedule = { kind: "every", every_seconds: parseInt(everySeconds) || 3600 };
        break;
      case "cron":
        schedule = { kind: "cron", expr: cronExpr || "0 9 * * *" };
        break;
    }

    if (isEditing) {
      onSave({ name, message, schedule });
    } else {
      onSave({ name, agentId, message, schedule });
    }
  };

  return (
    <div className="space-y-3">
      {/* Name */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          {t("cron.jobName")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
          placeholder={t("cron.jobNamePlaceholder")}
        />
      </div>

      {/* Agent ID (only for new jobs) */}
      {!isEditing && (
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            {t("cron.agentId")}
          </label>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name || agent.id} {agent.identity?.emoji ? `${agent.identity.emoji}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Message */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          {t("cron.message")}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm resize-none"
          rows={2}
          placeholder={t("cron.messagePlaceholder")}
        />
      </div>

      {/* Schedule Type */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          {t("cron.scheduleType")}
        </label>
        <div className="flex gap-2">
          {(["at", "every", "cron"] as ScheduleType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setScheduleType(type)}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs rounded border transition-colors",
                scheduleType === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent",
              )}
            >
              {t(`cron.scheduleTypes.${type}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Value */}
      {scheduleType === "at" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            {t("cron.atSeconds")}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={atSeconds}
              onChange={(e) => setAtSeconds(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-sm"
            />
            <span className="text-xs text-muted-foreground">{t("cron.seconds")}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {t("cron.atSecondsHelp")}
          </p>
        </div>
      )}

      {scheduleType === "every" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            {t("cron.everySeconds")}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={everySeconds}
              onChange={(e) => setEverySeconds(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-sm"
            />
            <span className="text-xs text-muted-foreground">{t("cron.seconds")}</span>
          </div>
          <div className="flex gap-1 mt-1.5">
            {[{ label: "1m", value: 60 }, { label: "5m", value: 300 }, { label: "1h", value: 3600 }, { label: "1d", value: 86400 }].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setEverySeconds(String(preset.value))}
                className="px-2 py-0.5 text-[10px] border border-border rounded hover:bg-accent"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {scheduleType === "cron" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            {t("cron.cronExpr")}
          </label>
          <input
            type="text"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm font-mono"
            placeholder="0 9 * * *"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            {t("cron.cronExprHelp")}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs hover:bg-accent rounded"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90"
        >
          {isEditing ? t("common.save") : t("cron.create")}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatSchedule(schedule: CronSchedule): string {
  switch (schedule.kind) {
    case "at":
      return `in ${formatDuration(schedule.atMs / 1000)}`;
    case "every":
      return `every ${formatDuration(schedule.everyMs / 1000)}`;
    case "cron":
      return `cron: ${schedule.expr}`;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
