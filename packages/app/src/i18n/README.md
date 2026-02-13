# i18n Internationalization

Friend supports multiple languages through [i18next](https://www.i18next.com/) and [react-i18next](https://react.i18next.com/).

## Supported Languages

| Code | Name | Native Name |
|------|------|-------------|
| `en` | English | English |
| `zh` | Chinese | 中文 |

## Architecture

```
packages/app/src/i18n/
├── index.ts              # i18n configuration and initialization
├── useTranslation.ts     # Translation utility functions
└── locales/
    ├── en/
    │   └── translation.json
    └── zh/
        └── translation.json
```

## Usage

### In React Components

```tsx
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t("common.title")}</h1>
      <p>{t("sidebar.msgs", { count: 5 })}</p>
    </div>
  );
}
```

### Outside React Components

```ts
import { getT, changeLanguage, getCurrentLanguage } from "@/i18n/useTranslation";

// Get translation function
const t = getT();
console.log(t("common.loading"));

// Change language
await changeLanguage("zh");

// Get current language
const lang = getCurrentLanguage();
```

## Translation Keys Structure

Translation keys are organized by feature/module:

- `common.*` - Shared strings (buttons, labels, etc.)
- `sidebar.*` - Sidebar UI strings
- `input.*` - Input area strings
- `settings.*` - Settings modal strings
- `agents.*` - Agent management strings
- `providers.*` - Provider configuration strings
- `memory.*` - Memory configuration strings
- `appearance.*` - Theme/appearance strings
- `plan.*` - Plan mode strings
- `tools.*` - Tool execution strings
- `chat.*` - Chat UI strings

## Interpolation

Use `{{variable}}` syntax for dynamic values:

```json
{
  "sidebar": {
    "msgs": "{{count}} msgs"
  },
  "plan": {
    "steps": "{{count}} steps",
    "stepProgress": "{{completed}}/{{total}} steps"
  }
}
```

```tsx
t("sidebar.msgs", { count: 10 })  // "10 msgs" or "10 条消息"
t("plan.stepProgress", { completed: 3, total: 5 })  // "3/5 steps"
```

## Adding a New Language

1. Create a new directory in `packages/app/src/i18n/locales/` (e.g., `ja/`)
2. Create `translation.json` with translations
3. Add the language to `supportedLanguages` in `packages/app/src/i18n/index.ts`:

```ts
export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },  // Add this
] as const;
```

4. Import and add the translation resource:

```ts
import jaTranslation from './locales/ja/translation.json';

export const resources = {
  en: { translation: enTranslation },
  zh: { translation: zhTranslation },
  ja: { translation: jaTranslation },  // Add this
} as const;
```

## Language Detection

The language is automatically detected in this order:

1. `localStorage` (key: `i18nextLng`)
2. Browser language (`navigator.language`)
3. HTML tag `lang` attribute
4. Fallback to English (`en`)

## Language Switcher

A language switcher component is available at `@/components/ui/LanguageSwitcher`. It's currently placed in the Appearance settings page.

Users can switch languages at any time, and their choice is persisted to localStorage.
