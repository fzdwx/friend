/**
 * Structured Logger
 *
 * Provides structured logging with:
 * - Log levels (debug, info, warn, error)
 * - Structured output with context
 * - Performance timing utilities
 * - Child loggers with inherited context
 */

// ─── Log Levels ──────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ─── Log Entry Types ──────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
}

// ─── Logger Options ───────────────────────────────────────────

export interface LoggerOptions {
  /** Minimum log level to output (default: "info") */
  level?: LogLevel;
  /** Include timestamp in output (default: true) */
  timestamp?: boolean;
  /** Output format: "json" or "pretty" (default: "pretty") */
  format?: "json" | "pretty";
  /** Prefix for all log messages */
  prefix?: string;
  /** Default context to include in all logs */
  context?: Record<string, unknown>;
  /** Custom output stream (default: console) */
  output?: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

// ─── Logger Class ─────────────────────────────────────────────

export class Logger {
  private readonly level: LogLevel;
  private readonly timestamp: boolean;
  private readonly format: "json" | "pretty";
  private readonly prefix: string;
  private readonly context: Record<string, unknown>;
  private readonly output: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.timestamp = options.timestamp ?? true;
    this.format = options.format ?? "pretty";
    this.prefix = options.prefix ?? "";
    this.context = options.context ?? {};
    this.output = options.output ?? console;
  }

  /**
   * Create a child logger with inherited context
   */
  child(context: Record<string, unknown> = {}): Logger {
    return new Logger({
      level: this.level,
      timestamp: this.timestamp,
      format: this.format,
      prefix: this.prefix,
      context: { ...this.context, ...context },
      output: this.output,
    });
  }

  /**
   * Create a prefixed child logger
   */
  withPrefix(prefix: string): Logger {
    return new Logger({
      level: this.level,
      timestamp: this.timestamp,
      format: this.format,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      context: this.context,
      output: this.output,
    });
  }

  // ─── Log Methods ────────────────────────────────────────────

  debug(message: string, context?: Record<string, unknown>): void;
  debug(context: Record<string, unknown>, message: string): void;
  debug(arg1: string | Record<string, unknown>, arg2?: Record<string, unknown> | string): void {
    this.log("debug", arg1, arg2);
  }

  info(message: string, context?: Record<string, unknown>): void;
  info(context: Record<string, unknown>, message: string): void;
  info(arg1: string | Record<string, unknown>, arg2?: Record<string, unknown> | string): void {
    this.log("info", arg1, arg2);
  }

  warn(message: string, context?: Record<string, unknown>): void;
  warn(context: Record<string, unknown>, message: string): void;
  warn(arg1: string | Record<string, unknown>, arg2?: Record<string, unknown> | string): void {
    this.log("warn", arg1, arg2);
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  error(arg1: string, arg2?: Error | unknown | Record<string, unknown>, arg3?: Record<string, unknown>): void {
    if (arg2 instanceof Error) {
      this.logError(arg1, arg2, arg3);
    } else if (arg2 && typeof arg2 === "object" && !("message" in arg2)) {
      this.log("error", arg1, arg2 as Record<string, unknown>);
    } else if (arg2) {
      this.logError(arg1, arg2 as Error, arg3);
    } else {
      this.log("error", arg1);
    }
  }

  // ─── Timing Utilities ───────────────────────────────────────

  /**
   * Start a timer and return a function to log the duration
   */
  time(label: string): (context?: Record<string, unknown>) => void {
    const start = Date.now();
    return (context?: Record<string, unknown>) => {
      const duration = Date.now() - start;
      this.debug(`[${label}] completed`, { duration, ...context });
    };
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(
    label: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug(`[${label}] completed`, { duration, success: true, ...context });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`[${label}] failed`, error, { duration, success: false, ...context });
      throw error;
    }
  }

  // ─── Internal Methods ───────────────────────────────────────

  private log(
    level: LogLevel,
    arg1: string | Record<string, unknown>,
    arg2?: Record<string, unknown> | string
  ): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
      return;
    }

    const { message, context } = this.parseArgs(arg1, arg2);
    const entry = this.createEntry(level, message, context);
    this.outputEntry(entry);
  }

  private logError(
    message: string,
    error: Error | unknown,
    context?: Record<string, unknown>
  ): void {
    const level: LogLevel = "error";
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
      return;
    }

    const entry = this.createEntry(level, message, context);

    if (error instanceof Error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as unknown as Record<string, unknown>).code as string | undefined,
      };
    } else {
      entry.error = {
        message: String(error),
      };
    }

    this.outputEntry(entry);
  }

  private parseArgs(
    arg1: string | Record<string, unknown>,
    arg2?: Record<string, unknown> | string
  ): { message: string; context?: Record<string, unknown> } {
    if (typeof arg1 === "string") {
      return { message: arg1, context: arg2 as Record<string, unknown> | undefined };
    }
    return { message: arg2 as string, context: arg1 };
  }

  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.prefix ? `[${this.prefix}] ${message}` : message,
    };

    if (Object.keys(this.context).length > 0 || context) {
      entry.context = { ...this.context, ...context };
    }

    return entry;
  }

  private outputEntry(entry: LogEntry): void {
    if (this.format === "json") {
      const output = JSON.stringify(entry);
      if (entry.level === "error") {
        this.output.error(output);
      } else {
        this.output.log(output);
      }
      return;
    }

    // Pretty format
    const timestamp = this.timestamp ? `${entry.timestamp} ` : "";
    const levelStr = this.formatLevel(entry.level);
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const errorStr = entry.error ? ` | Error: ${entry.error.message}` : "";

    const output = `${timestamp}${levelStr} ${entry.message}${contextStr}${errorStr}`;

    if (entry.level === "error") {
      this.output.error(output);
      if (entry.error?.stack) {
        this.output.error(entry.error.stack);
      }
    } else {
      this.output.log(output);
    }
  }

  private formatLevel(level: LogLevel): string {
    switch (level) {
      case "debug":
        return "🔍 DEBUG";
      case "info":
        return "ℹ️  INFO";
      case "warn":
        return "⚠️  WARN";
      case "error":
        return "❌ ERROR";
    }
  }
}

// ─── Default Logger Instance ──────────────────────────────────

/**
 * Default logger instance
 */
export const logger = new Logger({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.LOG_FORMAT === "json" ? "json" : "pretty",
});

// ─── Convenience Functions ─────────────────────────────────────

/**
 * Create a new logger with options
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

/**
 * Create a prefixed logger
 */
export function createPrefixedLogger(prefix: string, options?: LoggerOptions): Logger {
  return new Logger({ ...options, prefix });
}

// ─── Domain-Specific Loggers ──────────────────────────────────

/**
 * Agent logger for agent-related operations
 */
export const agentLogger = logger.withPrefix("agent");

/**
 * Session logger for session operations
 */
export const sessionLogger = logger.withPrefix("session");

/**
 * Skill logger for skill operations
 */
export const skillLogger = logger.withPrefix("skill");

/**
 * Cron logger for cron operations
 */
export const cronLogger = logger.withPrefix("cron");

/**
 * Memory logger for memory operations
 */
export const memoryLogger = logger.withPrefix("memory");

/**
 * API logger for external API calls
 */
export const apiLogger = logger.withPrefix("api");
