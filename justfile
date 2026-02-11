# Friend - AI Coding Agent Desktop App

set dotenv-load := false

# 默认列出所有命令
default:
    @just --list

# ── 开发 ──────────────────────────────────────────

# 同时启动 server + frontend dev
dev:
    just dev-server &
    just dev-app

# 启动 Bun 后端 (watch mode, port 3001)
dev-server:
    cd packages/server && bun run --watch src/index.ts

# 启动 Vite 前端 (port 5173)
dev-app:
    cd packages/app && bunx vite

# 启动 Tauri 桌面应用 (需先启动 dev-server)
dev-tauri:
    cd packages/app && cargo tauri dev

# ── 构建 ──────────────────────────────────────────

# 构建前端
build-app:
    cd packages/app && bunx vite build

# 构建 Tauri 桌面应用
build-tauri:
    cd packages/app && cargo tauri build

# ── 格式化 & Lint ─────────────────────────────────

# 格式化所有代码 (oxfmt)
fmt:
    bunx oxfmt packages/

# 格式化并检查 (不写入)
fmt-check:
    bunx oxfmt --check packages/

# Lint 所有代码 (oxlint)
lint:
    bunx oxlint packages/ --ignore-pattern="**/node_modules/**" --ignore-pattern="**/dist/**" --ignore-pattern="**/target/**"

# 格式化 + lint
check: fmt-check lint

# 格式化 + lint 自动修复
fix: fmt
    bunx oxlint --fix packages/ --ignore-pattern="**/node_modules/**" --ignore-pattern="**/dist/**" --ignore-pattern="**/target/**"

# ── 类型检查 ──────────────────────────────────────

# 类型检查所有包
typecheck:
    bun run --filter '*' typecheck

# 类型检查 server
typecheck-server:
    bun run --filter @friend/server typecheck

# 类型检查 app
typecheck-app:
    bun run --filter @friend/app typecheck

# ── 数据库 ──────────────────────────────────────────

# 生成 Prisma Client
db-generate:
    cd packages/db && bunx prisma generate

# 推送 schema 到数据库 (开发用，无 migration)
db-push:
    cd packages/db && bunx prisma db push

# 创建并运行 migration
db-migrate name="":
    cd packages/db && bunx prisma migrate dev {{ if name != "" { "--name " + name } else { "" } }}

# 打开 Prisma Studio
db-studio:
    cd packages/db && bunx prisma studio

# 重置数据库
db-reset:
    cd packages/db && bunx prisma migrate reset

# ── 依赖管理 ──────────────────────────────────────

# 安装所有依赖
install:
    bun install

# ── 清理 ──────────────────────────────────────────

# 清理构建产物
clean:
    rm -rf packages/app/dist
    rm -rf packages/app/src-tauri/target
    rm -rf packages/shared/dist
    rm -rf packages/server/dist

# 清理所有 (含 node_modules)
clean-all: clean
    rm -rf node_modules
    rm -rf packages/*/node_modules
