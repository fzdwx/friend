# CONFIGURATION UI COMPONENTS

**Location:** `packages/app/src/components/config/`
**Purpose**: Application configuration UI (Appearance, Providers)

---

## STRUCTURE

```
config/
├── ProviderSettings.tsx   # AI Provider configuration
├── AppearanceSettings.tsx # Theme selection and preview
└── ...
```

---

## WHERE TO LOOK

| Task                    | File                      |
| ----------------------- | ------------------------- |
| AI 提供商配置           | `ProviderSettings.tsx`    |
| 外观设置（主题）        | `AppearanceSettings.tsx`  |

---

## CONVENTIONS

- **配置存储**: 使用 `configStore` (Zustand) 管理配置状态
- **表单处理**: 使用 `@tauri-apps/plugin-dialog` 选择目录
- **实时预览**: 主题切换即时生效
- **API 通信**: 通过 `lib/api.ts` 与后端通信

---

## PATTERNS

### Config Component Structure

```typescript
export function SettingsComponent() {
  const config = useConfigStore();
  const { data, ok } = useApi(() => api.getConfig());

  useEffect(() => {
    if (ok && data) updateConfig(data);
  }, [ok, data]);

  return <div>{/* UI */}</div>;
}
```

**Convention**: 统一使用 `useApi()` hook 获取配置，通过 `useConfigStore()` 管理状态

---

## ANTI-PATTERNS

- 不要在组件内直接 fetch: 使用 `lib/api.ts`
- 不要直接操作 Tauri API: 通过 `@tauri-apps/plugin-dialog`
- 不要在 render 中调用 API: 使用 `useEffect` 或 hooks

---

## NOTES

- **7 文件**: 配置 UI 组件位于此目录
- **主题系统**: 支持内置主题 + 自定义主题导入/导出
- **Provider 管理**: 支持添加 OpenAI-compatible AI 提供商
