/**
 * Plan Mode Manager
 * 
 * Handles plan mode state management and transitions.
 */

import type { PlanModeState } from "@friend/shared";
import type { TodoItem, NORMAL_MODE_TOOLS, PLAN_MODE_TOOLS } from "../extensions/plan-mode.js";
import type { IPlanModeManager, PlanModeManagerDeps, ManagedSession } from "./types.js";

export class PlanModeManager implements IPlanModeManager {
  private planModeStates = new Map<string, PlanModeState>();
  private readonly deps: PlanModeManagerDeps;

  constructor(deps: PlanModeManagerDeps) {
    this.deps = deps;
  }

  getState(sessionId: string): PlanModeState {
    return this.planModeStates.get(sessionId) ?? { 
      enabled: false, 
      executing: false, 
      modifying: false, 
      todos: [] 
    };
  }

  setState(sessionId: string, state: PlanModeState): void {
    this.planModeStates.set(sessionId, state);
    
    // Update ManagedSession if it exists
    const managed = this.deps.getManagedSession(sessionId);
    if (managed) {
      managed.planModeState = state;
    }

    // Broadcast state change
    this.broadcastState(sessionId, state);

    // Persist to database (fire-and-forget)
    this.deps.saveState(sessionId, state).catch(err => {
      console.error(`[PlanModeManager] Failed to persist state:`, err);
    });
  }

  private broadcastState(sessionId: string, state: PlanModeState): void {
    const managed = this.deps.getManagedSession(sessionId);
    if (!managed) return;

    this.deps.broadcast(managed, {
      type: "plan_mode_state_changed",
      enabled: state.enabled,
      executing: state.executing,
      modifying: state.modifying,
      todos: state.todos,
    });
  }

  handlePlanReady(sessionId: string, todos: TodoItem[]): void {
    const managed = this.deps.getManagedSession(sessionId);
    if (!managed) return;

    this.deps.broadcast(managed, {
      type: "plan_mode_request_choice",
      todos,
    });
  }

  handlePlanProgress(sessionId: string, todos: TodoItem[]): void {
    const managed = this.deps.getManagedSession(sessionId);
    if (!managed) return;

    const completed = todos.filter(t => t.completed).length;
    this.deps.broadcast(managed, {
      type: "plan_mode_progress",
      completed,
      total: todos.length,
    });
  }

  handlePlanComplete(sessionId: string, todos: TodoItem[]): void {
    const managed = this.deps.getManagedSession(sessionId);
    if (!managed) return;

    this.deps.broadcast(managed, {
      type: "plan_mode_complete",
      todos,
    });
  }

  async executePlan(sessionId: string, todos?: TodoItem[]): Promise<void> {
    const managed = this.deps.getManagedSession(sessionId);
    if (!managed) throw new Error(`Session ${sessionId} not found`);

    const currentState = this.getState(sessionId);
    const targetTodos = todos ?? currentState.todos;

    // Switch to execution mode
    const newState: PlanModeState = {
      enabled: false,
      executing: true,
      modifying: false,
      todos: targetTodos,
    };
    this.setState(sessionId, newState);
    
    // Switch to normal tools
    // Note: The actual tool switching is done by the caller (AgentManager)
    // because we need access to session.setActiveToolsByName

    // Send message to trigger execution
    const firstStep = targetTodos.find(t => !t.completed);
    const execMessage = firstStep
      ? `Execute the plan. Start with: ${firstStep.text}`
      : "Execute the plan.";

    if (managed.session.isStreaming) {
      await managed.session.followUp(execMessage);
    } else {
      await managed.session.prompt(execMessage);
    }
  }

  cancelPlan(sessionId: string): void {
    const managed = this.deps.getManagedSession(sessionId);
    if (!managed) return;

    this.setState(sessionId, { 
      enabled: false, 
      executing: false, 
      modifying: false, 
      todos: [] 
    });
    
    // Note: Tool switching is done by the caller
  }

  async modifyPlan(sessionId: string, message: string): Promise<void> {
    const managed = this.deps.getManagedSession(sessionId);
    if (!managed) return;

    const currentState = this.getState(sessionId);

    // Set modifying state
    this.setState(sessionId, {
      ...currentState,
      modifying: true,
      modifyMessage: message,
    });

    // Send the modification as a followUp
    await managed.session.followUp(message);
  }

  /**
   * Restore state from database (called during init)
   */
  restoreState(sessionId: string, state: PlanModeState): void {
    if (state.enabled || state.executing) {
      this.planModeStates.set(sessionId, state);
      console.log(`[PlanModeManager] Restored state for session ${sessionId}`);
    }
  }

  /**
   * Check if session has active plan state
   */
  hasActivePlan(sessionId: string): boolean {
    const state = this.getState(sessionId);
    return state.enabled || state.executing;
  }
}
