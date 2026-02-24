# 多 Agent 协作架构设计

> **状态**: 草案  
> **日期**: 2026-02-16  
> **作者**: Coder  
> **目标**: 为 Apex 设计多 Agent 协作能力

---

## 1. 概述

### 1.1 目标

让多个 agent 能够：
- 协作完成复杂任务
- 各自保持独立身份和记忆
- 通过消息传递进行通信
- 动态组建团队处理任务

### 1.2 设计原则

1. **身份独立**: 每个 agent 有自己的 SOUL、记忆、人格
2. **松耦合**: agent 之间通过消息通信，不共享状态
3. **可扩展**: 支持任意数量的 agent 协作
4. **安全性**: agent 之间的信息传递需要权限控制
5. **可观测**: 协作过程可追踪、可调试

### 1.3 核心概念

```
┌─────────────────────────────────────────────────────────────┐
│                        User                                  │
│  "帮我分析这个项目，写一份测试计划，然后生成代码"           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                        │
│  (Coordinator - 分解任务、分配给专业 agent)                  │
└─────┬───────────────┬───────────────┬───────────────────────┘
      │               │               │
      ▼               ▼               ▼
┌───────────┐   ┌───────────┐   ┌───────────┐
│ Analyst   │   │ Tester    │   │ Coder     │
│ Agent     │   │ Agent     │   │ Agent     │
│           │   │           │   │           │
│ 分析项目  │   │ 写测试计划 │   │ 生成代码  │
│ 输出报告  │   │ 输出用例   │   │ 输出代码  │
└───────────┘   └───────────┘   └───────────┘
```

---

## 2. 协作模式

### 2.1 模式分类

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| **Orchestrator** | 主 agent 分解任务，分配给子 agent | 复杂任务分解 |
| **Peer-to-Peer** | agent 平等协作，互相请求 | 专家咨询、协作讨论 |
| **Pipeline** | 任务流经多个 agent 处理 | 数据处理流水线 |
| **Blackboard** | agent 向共享黑板读写信息 | 协作推理、问题求解 |
| **Team** | 一组 agent 组建团队协作 | 长期项目协作 |

### 2.2 Orchestrator 模式（推荐主模式）

```typescript
// Orchestrator 接收用户请求，分解任务
const orchestrator = new OrchestratorAgent({
  id: 'orchestrator',
  team: ['analyst', 'coder', 'tester'],
});

// 任务分解
const plan = await orchestrator.decompose(userRequest);
// {
//   tasks: [
//     { id: 1, agent: 'analyst', input: '分析项目结构', dependsOn: [] },
//     { id: 2, agent: 'coder', input: '实现核心模块', dependsOn: [1] },
//     { id: 3, agent: 'tester', input: '编写测试', dependsOn: [2] },
//   ]
// }

// 执行任务
const results = await orchestrator.execute(plan);
```

### 2.3 Peer-to-Peer 模式

```typescript
// Agent A 请求 Agent B 的帮助
const agentA = getAgent('coder');
const agentB = getAgent('security-expert');

// A 向 B 发送请求
const response = await agentA.ask(agentB, {
  question: '这段代码有安全漏洞吗？',
  context: codeSnippet,
});
```

---

## 3. 通信机制

### 3.1 消息类型

```typescript
// packages/shared/src/agent-messages.ts

export type AgentMessageType =
  | 'task_request'      // 请求执行任务
  | 'task_response'     // 任务响应
  | 'query'             // 简单询问
  | 'reply'             // 简单回复
  | 'broadcast'         // 广播通知
  | 'handoff'           // 任务转交
  | 'collaboration'     // 协作邀请
  ;

export interface AgentMessage {
  id: string;
  type: AgentMessageType;
  from: string;           // 发送者 agent ID
  to: string | 'all';     // 接收者 agent ID 或 'all'
  timestamp: number;
  
  // 消息内容
  content: {
    text: string;         // 自然语言描述
    structured?: unknown; // 结构化数据（可选）
  };
  
  // 上下文
  context?: {
    sessionId?: string;   // 关联的 session
    taskId?: string;      // 关联的任务
    parentMessageId?: string; // 回复的消息
  };
  
  // 元数据
  metadata?: {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    ttl?: number;         // 消息过期时间（秒）
    requireAck?: boolean; // 是否需要确认
  };
}
```

