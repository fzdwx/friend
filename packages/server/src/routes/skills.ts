import { Elysia, t } from "elysia";
import { getAgentManager } from "../agent/manager";
import type { SkillInfo, SkillPaths } from "@friend/shared";

export const skillRoutes = new Elysia({ prefix: "/api/skills" })
  // List all loaded skills (global + project from all sessions)
  .get("/", ({ query }) => {
    const sessionId = query.sessionId;
    const skills = getAgentManager().getAllSkills(sessionId);
    const data: SkillInfo[] = skills.map((s) => ({
      name: s.name,
      description: s.description,
      filePath: s.filePath,
      baseDir: s.baseDir,
      source: s.source,
      disableModelInvocation: s.disableModelInvocation,
    }));
    return { ok: true, data };
  })

  // Get skills directory paths (global + all project paths)
  .get("/paths", () => {
    const paths = getAgentManager().getSkillPaths();
    const data: SkillPaths = {
      global: paths.global,
      projects: paths.projects,
    };
    return { ok: true, data };
  })

  // Reload skills for a specific session or all sessions
  .post(
    "/reload",
    async ({ body }) => {
      await getAgentManager().reloadSkills(body.sessionId);
      return { ok: true };
    },
    { body: t.Object({ sessionId: t.Optional(t.String()) }) },
  );
