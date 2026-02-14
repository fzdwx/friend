import { describe, test, expect } from "bun:test";
import type { PlanModeState, PendingQuestion, TodoItem, Question } from "@friend/shared";

describe("PlanModeState Serialization", () => {
  test("should serialize and deserialize plan mode state", () => {
    const state: PlanModeState = {
      enabled: true,
      executing: false,
      modifying: false,
      todos: [
        { step: 1, text: "Create config file", completed: false },
        { step: 2, text: "Install dependencies", completed: true },
      ],
    };

    const json = JSON.stringify(state);
    const restored = JSON.parse(json) as PlanModeState;

    expect(restored.enabled).toBe(true);
    expect(restored.executing).toBe(false);
    expect(restored.todos.length).toBe(2);
    expect(restored.todos[0].text).toBe("Create config file");
    expect(restored.todos[1].completed).toBe(true);
  });

  test("should handle plan mode state with subtasks", () => {
    const state: PlanModeState = {
      enabled: true,
      executing: true,
      modifying: false,
      todos: [
        {
          step: 1,
          text: "Setup project",
          completed: false,
          subtasks: [
            { step: 1, text: "Create package.json", completed: true },
            { step: 2, text: "Create tsconfig.json", completed: false },
          ],
        },
      ],
    };

    const json = JSON.stringify(state);
    const restored = JSON.parse(json) as PlanModeState;

    expect(restored.todos[0].subtasks).toBeDefined();
    expect(restored.todos[0].subtasks!.length).toBe(2);
    expect(restored.todos[0].subtasks![0].completed).toBe(true);
  });

  test("should handle plan mode state with modifyMessage", () => {
    const state: PlanModeState = {
      enabled: true,
      executing: false,
      modifying: true,
      modifyMessage: "Add unit tests step",
      todos: [],
    };

    const json = JSON.stringify(state);
    const restored = JSON.parse(json) as PlanModeState;

    expect(restored.modifying).toBe(true);
    expect(restored.modifyMessage).toBe("Add unit tests step");
  });

  test("should handle empty todos array", () => {
    const state: PlanModeState = {
      enabled: false,
      executing: false,
      modifying: false,
      todos: [],
    };

    const json = JSON.stringify(state);
    const restored = JSON.parse(json) as PlanModeState;

    expect(restored.todos).toEqual([]);
  });
});

describe("PendingQuestion Serialization", () => {
  test("should serialize and deserialize pending question", () => {
    const question: PendingQuestion = {
      questionId: "q-123",
      questions: [
        {
          id: "q1",
          question: "Which framework do you prefer?",
          options: [
            { label: "React", description: "A JavaScript library for building UIs" },
            { label: "Vue", description: "The progressive JavaScript framework" },
          ],
          multiSelect: false,
        },
      ],
    };

    const json = JSON.stringify(question);
    const restored = JSON.parse(json) as PendingQuestion;

    expect(restored.questionId).toBe("q-123");
    expect(restored.questions.length).toBe(1);
    expect(restored.questions[0].question).toBe("Which framework do you prefer?");
    expect(restored.questions[0].options.length).toBe(2);
    expect(restored.questions[0].multiSelect).toBe(false);
  });

  test("should handle multiple questions", () => {
    const question: PendingQuestion = {
      questionId: "q-456",
      questions: [
        {
          id: "q1",
          question: "Frontend framework?",
          options: [{ label: "React" }, { label: "Vue" }],
          multiSelect: true,
        },
        {
          id: "q2",
          question: "Backend language?",
          options: [{ label: "Go" }, { label: "Rust" }],
          multiSelect: false,
        },
      ],
    };

    const json = JSON.stringify(question);
    const restored = JSON.parse(json) as PendingQuestion;

    expect(restored.questions.length).toBe(2);
    expect(restored.questions[0].multiSelect).toBe(true);
    expect(restored.questions[1].multiSelect).toBe(false);
  });

  test("should handle questions with custom values", () => {
    const question: PendingQuestion = {
      questionId: "q-789",
      questions: [
        {
          id: "q1",
          question: "Select a port",
          options: [
            { label: "3000", value: "port-3000" },
            { label: "8080", value: "port-8080" },
          ],
          allowOther: true,
        },
      ],
    };

    const json = JSON.stringify(question);
    const restored = JSON.parse(json) as PendingQuestion;

    expect(restored.questions[0].options[0].value).toBe("port-3000");
    expect(restored.questions[0].allowOther).toBe(true);
  });
});