### 3.2 消息路由

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Message Bus                         │
│  (消息路由中心)                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  send(msg)  ┌─────────────────────────────┐   │
│  │ Agent A │ ──────────► │     Message Queue           │   │
│  └─────────┘             │  ┌───────┐ ┌───────┐       │   │
│                          │  │ A→B   │ │ A→all │       │   │
│  ┌─────────┐  receive()  │  └───────┘ └───────┘       │   │
│  │ Agent B │ ◄────────── │         Router              │   │
│  └─────────┘             └─────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Agent Mailbox

每个 agent 有自己的 mailbox：

```typescript
interface AgentMailbox {
  agentId: string;
  
  // 接收消息
  receive(): AsyncIterable<AgentMessage>;
  
  // 发送消息
  send(to: string, message: AgentMessage): Promise<void>;
  
  // 广播消息
  broadcast(message: AgentMessage): Promise<void>;
  
  // 查询待处理消息
  getPending(): AgentMessage[];
  
  // 确认消息处理完成
  ack(messageId: string): void;
}
```

---

## 4. 任务协调

### 4.1 任务生命周期

```
┌────────┐   assign    ┌─────────┐   start    ┌──────────┐
│ Created│ ──────────► │ Assigned│ ─────────► │ Running  │
└────────┘             └─────────┘            └────┬─────┘
                                                   │
                    ┌──────────────────────────────┤
                    │                              │
                    ▼                              ▼
              ┌───────────┐                  ┌──────────┐
              │ Completed │                  │  Failed  │
              └───────────┘                  └──────────┘
                    │
                    ▼
              ┌───────────┐
              │  Verified │
              └───────────┘
```

### 4.2 任务分解

```typescript
interface TaskDecomposer {
  /**
   * 将复杂任务分解为子任务
   */
  decompose(task: Task): Promise<TaskGraph>;
}

interface TaskGraph {
  taskId: string;
  subtasks: SubTask[];
  dependencies: Dependency[];
}

interface SubTask {
  id: string;
  description: string;
  assignedAgent?: string;  // 分配给哪个 agent
  requiredCapabilities?: string[];  // 需要的能力
  input?: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface Dependency {
  from: string;  // 依赖的任务 ID
  to: string;    // 被依赖的任务 ID
  type: 'sequential' | 'parallel' | 'conditional';
}
```

### 4.3 任务调度器

```typescript
class TaskScheduler {
  private taskQueue: PriorityQueue<Task>;
  private agents: Map<string, AgentStatus>;
  
  /**
   * 调度任务到合适的 agent
   */
  async schedule(task: Task): Promise<string> {
    // 1. 找到有能力处理该任务的 agent
    const candidates = this.findCapableAgents(task);
    
    // 2. 根据负载、优先级选择最佳 agent
    const selected = this.selectBestAgent(candidates);
    
    // 3. 分配任务
    await this.assignTask(selected, task);
    
    return selected;
  }
  
  /**
   * 监控任务执行
   */
  async monitor(taskId: string): Promise<TaskStatus> {
    // ...
  }
}
```

---

## 5. 协作团队

### 5.1 团队定义

```typescript
interface AgentTeam {
  id: string;
  name: string;
  description: string;
  
  // 团队成员
  members: TeamMember[];
  
  // 团队规则
  rules: TeamRule[];
  
  // 共享资源
  sharedResources: {
    blackboard?: Blackboard;  // 共享黑板
    knowledgeBase?: string;   // 共享知识库
  };
}

interface TeamMember {
  agentId: string;
  role: 'leader' | 'worker' | 'consultant' | 'observer';
  capabilities: string[];
  
  // 工作负载限制
  maxConcurrentTasks?: number;
  priority?: number;
}

interface TeamRule {
  type: 'routing' | 'escalation' | 'conflict';
  condition: string;
  action: string;
}
```

### 5.2 团队协作示例

