# Apex Agent 配置示例

本文档展示如何配置 agent 的各种功能。

---

## Heartbeat（心跳）

Heartbeat 允许 agent 定时执行任务，即使没有用户交互。

### 配置方式

在 agent 配置中添加 `heartbeat` 字段：

```json
{
  "id": "my-agent",
  "name": "My Assistant",
  "heartbeat": {
    "every": "30m",
    "target": "last"
  }
}
```

### 配置选项

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `every` | string | 心跳间隔（如 "5m", "30m", "1h", "2h"） | "30m" |
| `target` | string | 结果发送目标 | "last" |

### target 选项

- `"last"` - 发送到最后活跃的会话
- `"none"` - 不发送结果（静默执行）
- `"whatsapp"` / `"telegram"` / `"discord"` - 发送到对应平台（未来支持）

### HEARTBEAT.md

在 agent 的 workspace 目录创建 `HEARTBEAT.md` 文件，定义心跳时要执行的任务：

```markdown
# HEARTBEAT.md

## 定时任务

- 检查未读消息
- 回顾今日日程
- 检查系统状态

如果没有任务，回复 HEARTBEAT_OK。
```

---

## Cron（定时任务）

Cron 允许设置一次性提醒或周期性任务。

### 使用方式

通过 `cron` 工具设置：

```
# 一次性提醒（10分钟后）
cron add message="提醒我休息一下" at_seconds=600

# 周期性任务（每小时）
cron add message="检查服务器状态" every_seconds=3600

# Cron 表达式（每天 9:00）
cron add message="早安问候" cron_expr="0 9 * * *"

# 列出所有任务
cron list

# 删除任务
cron remove job_id="xxx"
```

### Cron 表达式

支持标准 5 字段 cron 表达式：

```
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日期 (1 - 31)
│ │ │ ┌───────────── 月份 (1 - 12)
│ │ │ │ ┌───────────── 星期 (0 - 6, 0=周日)
│ │ │ │ │
* * * * *
```

#### 常用示例

| 表达式 | 说明 |
|--------|------|
| `0 9 * * *` | 每天 9:00 |
| `0 */2 * * *` | 每 2 小时 |
| `30 9 * * 1-5` | 工作日 9:30 |
| `0 0 * * 0` | 每周日午夜 |
| `0 9 1 * *` | 每月 1 日 9:00 |

#### 预定义表达式

| 表达式 | 说明 |
|--------|------|
| `@hourly` | 每小时 |
| `@daily` | 每天 0:00 |
| `@weekly` | 每周日 0:00 |
| `@monthly` | 每月 1 日 0:00 |
| `@yearly` | 每年 1 月 1 日 0:00 |

---

## 完整配置示例

```json
{
  "id": "productivity-agent",
  "name": "Productivity Assistant",
  "identity": {
    "name": "Max",
    "emoji": "🚀",
    "vibe": "Efficient and proactive"
  },
  "model": "anthropic/claude-sonnet-4-5",
  "thinkingLevel": "medium",
  "heartbeat": {
    "every": "30m",
    "target": "last"
  }
}
```
