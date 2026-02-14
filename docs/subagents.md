# Subagent Feature Documentation

## Overview

Subagents are specialized AI agents with isolated context windows that can be delegated specific tasks. They allow you to:

- **Delegate complex tasks** to specialized agents
- **Run tasks in parallel** for faster execution
- **Chain agents together** for multi-step workflows
- **Customize agent behavior** with specific tools and models

## Architecture

### Core Components

```
packages/server/src/agent/subagents/
├── types.ts           # Type definitions
├── discovery.ts       # Agent discovery and loading
├── executor.ts        # Execution engine (single/parallel/chain)
└── index.ts           # Module exports

packages/server/src/agent/tools/
└── subagent.ts        # Tool definition and parameter handling

packages/app/src/components/tools/registry/renderers/
└── subagent.tsx       # Frontend result display
```

### Directory Structure

```
~/.config/friend/subagents/     # User-level subagents
  ├── scout.md
  ├── planner.md
  ├── reviewer.md
  └── worker.md

{workspace}/subagents/            # Workspace-level subagents (optional)
  └── custom-agent.md
```

## Creating Subagents

### Basic Structure

Create a markdown file with YAML frontmatter:

```markdown
---
name: my-agent
description: What this agent does
tools: read, write, bash
model: anthropic/claude-sonnet-4-5
---

You are a specialized agent...

## Your Role
[Describe the agent's purpose]

## Guidelines
[Provide specific instructions]

## Output Format
[Define expected output structure]
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier for the agent |
| `description` | Yes | Brief description shown in listings |
| `tools` | No | Comma-separated list of allowed tools |
| `model` | No | Model to use (e.g., `anthropic/claude-haiku-4-5`) |

### Available Tools

- `read` - Read file contents
- `write` - Create new files
- `edit` - Modify existing files
- `bash` - Execute shell commands
- `grep` - Search file contents
- `find` / `glob` - Find files by pattern
- `ls` - List directory contents

If `tools` is omitted, all tools are available.

### Example: Custom Reviewer

```markdown
---
name: security-reviewer
description: Security-focused code reviewer
tools: read, grep, find, ls
model: anthropic/claude-sonnet-4-5
---

You are a security-focused code reviewer.

## Your Role

Identify security vulnerabilities and unsafe practices in code.

## Checklist

- SQL injection vulnerabilities
- XSS vulnerabilities
- Authentication/authorization issues
- Sensitive data exposure
- Insecure dependencies

## Output Format

```
## Security Assessment

### Critical Issues
- [Issue with location and severity]
  [Remediation steps]

### Warnings
- [Issue]
  [Recommendation]

### Best Practices
- [Suggestion]
```
```

## Using Subagents

### Via Tool Invocation

The AI can invoke subagents using the `subagent` tool:

#### Single Mode

Execute one agent with one task:

```json
{
  "agent": "scout",
  "task": "Find all authentication-related code in the codebase"
}
```

**Example conversation:**
```
User: Use scout to find all authentication code
AI: I'll use the scout agent to search for authentication code...
[Executes subagent tool with scout agent]
```

#### Parallel Mode

Execute multiple agents concurrently (max 4 at a time):

```json
{
  "tasks": [
    { "agent": "scout", "task": "Find all database models" },
    { "agent": "scout", "task": "Find all API endpoints" },
    { "agent": "scout", "task": "Find all test files" }
  ]
}
```

**Use case:** Quick reconnaissance of different codebase aspects simultaneously.

#### Chain Mode

Execute agents sequentially, passing output between steps:

```json
{
  "chain": [
    { "agent": "scout", "task": "Find the authentication middleware" },
    { "agent": "planner", "task": "Create a plan to add OAuth support to: {previous}" },
    { "agent": "worker", "task": "Implement the plan: {previous}" }
  ]
}
```

**The `{previous}` placeholder** is replaced with the output from the previous step.

### Via /subagents Command

List available subagents:

```bash
# List user-level subagents (default)
/subagents

# List workspace-level subagents
/subagents workspace