```typescript
// 创建一个开发团队
const devTeam = await createTeam({
  id: 'dev-team',
  name: 'Development Team',
  members: [
    { agentId: 'architect', role: 'leader', capabilities: ['design', 'review'] },
    { agentId: 'coder', role: 'worker', capabilities: ['coding', 'testing'] },
    { agentId: 'reviewer', role: 'consultant', capabilities: ['review', 'security'] },
  ],
  rules: [
    { type: 'escalation', condition: 'task.failed > 2', action: 'notify leader' },
    { type: 'conflict', condition: 'review.failed', action: 'team discussion' },
  ],
});

// 提交任务给团队
await devTeam.submitTask({
  description: '实现用户认证模块',
  requiredCapabilities: ['coding', 'security'],
});
```

---

## 6. 黑板模式

### 6.1 共享黑板

用于 agent 之间共享信息和协作推理：

```typescript
interface Blackboard {
  id: string;
  teamId: string;
  
  // 数据条目
  entries: BlackboardEntry[];
  
  // 订阅者
  subscribers: string[];
}

interface BlackboardEntry {
  id: string;
  author: string;  // agent ID
  timestamp: number;
  
  // 内容
  type: 'fact' | 'hypothesis' | 'decision' | 'question' | 'result';
  content: unknown;
  
  // 状态
  status: 'active' | 'deprecated' | 'confirmed' | 'rejected';
  confidence?: number;  // 置信度
  
  // 关联
  relatedTo?: string[];  // 关联的其他条目
}

// Agent 读写黑板
const blackboard = getBlackboard('analysis-bb');

// 写入事实
await blackboard.write({
  type: 'fact',
  content: { finding: '数据库查询存在性能问题', severity: 'high' },
  confidence: 0.95,
});

// 读取其他 agent 的发现
const findings = await blackboard.query({
  type: 'fact',
  status: 'active',
});
```

### 6.2 协作推理示例

```
问题：分析系统性能瓶颈

┌─────────────────────────────────────────────────────────────┐
│                         Blackboard                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Analyst] fact: CPU 使用率持续 90%+                        │
│  [Analyst] fact: 数据库查询响应时间 > 2s                    │
│  [Analyst] hypothesis: 可能是数据库索引问题                  │
│                                                             │
│  [DB-Expert] fact: 发现缺失索引：users.email                │
│  [DB-Expert] fact: 慢查询：SELECT * FROM users WHERE email  │
│  [DB-Expert] confirms: 索引问题导致性能下降                  │
│                                                             │
│  [Solution-Designer] decision: 添加 email 列索引            │
│  [Solution-Designer] decision: 优化查询语句                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 记忆共享

### 7.1 记忆隔离与共享

```typescript
interface AgentMemory {
  // 私有记忆 - 只有自己能访问
  private: {
    experiences: Experience[];
    lessons: Lesson[];
    preferences: Preference[];
  };
  
  // 团队共享记忆 - 团队成员可访问
  shared: {
    teamId: string;
    knowledge: SharedKnowledge[];
    decisions: TeamDecision[];
  };
  
  // 公共记忆 - 所有 agent 可访问
  public: {
    facts: PublicFact[];
    procedures: Procedure[];
  };
}
```

### 7.2 知识传递

```typescript
// Agent A 分享知识给 Agent B
await agentA.shareKnowledge(agentB, {
  type: 'lesson',
  content: '处理大数据集时，应该分批处理避免内存溢出',
  context: { task: 'data-processing' },
});

// Agent B 查询共享知识
const lessons = await agentB.querySharedKnowledge({
  type: 'lesson',
  context: 'data-processing',
});
```

---

## 8. 接口设计

### 8.1 Agent 协作接口

```typescript
// packages/server/src/agent/collaboration/types.ts

/**
 * Agent 协作能力接口
 */
interface AgentCollaboration {
  /**
   * 获取 agent ID
   */
  readonly id: string;
  
  /**
   * 获取 agent 能力
   */
  getCapabilities(): string[];
  
  /**
   * 接收来自其他 agent 的消息
   */
  receiveMessage(message: AgentMessage): Promise<void>;
  
  /**
   * 发送消息给其他 agent
   */
  sendMessage(to: string, message: Omit<AgentMessage, 'from' | 'to'>): Promise<void>;
  
  /**
   * 广播消息
   */
  broadcast(message: Omit<AgentMessage, 'from' | 'to'>): Promise<void>;
  
  /**
   * 请求其他 agent 帮助
   */
  ask(agentId: string, question: string, context?: unknown): Promise<string>;
  
  /**
   * 将任务委托给其他 agent
   */
  delegate(task: Task, agentId: string): Promise<TaskResult>;
  
