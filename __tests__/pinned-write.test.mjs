import { describe, it, expect } from "vitest";
import { outcomeUnknown, launchDiffers } from "../src/logic.js";

const err = (props, message = "hub text") => Object.assign(new Error(message), props);

describe("outcomeUnknown", () => {
  it("is unknown with no status, a 400, or a 5xx other than 507", () => {
    for (const e of [new TypeError("Failed to fetch"), err({ status: 0 }), err({ status: 400 }), err({ status: 500 }), err({ status: 503 })]) {
      expect(outcomeUnknown(e)).toBe(true);
    }
  });
  it("is known for a refusal", () => {
    for (const e of [err({ status: 403 }), err({ status: 404 }), err({ status: 409 }), err({ status: 507 })]) {
      expect(outcomeUnknown(e)).toBe(false);
    }
  });
  it("reads back on a duplicate: a retry that landed collides on its own pinned id", () => {
    for (const e of [err({ status: 400, code: "UNIQUE_CONSTRAINT" }), err({ status: 400 }, "UNIQUE constraint failed: x.id")]) {
      expect(outcomeUnknown(e)).toBe(true);
    }
  });
});

describe("launchDiffers", () => {
  const typed = {
    title: "Dinner ideas", description: "", anonymous: 0, closes_at: null,
    questions: [
      { id: "q1", text: "Pizza?", type: "yesno", options: [] },
      { id: "q2", text: "Which night?", type: "choice", options: ["Fri", "Sat"] },
    ],
  };
  const stored = {
    survey: { id: "s1", title: "Dinner ideas", description: null, anonymous: "0", closes_at: null, status: "open" },
    questions: [
      { id: "q1", text: "Pizza?", type: "yesno", options: [], position: 0 },
      { id: "q2", text: "Which night?", type: "choice", options: ["Fri", "Sat"], position: 1 },
    ],
  };
  it("treats the stored launch matching the form as the same", () => {
    expect(launchDiffers(stored, typed)).toBe(false);
  });
  it("sees a survey field edited since the first try", () => {
    expect(launchDiffers(stored, { ...typed, title: "Dinner plans" })).toBe(true);
  });
  it("sees a question added, removed, reworded or given other options", () => {
    expect(launchDiffers(stored, { ...typed, questions: typed.questions.slice(0, 1) })).toBe(true);
    expect(launchDiffers(stored, { ...typed, questions: [...typed.questions, { id: "q3", text: "Dessert?", type: "yesno", options: [] }] })).toBe(true);
    expect(launchDiffers(stored, { ...typed, questions: [typed.questions[0], { ...typed.questions[1], options: ["Fri", "Sun"] }] })).toBe(true);
    expect(launchDiffers(stored, { ...typed, questions: [{ ...typed.questions[0], text: "Tacos?" }, typed.questions[1]] })).toBe(true);
  });
});