# List all subagents from both scopes
/subagents both
```

## Execution Modes

### Single Mode

**Best for:** One-off tasks, focused analysis

**Example use cases:**
- Quick codebase exploration
- Single file review
- Focused search task

**Output:**
```
✓ scout (user)
  ↑500 ↓1200 R0 W0 $0.002 ctx:1.7k
  Found authentication code in:
  1. /src/auth/login.ts
  2. /src/auth/middleware.ts
  3. /src/utils/session.ts
```

### Parallel Mode

**Best for:** Independent tasks that can run simultaneously

**Features:**
- Max 4 concurrent executions
- Individual progress tracking
- Aggregated results
- Mixed success/failure handling

**Example use cases:**
- Explore multiple codebase areas
- Compare different implementations
- Parallel code reviews

**Output:**
```
Available Subagents (parallel):
  2 agents

✓ scout (user) - Found models
✓ scout (user) - Found providers

Total: 2 turns ↑950 ↓2000 R0 W0 $0.003
```

### Chain Mode

**Best for:** Multi-step workflows with dependencies

**Features:**
- Sequential execution
- Output passing via `{previous}`
- Stops on first failure
- Step-by-step tracking

**Example use cases:**
- Scout → Plan → Implement
- Find → Review → Refactor
- Analyze → Document → Test

**Output:**
```
Step 1 (✓): scout
  Found authentication code in /src/auth/

Step 2 (✓): planner
  Plan:
  1. Review auth middleware
  2. Add OAuth support
  3. Update tests

Step 3 (✓): worker
  Implementation complete
```

## Security Model

### Trust Levels

**User-level subagents** (`~/.config/friend/subagents/`)
- ✅ Always trusted
- ✅ User-controlled directory
- ✅ No confirmation required
- ✅ Runs with full user permissions

**Workspace-level subagents** (`{workspace}/subagents/`)
- ⚠️ Requires explicit opt-in
- ⚠️ Directory-controlled (can be in version control)
- ⚠️ Confirmation dialog shown
- ⚠️ Source directory displayed

### Default Security

By default, only user-level subagents are accessible:

```json
{
  "agent": "scout",
  "task": "..."
  // agentScope defaults to "user"
}
```

### Security Parameters

#### `agentScope`

Controls which agents are discovered:

- `"user"` (default) - Only user-level agents
- `"workspace"` - Only workspace-level agents
- `"both"` - User + workspace (workspace takes precedence)

#### `confirmWorkspaceAgents`

Controls confirmation dialog for workspace agents:

- `true` (default) - Show confirmation before running
- `false` - Skip confirmation (use with caution)

### Confirmation Dialog

When workspace-level agents are requested:

```
┌─────────────────────────────────────┐
│ Run workspace-level agents?         │
├─────────────────────────────────────┤
│ Agents: custom-worker               │
│ Source: /project/workspace/subagents│
│                                     │
│ Workspace agents are directory-     │
│ controlled. Only continue for       │
│ trusted locations.                  │
├─────────────────────────────────────┤
│         [Cancel]  [Continue]        │
└─────────────────────────────────────┘
```

### Security Best Practices

**For Users:**
1. Keep `agentScope` as `"user"` (default)
2. Review workspace agents before approving
3. Only run agents from trusted directories
4. Check agent source in UI before relying on results

**For Developers:**
1. Never change default `agentScope`
2. Keep `confirmWorkspaceAgents` = `true` by default
3. Always display `agentSource` in results
4. Log workspace agent executions for audit

**For Administrators:**
1. Audit `workspace/subagents/` directories
2. Review agent definitions before deployment
3. Use file permissions to control agent access
4. Monitor subagent tool usage

## Built-in Subagents

### Scout 🏃

**Purpose:** Fast codebase reconnaissance

**Configuration:**
- Model: Claude Haiku 4.5 (fast & efficient)
- Tools: read, grep, find, ls, bash (read-only)
- Scope: Exploration and discovery

**Best for:**
- Quick exploration of unfamiliar code
- Finding files and patterns
- Answering "where is X?" questions
- Mapping codebase structure

**Example:**
```
Use scout to find all database queries in the codebase
```

### Planner 📋

**Purpose:** Create detailed implementation plans

**Configuration:**
- Model: Claude Sonnet 4.5
- Tools: read, grep, find, ls (read-only)
- Scope: Analysis and planning

**Best for:**
- Breaking down complex tasks
- Architectural planning
- Creating step-by-step guides
- Impact analysis

**Example:**
```
Use planner to create a plan for adding rate limiting to the API
```

### Reviewer 👀

**Purpose:** Code review and quality analysis

**Configuration:**
- Model: Claude Sonnet 4.5
- Tools: read, grep, find, ls, bash
- Scope: Quality assurance

**Best for:**
- Code review
- Security analysis
- Performance review
- Best practices checking

**Example:**
```
Use reviewer to check the authentication module for security issues
```

### Worker 🔧

**Purpose:** General-purpose implementation

**Configuration:**
- Model: Claude Sonnet 4.5
- Tools: All available (no restrictions)
- Scope: Implementation and execution

**Best for:**
- Implementing features
- Refactoring code
- Writing tests
- General development tasks

**Example:**
```
Use worker to implement the rate limiting feature based on the plan
```

## Advanced Usage

### Workflow Templates

#### Implement Feature
```
Chain: scout → planner → worker
1. Scout finds relevant code
2. Planner creates implementation plan
3. Worker implements the changes
```

#### Code Review Cycle
```
Chain: scout → reviewer → worker
1. Scout finds the code to review
2. Reviewer identifies issues
3. Worker fixes the issues
```

#### Refactor Flow
```
Parallel + Chain:
1. Run 2 scouts in parallel: find patterns, find usages
2. Planner creates refactoring plan based on findings
3. Worker implements refactoring
```

### Custom Agents for Specific Tasks

#### Database Migration Agent

```markdown
---
name: db-migrator
description: Creates database migration scripts
tools: read, write, bash
model: anthropic/claude-sonnet-4-5
---