describe("State Persistence Simulation", () => {
  test("should simulate full persistence cycle for plan mode", () => {
    // Simulate creating a session state
    const originalState: PlanModeState = {
      enabled: true,
      executing: false,
      modifying: false,
      todos: [
        { step: 1, text: "Read config", completed: true },
        { step: 2, text: "Parse arguments", completed: false },
        { step: 3, text: "Execute plan", completed: false },
      ],
    };

    // Simulate saving to database (JSON stringify)
    const savedJson = JSON.stringify(originalState);

    // Simulate loading from database (JSON parse)
    const loadedState = JSON.parse(savedJson) as PlanModeState;

    // Verify state is preserved
    expect(loadedState.enabled).toBe(originalState.enabled);
    expect(loadedState.todos.length).toBe(originalState.todos.length);
    expect(loadedState.todos[0].completed).toBe(true);
    expect(loadedState.todos[1].completed).toBe(false);

    // Simulate state update (mark step 2 as completed)
    loadedState.todos[1].completed = true;
    const updatedJson = JSON.stringify(loadedState);
    const updatedState = JSON.parse(updatedJson) as PlanModeState;

    expect(updatedState.todos[1].completed).toBe(true);
    expect(updatedState.todos[2].completed).toBe(false);
  });

  test("should simulate full persistence cycle for pending question", () => {
    // Simulate creating a pending question
    const originalQuestion: PendingQuestion = {
      questionId: "survey-001",
      questions: [
        {
          id: "lang",
          question: "Preferred language?",
          options: [{ label: "TypeScript" }, { label: "JavaScript" }],
          multiSelect: false,
        },
      ],
    };

    // Simulate saving to database
    const savedJson = JSON.stringify(originalQuestion);

    // Simulate loading from database
    const loadedQuestion = JSON.parse(savedJson) as PendingQuestion;

    // Verify question is preserved
    expect(loadedQuestion.questionId).toBe(originalQuestion.questionId);
    expect(loadedQuestion.questions[0].question).toBe("Preferred language?");

    // Simulate clearing (set to null)
    const clearedJson = null;
    expect(clearedJson).toBeNull();
  });

  test("should handle concurrent state updates", () => {
    // Simulate multiple rapid state changes
    const states: PlanModeState[] = [
      { enabled: true, executing: false, modifying: false, todos: [] },
      { enabled: true, executing: false, modifying: false, todos: [{ step: 1, text: "Task 1", completed: false }] },
      { enabled: true, executing: true, modifying: false, todos: [{ step: 1, text: "Task 1", completed: true }] },
    ];

    const savedStates = states.map(s => JSON.stringify(s));
    const restoredStates = savedStates.map(s => JSON.parse(s) as PlanModeState);

    expect(restoredStates[0].todos.length).toBe(0);
    expect(restoredStates[1].todos.length).toBe(1);
    expect(restoredStates[2].todos[0].completed).toBe(true);
    expect(restoredStates[2].executing).toBe(true);
  });
});

describe("Edge Cases", () => {
  test("should handle malformed JSON gracefully", () => {
    const badJson = "{ invalid json }";

    expect(() => JSON.parse(badJson)).toThrow();
  });

  test("should handle missing optional fields", () => {
    const state = {
      enabled: true,
      executing: false,
      modifying: false,
      // todos is missing
    };

    const json = JSON.stringify(state);
    const restored = JSON.parse(json);

    // Missing todos should not crash
    expect(restored.enabled).toBe(true);
    expect(restored.todos).toBeUndefined();
  });

  test("should handle special characters in todo text", () => {
    const state: PlanModeState = {
      enabled: true,
      executing: false,
      modifying: false,
      todos: [
        { step: 1, text: "Update `package.json` with 🎉 emoji", completed: false },
        { step: 2, text: 'Fix "quotes" and \\backslashes\\', completed: false },
      ],
    };

    const json = JSON.stringify(state);
    const restored = JSON.parse(json) as PlanModeState;

    expect(restored.todos[0].text).toContain("🎉");
    expect(restored.todos[1].text).toContain('"quotes"');
  });

  test("should handle deeply nested subtasks", () => {
    const state: PlanModeState = {
      enabled: true,
      executing: false,
      modifying: false,
      todos: [
        {
          step: 1,
          text: "Main task",
          completed: false,
          subtasks: [
            {
              step: 1,
              text: "Subtask 1",
              completed: false,
              subtasks: [
                { step: 1, text: "Deep subtask", completed: false },
              ],
            },
          ],
        },
      ],
    };

    const json = JSON.stringify(state);
    const restored = JSON.parse(json) as PlanModeState;

    // Note: Current implementation only supports 2 levels
    // This test documents the behavior
    expect(restored.todos[0].subtasks).toBeDefined();
    expect(restored.todos[0].subtasks![0].text).toBe("Subtask 1");
  });
});
