import { Elysia, t } from "elysia";
import { getAgentManager } from "../agent/manager";

const CustomModelSchema = t.Object({
  id: t.String(),
  name: t.String(),
  reasoning: t.Boolean(),
  contextWindow: t.Number(),
  maxTokens: t.Number(),
  cost: t.Object({
    input: t.Number(),
    output: t.Number(),
    cacheRead: t.Number(),
    cacheWrite: t.Number(),
  }),
});

const CustomProviderSchema = t.Object({
  name: t.String(),
  baseUrl: t.String(),
  apiKey: t.Optional(t.String()),
  api: t.Optional(t.String()),
  headers: t.Optional(t.Record(t.String(), t.String())),
  models: t.Array(CustomModelSchema),
});

const ColorDefSchema = t.Object({
  l: t.Number(),
  c: t.Number(),
  h: t.Number(),
});

const ColorSetSchema = t.Object({
  background: ColorDefSchema,
  foreground: ColorDefSchema,
  card: ColorDefSchema,
  cardForeground: ColorDefSchema,
  popover: ColorDefSchema,
  popoverForeground: ColorDefSchema,
  primary: ColorDefSchema,
  primaryForeground: ColorDefSchema,
  secondary: ColorDefSchema,
  secondaryForeground: ColorDefSchema,
  muted: ColorDefSchema,
  mutedForeground: ColorDefSchema,
  accent: ColorDefSchema,
  accentForeground: ColorDefSchema,
  destructive: ColorDefSchema,
  destructiveForeground: ColorDefSchema,
  border: ColorDefSchema,
  input: ColorDefSchema,
  ring: ColorDefSchema,
  sidebar: ColorDefSchema,
  sidebarForeground: ColorDefSchema,
  sidebarBorder: ColorDefSchema,
});

const ThemeSchema = t.Object({
  id: t.String(),
  name: t.String(),
  mode: t.String(),
  colors: ColorSetSchema,
  isPreset: t.Optional(t.Boolean()),
  isBuiltIn: t.Optional(t.Boolean()),
});

export const configRoutes = new Elysia({ prefix: "/api/config" })
  .get("/", () => {
    return { ok: true, data: getAgentManager().getConfig() };
  })

  // Custom provider management
  .get("/providers", () => {
    return { ok: true, data: getAgentManager().getCustomProviders() };
  })

  .post(
    "/providers",
    ({ body }) => {
      getAgentManager().addCustomProvider(body as any);
      return { ok: true };
    },
    { body: CustomProviderSchema },
  )

  .delete("/providers/:name", async ({ params: { name } }) => {
    const ok = await getAgentManager().removeCustomProvider(name);
    if (!ok) return { ok: false, error: "Provider not found" };
    return { ok: true };
  })

  // Theme management
  .get("/themes", async () => {
    const themes = await getAgentManager().getAllThemes();
    return { ok: true, data: themes };
  })

  .get("/themes/custom", async () => {
    const themes = await getAgentManager().getCustomThemes();
    return { ok: true, data: themes };
  })

  .post(
    "/themes",
    async ({ body }) => {
      await getAgentManager().addCustomTheme(body as any);
      return { ok: true };
    },
    { body: ThemeSchema },
  )

  .put(
    "/themes/:id",
    async ({ params: { id }, body }) => {
      const updated = await getAgentManager().updateCustomTheme(id, body as any);
      if (!updated) return { ok: false, error: "Theme not found" };
      return { ok: true, data: updated };
    },
    { body: t.Partial(ThemeSchema) },
  )

  .delete("/themes/:id", async ({ params: { id } }) => {
    const ok = await getAgentManager().deleteCustomTheme(id);
    if (!ok) return { ok: false, error: "Theme not found" };
    return { ok: true };
  })

  .put(
    "/active-theme",
    async ({ body }) => {
      await getAgentManager().setActiveTheme(body.themeId);
      return { ok: true };
    },
    { body: t.Object({ themeId: t.String() }) },
  )

  // Embedding configuration for memory search
  .get("/embedding", () => {
    return { ok: true, data: getAgentManager().getEmbeddingConfig() };
  })

  .put(
    "/embedding",
    ({ body }) => {
      getAgentManager().setEmbeddingConfig(body.provider, body.model);
      return { ok: true };
    },
    {
      body: t.Object({
        provider: t.String(),
        model: t.Optional(t.String()),
      }),
    },
  );