  /**
   * 加入团队
   */
  joinTeam(teamId: string, role: TeamMember['role']): Promise<void>;
  
  /**
   * 离开团队
   */
  leaveTeam(teamId: string): Promise<void>;
}
```

### 8.2 协作管理器

```typescript
/**
 * 协作管理器 - 管理所有 agent 之间的协作
 */
class CollaborationManager {
  private agents: Map<string, AgentCollaboration>;
  private teams: Map<string, AgentTeam>;
  private messageBus: MessageBus;
  private taskScheduler: TaskScheduler;
  
  /**
   * 注册 agent
   */
  registerAgent(agent: AgentCollaboration): void;
  
  /**
   * 注销 agent
   */
  unregisterAgent(agentId: string): void;
  
  /**
   * 创建团队
   */
  createTeam(config: TeamConfig): Promise<AgentTeam>;
  
  /**
   * 解散团队
   */
  dissolveTeam(teamId: string): Promise<void>;
  
  /**
   * 路由消息
   */
  routeMessage(message: AgentMessage): Promise<void>;
  
  /**
   * 提交协作任务
   */
  submitCollaborativeTask(task: CollaborativeTask): Promise<TaskResult>;
  
  /**
   * 获取协作状态
   */
  getCollaborationStatus(): CollaborationStatus;
}
```

---

## 9. 安全与权限

### 9.1 权限模型

```typescript
interface AgentPermission {
  agentId: string;
  
  // 可访问的资源
  resources: {
    files: string[];        // 文件路径 pattern
    tools: string[];        // 工具名称
    agents: string[];       // 可通信的 agent
    teams: string[];        // 可加入的团队
  };
  
  // 可执行的操作
  actions: {
    canDelegate: boolean;
    canBroadcast: boolean;
    canCreateTeam: boolean;
    canAccessSharedMemory: boolean;
  };
}

// 权限检查
async function checkPermission(
  agentId: string,
  action: string,
  resource: string
): Promise<boolean> {
  // ...
}
```

### 9.2 信息隔离

```typescript
// 敏感信息过滤
class InformationFilter {
  /**
   * 过滤消息中的敏感信息
   */
  filter(message: AgentMessage, recipientId: string): AgentMessage {
    // 1. 检查发送者权限
    // 2. 过滤敏感字段
    // 3. 添加审计日志
    return filteredMessage;
  }
}
```

---

## 10. 实现计划

### 10.1 Phase 1: 基础通信（1-2 天）

**目标**: agent 之间可以发送和接收消息

**文件结构**:
```
packages/server/src/agent/collaboration/
├── index.ts              # 导出
├── types.ts              # 类型定义
├── message-bus.ts        # 消息总线
├── mailbox.ts            # Agent mailbox
└── manager.ts            # 协作管理器
```

**任务**:
1. 定义消息类型和接口
2. 实现消息总线
3. 实现 mailbox
4. 集成到 AgentManager

### 10.2 Phase 2: 任务协调（1-2 天）

**目标**: 支持任务分解和分配

**文件结构**:
```
packages/server/src/agent/collaboration/
├── task/
│   ├── types.ts          # 任务类型
│   ├── decomposer.ts     # 任务分解
│   ├── scheduler.ts      # 任务调度
│   └── executor.ts       # 任务执行
```

**任务**:
1. 实现任务分解器
2. 实现任务调度器
3. 实现任务执行器
4. 添加 Orchestrator 模式支持

### 10.3 Phase 3: 团队协作（2-3 天）

**目标**: 支持团队组建和协作

**文件结构**:
```
packages/server/src/agent/collaboration/
├── team/
│   ├── types.ts          # 团队类型
│   ├── manager.ts        # 团队管理
│   ├── blackboard.ts     # 共享黑板
│   └── memory.ts         # 共享记忆
```

**任务**:
1. 实现团队管理器
2. 实现共享黑板
3. 实现共享记忆
4. 添加团队协作工具

---

## 11. 配置示例

### 11.1 Agent 配置

```yaml
# ~/.config/apex/agents/coder/config.yaml
id: coder
name: Coder
identity:
  emoji: 💻
  vibe: Efficient & Lively
  
