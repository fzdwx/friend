# Theme Tools Usage Guide

This guide explains how to use the theme-related tools in the Friend AI agent.

## Overview

The theme tools allow the AI to:
1. List all available themes (built-in and custom)
2. Generate new custom themes based on color preferences
3. Set the active theme for the application

## Tool 1: Get Themes

Retrieves all available themes in the system.

### Example Usage

```
User: Show me all available themes
Agent: (calls get_themes) ...
Available themes:
  - Default Light (default-light) [light, built-in]
  - Default Dark (default-dark) [dark, built-in]
  - Dracula (dracula) [dark, built-in]
  - Custom Theme 1 (abc123) [dark, custom]
```

### Parameters

- `mode` (optional): Filter by "light", "dark", or "system"
- `builtInOnly` (optional): Set to true to see only built-in themes

## Tool 2: Generate Theme

Creates a custom theme based on a base hue (color) and saturation.

### Example Usage

```
User: Create a blue theme for dark mode with medium saturation
Agent: (calls generate_theme with hue=220, saturation=0.12, mode="dark")
      Successfully generated theme "Generated Theme (220°)" (dark)
      Primary: L=0.5, C=0.12, H=220
      Theme has been saved to the database.
```

### Parameters

- `hue` (required): 0-360 hue value
  - 0-60: Red/Orange/Yellow
  - 60-180: Green/Cyan
  - 180-270: Blue
  - 270-360: Purple/Magenta

- `saturation` (optional): 0-0.25, default 0.1
  - Lower values: More muted/pastel
  - Higher values: More vibrant

- `mode` (required): "light" or "dark"
- `name` (optional): Custom theme name
- `save` (optional): Save to database (default: true)

### Color Palette Generation

The tool generates a complete color palette including:
- Background and foreground colors
- Card and popover colors
- Primary, secondary, accent colors
- Muted and destructive colors
- Border and input colors
- Sidebar colors

All colors are based on the theme mode (light/dark) and the specified hue.

## Tool 3: Set Theme

Sets the active theme for the application.

### Example Usage

```
User: Switch to dark mode
Agent: (calls set_theme with themeId="dark")
      Successfully set theme to "Default Dark" (dark).
      The active theme ID is: default-dark

User: Use the blue theme we just created
Agent: (calls set_theme with themeId="abc123")
      Successfully set theme to "Generated Theme (220°)" (dark).
```

### Parameters

- `themeId` (required): Either:
  - A specific theme ID (from get_themes)
  - "light" - shortcut for default light theme
  - "dark" - shortcut for default dark theme

## Workflow Examples

### Example 1: Switch to Dark Mode

```
User: Change to dark mode
Agent: I'll switch to dark mode for you.
      (calls set_theme with themeId="dark")
      Done! The theme is now set to dark mode.
```

### Example 2: Create a Custom Theme

```
User: Create a purple theme
Agent: (calls generate_theme with hue=280, mode="dark")
      Successfully generated theme "Generated Theme (280°)" (dark)
      Primary: L=0.5, C=0.1, H=280
      Would you like me to activate this theme?

User: Yes
Agent: (calls set_theme with the new theme ID)
      Theme activated!
```

### Example 3: Browse and Select Themes

```
User: What themes do you have?
Agent: (calls get_themes)
      Here are all available themes:
      - Default Light (light)
      - Default Dark (dark)
      - Dracula (dark)
      - Nord (dark)
      - Gruvbox Dark (dark)
      - My Custom Theme (dark)

User: Try the Nord theme
Agent: (calls set_theme with themeId="nord")
      Successfully switched to Nord theme!
```

### Example 4: Generate Multiple Options

```
User: Show me some green theme options for dark mode
Agent: I'll generate a few green-themed options.
(calls generate_theme with hue=140, saturation=0.08, name="Low Saturation Green")
(calls generate_theme with hue=140, saturation=0.15, name="Medium Saturation Green")
(calls generate_theme with hue=150, saturation=0.12, name="Teal Green")

Generated 3 themes:
1. Low Saturation Green - Muted, professional look
2. Medium Saturation Green - Balanced, vibrant
3. Teal Green - Fresh, modern appearance

Which one would you like to use?
```

## Best Practices

1. **Always list themes first** - Use get_themes to see what's available before asking to set a specific theme
2. **Save generated themes** - Useful themes should be saved to the database for reuse
3. **Consider user preferences** - Ask about color preferences (hue) and saturation before generating
4. **Provide previews** - Describe the generated colors to help the user choose
5. **Use shortcuts** - For common requests, use "light" or "dark" shortcuts

## Integration Notes

- Themes are persisted in the database via `prisma.customTheme`
- Active theme is stored in `AppConfig.activeThemeId`
- The frontend handles actual theme application via CSS variables
- Built-in themes are defined both in tools and in the app
