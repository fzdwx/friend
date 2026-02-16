/**
 * Error Types and Utilities
 *
 * Provides structured error handling with:
 * - Custom error classes for different categories
 * - Error factory functions
 * - Error utilities for catching and wrapping
 *
 * Based on shared AppError types from @friend/shared
 */

import type { AppError, ErrorCategory, ErrorCode, Result } from "@friend/shared";
import { ErrorCodes } from "@friend/shared";

// Re-export from shared for convenience
export type { AppError, ErrorCategory, ErrorCode, Result };
export { ErrorCodes } from "@friend/shared";

// ─── Custom Error Classes ────────────────────────────────────

/**
 * Base application error class
 */
export class ApplicationError extends Error {
  public readonly category: ErrorCategory;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly cause?: Error;

  constructor(
    category: ErrorCategory,
    code: string,
    message: string,
    options?: { details?: unknown; cause?: Error }
  ) {
    super(message);
    this.name = "ApplicationError";
    this.category = category;
    this.code = code;
    this.details = options?.details;
    this.cause = options?.cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApplicationError);
    }
  }

  /**
   * Convert to AppError interface
   */
  toAppError(): AppError {
    return {
      category: this.category,
      code: this.code,
      message: this.message,
      details: this.details,
      cause: this.cause,
    };
  }

  /**
   * Create from AppError interface
   */
  static fromAppError(error: AppError): ApplicationError {
    return new ApplicationError(error.category, error.code, error.message, {
      details: error.details,
      cause: error.cause,
    });
  }
}

/**
 * Validation error
 */
export class ValidationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super("validation", ErrorCodes.INVALID_INPUT, message, { details });
    this.name = "ValidationError";
  }
}

/**
 * Not found error
 */
export class NotFoundError extends ApplicationError {
  constructor(
    resource: string,
    identifier?: string,
    code: string = ErrorCodes.SESSION_NOT_FOUND
  ) {
    const message = identifier
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;
    super("not_found", code, message, {
      details: { resource, identifier },
    });
    this.name = "NotFoundError";
  }
}

/**
 * Conflict error (duplicate, already exists, etc.)
 */
export class ConflictError extends ApplicationError {
  constructor(message: string, code: string = ErrorCodes.SESSION_EXISTS, details?: unknown) {
    super("conflict", code, message, { details });
    this.name = "ConflictError";
  }
}

/**
 * External service error (API, network, etc.)
 */
export class ExternalError extends ApplicationError {
  constructor(service: string, message: string, code: string = ErrorCodes.API_ERROR, details?: unknown) {
    super("external", code, `${service}: ${message}`, { details });
    this.name = "ExternalError";
  }
}

/**
 * Internal server error
 */
export class InternalError extends ApplicationError {
  constructor(message: string, code: string = ErrorCodes.INTERNAL_ERROR, cause?: Error) {
    super("internal", code, message, { cause });
    this.name = "InternalError";
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends ApplicationError {
  constructor(operation: string, timeoutMs: number) {
    super("timeout", ErrorCodes.TIMEOUT, `${operation} timed out after ${timeoutMs}ms`, {
      details: { operation, timeoutMs },
    });
    this.name = "TimeoutError";
  }
}

/**
 * Cancelled error
 */
export class CancelledError extends ApplicationError {
  constructor(message: string = "Operation cancelled") {
    super("cancelled", ErrorCodes.CANCELLED, message);
    this.name = "CancelledError";
  }
}

// ─── Error Factory Functions ─────────────────────────────────

/**
 * Create a session not found error
 */
export function sessionNotFound(sessionId: string): NotFoundError {
  return new NotFoundError("Session", sessionId, ErrorCodes.SESSION_NOT_FOUND);
}

/**
 * Create an agent not found error
 */
export function agentNotFound(agentId: string): NotFoundError {
  return new NotFoundError("Agent", agentId, ErrorCodes.AGENT_NOT_FOUND);
}

/**
 * Create a skill not found error
 */
export function skillNotFound(skillName: string): NotFoundError {
  return new NotFoundError("Skill", skillName, ErrorCodes.SKILL_NOT_FOUND);
}

/**
 * Create a cron job not found error
 */
export function cronJobNotFound(jobId: string): NotFoundError {
  return new NotFoundError("Cron job", jobId, ErrorCodes.CRON_JOB_NOT_FOUND);
}

/**
 * Create a provider not found error
 */
export function providerNotFound(name: string): NotFoundError {
  return new NotFoundError("Provider", name, ErrorCodes.PROVIDER_NOT_FOUND);
}

/**
 * Create a theme not found error
 */
export function themeNotFound(themeId: string): NotFoundError {
  return new NotFoundError("Theme", themeId, ErrorCodes.THEME_NOT_FOUND);
}

/**
 * Create a provider already exists error
 */
export function providerExists(name: string): ConflictError {
  return new ConflictError(`Provider "${name}" already exists`, ErrorCodes.PROVIDER_EXISTS);
}

/**
 * Create an API error
 */
export function apiError(service: string, message: string, details?: unknown): ExternalError {
  return new ExternalError(service, message, ErrorCodes.API_ERROR, details);
}

/**
 * Create a network error
 */
export function networkError(message: string, cause?: Error): ExternalError {
  return new ExternalError("Network", message, ErrorCodes.NETWORK_ERROR, { cause });
}

/**
 * Create a database error
 */
export function dbError(message: string, cause?: Error): InternalError {
  return new InternalError(message, ErrorCodes.DB_ERROR, cause);
}

// ─── Error Utilities ──────────────────────────────────────────

/**
 * Check if an error is an ApplicationError
 */
export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}

/**
 * Check if an error has a specific code
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  if (isApplicationError(error)) {
    return error.code === code;
  }
  return false;
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

/**
 * Extract error details for logging
 */
export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (isApplicationError(error)) {
    return {
      category: error.category,
      code: error.code,
      message: error.message,
      details: error.details,
      stack: error.stack,
      cause: error.cause ? getErrorDetails(error.cause) : undefined,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { error: String(error) };
}

/**
 * Wrap an unknown error in an ApplicationError
 */
export function wrapError(
  error: unknown,
  category: ErrorCategory = "internal",
  code: string = ErrorCodes.INTERNAL_ERROR,
  message?: string
): ApplicationError {
  if (isApplicationError(error)) {
    return error;
  }

  const errorMessage = message ?? getErrorMessage(error);
  const cause = error instanceof Error ? error : undefined;

  return new ApplicationError(category, code, errorMessage, { cause });
}

/**
 * Safely catch errors and return Result type
 */
export async function tryAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, ApplicationError>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: wrapError(error) };
  }
}

/**
 * Safely catch sync operations and return Result type
 */
export function trySync<T>(fn: () => T): Result<T, ApplicationError> {
  try {
    const value = fn();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: wrapError(error) };
  }
}

// ─── Error Predicates ─────────────────────────────────────────

/**
 * Type guard for not found errors
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Type guard for validation errors
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard for external errors
 */
export function isExternalError(error: unknown): error is ExternalError {
  return error instanceof ExternalError;
}

/**
 * Type guard for timeout errors
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Type guard for cancelled errors
 */
export function isCancelledError(error: unknown): error is CancelledError {
  return error instanceof CancelledError;
}
