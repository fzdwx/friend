import { describe, test, expect } from "bun:test";
import { getErrorBackoffMs, ERROR_BACKOFF_SCHEDULE_MS, MAX_SCHEDULE_ERRORS } from "./types.js";

// ─── Tests ────────────────────────────────────────────────────────

describe("getErrorBackoffMs", () => {
  test("returns 30s for 1st error", () => {
    expect(getErrorBackoffMs(1)).toBe(30_000);
  });

  test("returns 1 min for 2nd error", () => {
    expect(getErrorBackoffMs(2)).toBe(60_000);
  });

  test("returns 5 min for 3rd error", () => {
    expect(getErrorBackoffMs(3)).toBe(5 * 60_000);
  });

  test("returns 15 min for 4th error", () => {
    expect(getErrorBackoffMs(4)).toBe(15 * 60_000);
  });

  test("returns 60 min for 5th error", () => {
    expect(getErrorBackoffMs(5)).toBe(60 * 60_000);
  });

  test("stays at 60 min for 6th+ error", () => {
    expect(getErrorBackoffMs(6)).toBe(60 * 60_000);
    expect(getErrorBackoffMs(10)).toBe(60 * 60_000);
    expect(getErrorBackoffMs(100)).toBe(60 * 60_000);
  });

  test("handles 0 errors gracefully", () => {
    // Should return first entry (30s) even for 0
    expect(getErrorBackoffMs(0)).toBe(30_000);
  });

  test("handles negative errors gracefully", () => {
    // Should return first entry (30s) for negative values
    expect(getErrorBackoffMs(-1)).toBe(30_000);
  });
});

describe("Constants", () => {
  test("ERROR_BACKOFF_SCHEDULE_MS has 5 entries", () => {
    expect(ERROR_BACKOFF_SCHEDULE_MS.length).toBe(5);
  });

  test("MAX_SCHEDULE_ERRORS is 3", () => {
    expect(MAX_SCHEDULE_ERRORS).toBe(3);
  });

  test("backoff schedule increases progressively", () => {
    for (let i = 1; i < ERROR_BACKOFF_SCHEDULE_MS.length; i++) {
      expect(ERROR_BACKOFF_SCHEDULE_MS[i]).toBeGreaterThan(ERROR_BACKOFF_SCHEDULE_MS[i - 1]);
    }
  });
});
