/**
 * System Events Queue
 * 
 * Lightweight in-memory queue for system events that should be
 * injected into agent context without appearing in chat history.
 * 
 * Inspired by OpenClaw's system-events.ts:
 * - Events are ephemeral (memory-only, not persisted)
 * - Drained on next prompt or heartbeat
 * - Per-agent queue isolation
 * - Max 20 events per queue
 */

// ─── Types ───────────────────────────────────────────────────

export interface SystemEvent {
  text: string;      // Event content
  ts: number;        // Timestamp (ms)
}

interface SessionQueue {
  queue: SystemEvent[];
  lastText: string | null;  // For deduplication
}

// ─── Constants ───────────────────────────────────────────────

const MAX_EVENTS = 20;

// ─── SystemEventQueue Class ───────────────────────────────────

/**
 * Manages system events for agents.
 * Events are stored in memory and drained when injected into context.
 */
export class SystemEventQueue {
  private queues = new Map<string, SessionQueue>();

  /**
   * Enqueue a system event for an agent.
   * 
   * @param agentId - The agent ID
   * @param text - The event text
   * 
   * Events are deduplicated (consecutive identical events are skipped).
   * Maximum 20 events per agent (oldest removed when exceeded).
   */
  enqueue(agentId: string, text: string): void {
    const cleaned = text.trim();
    if (!cleaned) {
      return;
    }

    // Get or create queue
    let entry = this.queues.get(agentId);
    if (!entry) {
      entry = {
        queue: [],
        lastText: null,
      };
      this.queues.set(agentId, entry);
    }

    // Skip consecutive duplicates
    if (entry.lastText === cleaned) {
      return;
    }

    // Add event
    entry.lastText = cleaned;
    entry.queue.push({ text: cleaned, ts: Date.now() });

    // Enforce max limit
    if (entry.queue.length > MAX_EVENTS) {
      entry.queue.shift();
    }

    console.log(`[SystemEvents] Enqueued event for agent ${agentId}: ${cleaned.substring(0, 50)}...`);
  }

  /**
   * Drain all system events for an agent.
   * 
   * @param agentId - The agent ID
   * @returns Array of system events (emptied from queue)
   * 
   * After draining, the queue is cleared and removed from memory.
   */
  drain(agentId: string): SystemEvent[] {
    const entry = this.queues.get(agentId);
    if (!entry || entry.queue.length === 0) {
      return [];
    }

    // Extract events
    const events = entry.queue.slice();

    // Clear queue
    entry.queue.length = 0;
    entry.lastText = null;
    this.queues.delete(agentId);

    console.log(`[SystemEvents] Drained ${events.length} events for agent ${agentId}`);
    return events;
  }

  /**
   * Check if an agent has pending system events.
   * 
   * @param agentId - The agent ID
   * @returns true if there are pending events
   */
  has(agentId: string): boolean {
    const entry = this.queues.get(agentId);
    return entry !== undefined && entry.queue.length > 0;
  }

  /**
   * Peek at system events without draining.
   * 
   * @param agentId - The agent ID
   * @returns Array of event texts (not drained)
   */
  peek(agentId: string): string[] {
    const entry = this.queues.get(agentId);
    if (!entry) {
      return [];
    }
    return entry.queue.map(e => e.text);
  }

  /**
   * Clear all events for an agent.
   * 
   * @param agentId - The agent ID
   */
  clear(agentId: string): void {
    this.queues.delete(agentId);
  }

  /**
   * Get the number of pending events for an agent.
   * 
   * @param agentId - The agent ID
   * @returns Number of pending events
   */
  count(agentId: string): number {
    const entry = this.queues.get(agentId);
    return entry ? entry.queue.length : 0;
  }

  /**
   * Format system events as context string for injection.
   * 
   * @param events - Array of system events
   * @returns Formatted string for agent context
   */
  static formatAsContext(events: SystemEvent[]): string {
    if (events.length === 0) {
      return "";
    }

    const lines = events.map((e, i) => {
      const time = new Date(e.ts).toLocaleTimeString();
      return `[${i + 1}] ${e.text} (${time})`;
    });

    return `系统事件提醒：\n${lines.join('\n')}\n\n请根据上述事件采取行动或回复。`;
  }
}

// ─── Singleton Instance ──────────────────────────────────────

/**
 * Global system event queue instance.
 * Used by cron jobs, heartbeat, and other background tasks.
 */
export const globalSystemEventQueue = new SystemEventQueue();

// ─── Helper Functions ─────────────────────────────────────────

/**
 * Enqueue a system event using the global queue.
 * Convenience function for direct usage.
 */
export function enqueueSystemEvent(agentId: string, text: string): void {
  globalSystemEventQueue.enqueue(agentId, text);
}

/**
 * Drain system events using the global queue.
 * Convenience function for direct usage.
 */
export function drainSystemEvents(agentId: string): SystemEvent[] {
  return globalSystemEventQueue.drain(agentId);
}

/**
 * Check if agent has pending system events.
 * Convenience function for direct usage.
 */
export function hasSystemEvents(agentId: string): boolean {
  return globalSystemEventQueue.has(agentId);
}
