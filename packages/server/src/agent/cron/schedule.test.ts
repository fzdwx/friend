import { describe, test, expect } from "bun:test";
import { computeNextRunAtMs, describeSchedule } from "./schedule.js";
import type { CronSchedule } from "./types.js";

// ─── Tests ────────────────────────────────────────────────────────

describe("computeNextRunAtMs", () => {
  const now = Date.now();

  describe("At Schedule (one-time)", () => {
    test("returns the scheduled time if in the future", () => {
      const futureTime = now + 60_000;  // 1 minute from now
      const schedule: CronSchedule = { kind: "at", atMs: futureTime };

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBe(futureTime);
    });

    test("returns undefined if the time has passed", () => {
      const pastTime = now - 60_000;  // 1 minute ago
      const schedule: CronSchedule = { kind: "at", atMs: pastTime };

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBeUndefined();
    });

    test("returns undefined for exact current time", () => {
      const schedule: CronSchedule = { kind: "at", atMs: now };

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBeUndefined();
    });
  });

  describe("Every Schedule (recurring)", () => {
    test("returns next interval without anchor", () => {
      const everyMs = 60_000;  // 1 minute
      const schedule: CronSchedule = { kind: "every", everyMs };

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBe(now + everyMs);
    });

    test("returns next interval with anchor", () => {
      const everyMs = 60_000;  // 1 minute
      const anchorMs = now - 30_000;  // 30 seconds ago
      const schedule: CronSchedule = { kind: "every", everyMs, anchorMs };

      const result = computeNextRunAtMs(schedule, now);

      // Should align to anchor: anchor + 1 minute = now + 30 seconds
      expect(result).toBe(anchorMs + everyMs);
    });

    test("returns undefined for zero interval", () => {
      const schedule: CronSchedule = { kind: "every", everyMs: 0 };

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBeUndefined();
    });

    test("returns undefined for negative interval", () => {
      const schedule: CronSchedule = { kind: "every", everyMs: -1000 };

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBeUndefined();
    });

    test("aligns multiple periods correctly", () => {
      const everyMs = 60_000;  // 1 minute
      const anchorMs = now - 150_000;  // 2.5 minutes ago
      const schedule: CronSchedule = { kind: "every", everyMs, anchorMs };

      const result = computeNextRunAtMs(schedule, now);

      // Should be anchor + 3 minutes (3 periods)
      expect(result).toBe(anchorMs + 3 * everyMs);
    });
  });

  describe("Cron Expression Schedule", () => {
    test("parses valid cron expression", () => {
      // Every minute
      const schedule: CronSchedule = { kind: "cron", expr: "* * * * *" };

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBeDefined();
      expect(result!).toBeGreaterThan(now);
    });

    test("parses daily cron expression", () => {
      // Every day at 9am
      const schedule: CronSchedule = { kind: "cron", expr: "0 9 * * *" };

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBeDefined();
      expect(result!).toBeGreaterThan(now);
    });

    test("returns undefined for invalid cron expression", () => {
      const schedule: CronSchedule = { kind: "cron", expr: "invalid" };

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBeUndefined();
    });

    test("respects timezone option", () => {
      // Every hour at the top of the hour
      const schedule: CronSchedule = { kind: "cron", expr: "0 * * * *", tz: "UTC" };

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBeDefined();
      expect(result!).toBeGreaterThan(now);
    });
  });

  describe("Unknown schedule kind", () => {
    test("returns undefined for unknown kind", () => {
      const schedule = { kind: "unknown" } as unknown as CronSchedule;

      const result = computeNextRunAtMs(schedule, now);

      expect(result).toBeUndefined();
    });
  });
});

describe("describeSchedule", () => {
  test("describes at schedule", () => {
    const futureTime = Date.now() + 60_000;
    const schedule: CronSchedule = { kind: "at", atMs: futureTime };

    const result = describeSchedule(schedule);

    expect(result).toContain("once at");
  });

  test("describes every schedule in seconds", () => {
    const schedule: CronSchedule = { kind: "every", everyMs: 30_000 };  // 30 seconds

    const result = describeSchedule(schedule);

    expect(result).toBe("every 30s");
  });

  test("describes every schedule in minutes", () => {
    const schedule: CronSchedule = { kind: "every", everyMs: 300_000 };  // 5 minutes

    const result = describeSchedule(schedule);

    expect(result).toBe("every 5m");
  });

  test("describes every schedule in hours", () => {
    const schedule: CronSchedule = { kind: "every", everyMs: 7_200_000 };  // 2 hours

    const result = describeSchedule(schedule);

    expect(result).toBe("every 2h");
  });

  test("describes cron expression schedule", () => {
    const schedule: CronSchedule = { kind: "cron", expr: "0 9 * * *" };

    const result = describeSchedule(schedule);

    expect(result).toBe("cron: 0 9 * * *");
  });

  test("describes unknown schedule", () => {
    const schedule = { kind: "unknown" } as unknown as CronSchedule;

    const result = describeSchedule(schedule);

    expect(result).toBe("unknown schedule");
  });
});