# 协作配置
collaboration:
  # 能力标签
  capabilities:
    - coding
    - debugging
    - testing
    - refactoring
  
  # 工作负载
  maxConcurrentTasks: 3
  
  # 可通信的 agent
  allowedAgents:
    - architect
    - reviewer
    - tester
```

### 11.2 团队配置

```yaml
# ~/.config/apex/teams/dev-team.yaml
id: dev-team
name: Development Team
description: 软件开发团队

members:
  - agentId: architect
    role: leader
    capabilities: [design, review]
    
  - agentId: coder
    role: worker
    capabilities: [coding, testing]
    
  - agentId: reviewer
    role: consultant
    capabilities: [review, security]

rules:
  - type: escalation
    condition: "task.failed > 2"
    action: "notify architect"
    
  - type: routing
    condition: "task.requires == 'security'"
    action: "assign to reviewer"
```

---

## 12. 使用示例

### 12.1 简单协作

```typescript
// Agent A 请求 Agent B 帮助
const coder = getAgent('coder');
const security = getAgent('security-expert');

// 发送请求
const response = await coder.ask('security-expert', 
  '这段代码有安全漏洞吗？',
  { code: codeSnippet }
);

console.log(response);
// "发现潜在的 SQL 注入风险，建议使用参数化查询..."
```

### 12.2 任务分解

```typescript
// Orchestrator 分解复杂任务
const orchestrator = getAgent('orchestrator');

const result = await orchestrator.process({
  type: 'collaborative',
  task: '帮我重构用户认证模块，确保安全性和可测试性',
});

// orchestrator 会：
// 1. 分解任务
// 2. 分配给合适的 agent
// 3. 协调执行
// 4. 合并结果
```

### 12.3 团队协作

```typescript
// 提交任务给团队
const team = getTeam('dev-team');

await team.submitTask({
  description: '实现 API 速率限制功能',
  requiredCapabilities: ['coding', 'security'],
  priority: 'high',
});

// 团队内部会：
// 1. 根据能力分配任务
// 2. 在黑板上共享分析结果
// 3. 协作完成设计和实现
// 4. 互相 review 和验证
```

---

## 13. 监控与调试

### 13.1 协作日志

```typescript
interface CollaborationLog {
  timestamp: number;
  type: 'message' | 'task' | 'team';
  action: string;
  from: string;
  to: string;
  details: unknown;
}

// 查看协作日志
const logs = await getCollaborationLogs({
  agentId: 'coder',
  timeRange: { start: Date.now() - 3600000 },
});
```

### 13.2 协作可视化

```
┌─────────────────────────────────────────────────────────────┐
│                  Collaboration Graph                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   User                                                      │
│     │                                                       │
│     ▼                                                       │
│   Orchestrator ────────────────────────┐                   │
│     │                                   │                   │
│     ├────────► Analyst ────┐           │                   │
│     │                       ▼           │                   │
│     │                    Blackboard    │                   │
│     │                       ▲           │                   │
│     ├────────► Coder ──────┤           │                   │
│     │                       │           │                   │
│     └────────► Tester ─────┘           │                   │
│                                         │                   │
│   Result ◄──────────────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 14. 未来扩展

### 14.1 短期

- [ ] 流式消息传递（实时协作）
- [ ] 任务优先级队列
- [ ] 冲突检测与解决
- [ ] 协作性能指标

### 14.2 中期

- [ ] 动态团队组建（根据任务自动组建）
- [ ] Agent 能力发现
- [ ] 协作学习（从协作中学习）
- [ ] 多语言协作（不同语言的 agent）

### 14.3 长期

- [ ] 自组织团队
- [ ] 分布式协作（跨服务器）
- [ ] 人机协作（agent + 人类专家）
- [ ] 协作进化（团队自我优化）

---

## 15. 参考资料

- [Multi-Agent Systems: A Survey](https://arxiv.org/abs/1911.06258)
- [The Blackboard Architecture](https://en.wikipedia.org/wiki/Blackboard_system)
- [Orchestrator Pattern](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageRouter.html)
- [CrewAI - Multi-Agent Framework](https://github.com/joaomdmoura/crewAI)
- [AutoGen - Multi-Agent Conversation](https://github.com/microsoft/autogen)
- [LangGraph - Stateful Multi-Agent](https://github.com/langchain-ai/langgraph)
