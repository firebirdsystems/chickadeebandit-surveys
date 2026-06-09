import { describe, it, expect } from "vitest";
import {
  surveyStatus, isSurveyOpen, respondentIds, hasResponded, responseCount,
  canManage, choiceResults, ratingAverage, ratingDistribution, yesNoSplit,
  isAnswerValid, allAnswered,
} from "../src/logic.js";

const adult = { id: "m-adult", name: "Alex", role: "adult" };
const child = { id: "m-child", name: "Riley", role: "child" };

describe("surveyStatus / isSurveyOpen", () => {
  it("returns open for open surveys", () => {
    expect(surveyStatus({ status: "open" })).toBe("open");
    expect(isSurveyOpen({ status: "open" })).toBe(true);
  });

  it("returns closed for closed surveys", () => {
    expect(surveyStatus({ status: "closed" })).toBe("closed");
    expect(isSurveyOpen({ status: "closed" })).toBe(false);
  });
});

describe("respondentIds / hasResponded / responseCount", () => {
  const responses = [
    { survey_id: "s1", question_id: "q1", member_id: "m1", answer: "yes" },
    { survey_id: "s1", question_id: "q2", member_id: "m1", answer: "no" },
    { survey_id: "s1", question_id: "q1", member_id: "m2", answer: "no" },
    { survey_id: "s2", question_id: "q3", member_id: "m3", answer: "yes" },
  ];

  it("dedupes member ids per survey", () => {
    expect(respondentIds("s1", responses)).toEqual(new Set(["m1", "m2"]));
  });

  it("hasResponded reflects respondentIds", () => {
    expect(hasResponded("s1", responses, "m1")).toBe(true);
    expect(hasResponded("s1", responses, "m3")).toBe(false);
    expect(hasResponded("s2", responses, "m3")).toBe(true);
  });

  it("responseCount counts distinct respondents", () => {
    expect(responseCount("s1", responses)).toBe(2);
    expect(responseCount("s2", responses)).toBe(1);
    expect(responseCount("s3", responses)).toBe(0);
  });
});

describe("canManage", () => {
  const survey = { id: "s1", created_by: "m-creator" };

  it("creator can manage", () => {
    expect(canManage(survey, { id: "m-creator", role: "child" })).toBe(true);
  });

  it("adults can manage", () => {
    expect(canManage(survey, adult)).toBe(true);
  });

  it("non-creator children cannot manage", () => {
    expect(canManage(survey, child)).toBe(false);
  });

  it("returns false when no member is given", () => {
    expect(canManage(survey, null)).toBe(false);
  });
});

describe("choiceResults", () => {
  const options = ["Beach", "Mountains", "City"];

  it("computes counts and percentages", () => {
    const responses = [
      { question_id: "q1", answer: "Beach" },
      { question_id: "q1", answer: "Beach" },
      { question_id: "q1", answer: "Mountains" },
      { question_id: "q1", answer: "City" },
      { question_id: "q2", answer: "Beach" }, // different question, ignored
    ];
    const result = choiceResults("q1", options, responses);
    expect(result.get("Beach")).toEqual({ count: 2, pct: 50 });
    expect(result.get("Mountains")).toEqual({ count: 1, pct: 25 });
    expect(result.get("City")).toEqual({ count: 1, pct: 25 });
  });

  it("returns 0 percent for all options when there are no responses", () => {
    const result = choiceResults("q1", options, []);
    for (const opt of options) {
      expect(result.get(opt)).toEqual({ count: 0, pct: 0 });
    }
  });
});

describe("ratingAverage", () => {
  it("computes the average of numeric answers", () => {
    const responses = [
      { question_id: "q1", answer: "5" },
      { question_id: "q1", answer: "3" },
      { question_id: "q1", answer: "4" },
      { question_id: "q2", answer: "1" }, // ignored
    ];
    expect(ratingAverage("q1", responses)).toBeCloseTo(4, 5);
  });

  it("returns 0 when there are no responses", () => {
    expect(ratingAverage("q1", [])).toBe(0);
  });
});

describe("ratingDistribution", () => {
  it("counts each rating value 1-5, defaulting to 0", () => {
    const responses = [
      { question_id: "q1", answer: "5" },
      { question_id: "q1", answer: "5" },
      { question_id: "q1", answer: "3" },
    ];
    const dist = ratingDistribution("q1", responses);
    expect(dist.get("1")).toBe(0);
    expect(dist.get("2")).toBe(0);
    expect(dist.get("3")).toBe(1);
    expect(dist.get("4")).toBe(0);
    expect(dist.get("5")).toBe(2);
  });
});

describe("yesNoSplit", () => {
  it("computes counts and percentages for yes/no answers", () => {
    const responses = [
      { question_id: "q1", answer: "yes" },
      { question_id: "q1", answer: "yes" },
      { question_id: "q1", answer: "no" },
    ];
    expect(yesNoSplit("q1", responses)).toEqual({ yes: 2, no: 1, yesPct: 67, noPct: 33 });
  });

  it("returns zero percentages when there are no responses", () => {
    expect(yesNoSplit("q1", [])).toEqual({ yes: 0, no: 0, yesPct: 0, noPct: 0 });
  });
});

describe("isAnswerValid", () => {
  it("text requires a non-empty trimmed string", () => {
    expect(isAnswerValid({ type: "text" }, "hello")).toBe(true);
    expect(isAnswerValid({ type: "text" }, "   ")).toBe(false);
    expect(isAnswerValid({ type: "text" }, "")).toBe(false);
    expect(isAnswerValid({ type: "text" }, null)).toBe(false);
  });

  it("choice requires the answer to be one of the options", () => {
    const q = { type: "choice", options: ["A", "B"] };
    expect(isAnswerValid(q, "A")).toBe(true);
    expect(isAnswerValid(q, "C")).toBe(false);
  });

  it("rating requires a string 1-5", () => {
    const q = { type: "rating" };
    expect(isAnswerValid(q, "1")).toBe(true);
    expect(isAnswerValid(q, "5")).toBe(true);
    expect(isAnswerValid(q, "6")).toBe(false);
    expect(isAnswerValid(q, "0")).toBe(false);
  });

  it("yesno requires 'yes' or 'no'", () => {
    const q = { type: "yesno" };
    expect(isAnswerValid(q, "yes")).toBe(true);
    expect(isAnswerValid(q, "no")).toBe(true);
    expect(isAnswerValid(q, "maybe")).toBe(false);
  });
});

describe("allAnswered", () => {
  const questions = [
    { id: "q1", type: "yesno" },
    { id: "q2", type: "text" },
  ];

  it("returns true when all questions have valid answers", () => {
    expect(allAnswered(questions, { q1: "yes", q2: "hello" })).toBe(true);
  });

  it("returns false when any question is missing an answer", () => {
    expect(allAnswered(questions, { q1: "yes" })).toBe(false);
    expect(allAnswered(questions, { q1: "yes", q2: "  " })).toBe(false);
  });
});