You are a database migration specialist.

## Guidelines
1. Analyze existing schema
2. Create reversible migrations
3. Include rollback scripts
4. Follow project naming conventions

## Output
- Migration file: `YYYYMMDD_description.sql`
- Rollback file: `YYYYMMDD_description_rollback.sql`
```

#### Test Generator

```markdown
---
name: test-gen
description: Generates test files for existing code
tools: read, write, grep, find
model: anthropic/claude-sonnet-4-5
---

You are a test generation specialist.

## Guidelines
1. Analyze existing code
2. Identify test cases
3. Use project's test framework
4. Achieve good coverage
5. Include edge cases

## Output
Test file with comprehensive test suite.
```

## Performance & Usage

### Token Efficiency

Subagents use isolated contexts, so:
- Each agent starts fresh
- No context pollution between agents
- Efficient for parallel tasks
- Separate usage tracking per agent

### Usage Statistics

The system tracks for each execution:
- **Turns**: Number of LLM turns
- **Tokens**: Input/output/cache read/cache write
- **Cost**: Actual cost in dollars
- **Context**: Total context tokens used

**Example:**
```
1 turn ↑500 ↓1200 R100 W50 $0.002 ctx:1.7k
```

### Concurrency Limits

- **Parallel mode**: Max 4 concurrent agents
- **Chain mode**: Sequential (1 at a time)
- **Multiple sessions**: Unlimited independent sessions

## Troubleshooting

### Agent Not Found

**Problem:** "Unknown agent: 'my-agent'"

**Solutions:**
1. Check file exists in `~/.config/friend/subagents/my-agent.md`
2. Verify YAML frontmatter has `name` field
3. Run `/subagents` to list available agents
4. Check for typos in agent name

### Workspace Agents Not Loading

**Problem:** Workspace agents don't appear in `/subagents`

**Solutions:**
1. Verify directory structure: `{workspace}/subagents/*.md`
2. Check you're using correct scope: `/subagents workspace`
3. Ensure files have valid YAML frontmatter
4. Check file permissions

### Confirmation Dialog Not Showing

**Problem:** Workspace agents run without confirmation

**Solutions:**
1. Check `confirmWorkspaceAgents` parameter (should be `true`)
2. Verify `ctx.hasUI` is true
3. Check console for errors

### Execution Errors

**Problem:** "Session creation failed"

**Solutions:**
1. Check available disk space
2. Verify write permissions for temp directory
3. Check model is available and configured
4. Review system logs

## API Reference

### Tool Parameters

```typescript
{
  // Single mode
  agent?: string;          // Agent name
  task?: string;           // Task description
  
  // Parallel mode
  tasks?: Array<{
    agent: string;
    task: string;
    cwd?: string;
  }>;
  
  // Chain mode
  chain?: Array<{
    agent: string;
    task: string;
    cwd?: string;
  }>;
  
  // Security
  agentScope?: "user" | "workspace" | "both";
  confirmWorkspaceAgents?: boolean;
  
  // Optional
  cwd?: string;            // Working directory
}
```

### Result Structure

```typescript
{
  mode: "single" | "parallel" | "chain";
  agentScope: string;
  workspaceAgentsDir: string | null;
  results: Array<{
    agent: string;
    agentSource: "user" | "workspace" | "unknown";
    task: string;
    exitCode: number;
    messages: Message[];
    usage: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      cost: number;
      contextTokens: number;
      turns: number;
    };
    model?: string;
    errorMessage?: string;
  }>;
}
```

## Examples

### Example 1: Quick Codebase Exploration

```
User: Use scout to understand the authentication flow
AI: I'll use the scout agent to explore the authentication flow...

[Calls subagent tool]
{
  "agent": "scout",
  "task": "Find and analyze the authentication flow"
}

[Result]
✓ scout (user)
Found authentication flow:
1. Entry: /src/middleware/auth.ts
2. Login: /src/routes/auth.ts
3. Session: /src/utils/session.ts
4. Token validation: /src/services/auth.service.ts
```

### Example 2: Parallel Feature Discovery

```
User: Find all API endpoints and their corresponding tests
AI: I'll run two scouts in parallel to find endpoints and tests...

[Calls subagent tool]
{
  "tasks": [
    { "agent": "scout", "task": "Find all API endpoint definitions" },
    { "agent": "scout", "task": "Find all API test files" }
  ]
}

[Result]
✓ scout: Found 45 endpoints in /src/routes/
✓ scout: Found 38 test files in /tests/api/
7 endpoints missing tests: [list]
```

### Example 3: Implementation Workflow

```
User: Add input validation to the user registration endpoint
AI: I'll use a chain of agents to implement this safely...

[Calls subagent tool]
{
  "chain": [
    { "agent": "scout", "task": "Find the user registration endpoint" },
    { "agent": "planner", "task": "Create validation plan for: {previous}" },
    { "agent": "worker", "task": "Implement: {previous}" }
  ]
}

[Result]
Step 1 (✓): Found /src/routes/users.ts
Step 2 (✓): Validation plan created
Step 3 (✓): Implementation complete

Changes:
- Added email validation
- Added password strength check
- Added username format validation
- Tests updated
```

## Best Practices

1. **Choose the right agent for the task**
   - Scout for exploration
   - Planner for complex decisions
   - Reviewer for quality checks
   - Worker for implementation

2. **Use parallel mode wisely**
   - Independent tasks only
   - Max 4 for efficiency
   - Monitor resource usage

3. **Chain for workflows**
   - Clear dependencies
   - Handle failures gracefully
   - Use `{previous}` for context

4. **Security first**
   - Default to user-level agents
   - Review workspace agents carefully
   - Check agent source in results

5. **Optimize context usage**
   - Each agent has isolated context
   - Parallel saves time but uses more tokens
   - Chain passes minimal necessary context

## FAQ

**Q: Can subagents call other subagents?**  
A: Currently no. Subagents run in isolation and cannot invoke other subagents.

**Q: How do I share agents across projects?**  
A: Use user-level agents (`~/.config/friend/subagents/`) which are available globally.

**Q: Can I use a different model for specific tasks?**  
A: Yes! Specify the `model` field in the agent's frontmatter.

**Q: What happens if a chain step fails?**  
A: Execution stops at the failed step. Previous steps' results are preserved.

**Q: Are subagent executions logged?**  
A: Yes, console logs show execution details. Usage is tracked per agent.

**Q: Can I limit tool access?**  
A: Yes! Use the `tools` field in frontmatter to restrict available tools.

## Changelog

### v1.0.0 (2026-02-14)
- Initial implementation
- Three execution modes: single, parallel, chain
- Security model with user/workspace scopes
- Built-in agents: scout, planner, reviewer, worker
- Frontend result display
- 31 unit tests

---

For more information, see:
- [Friend Documentation](https://github.com/likefriend/friend)
- [pi-mono Subagent Reference](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent)
