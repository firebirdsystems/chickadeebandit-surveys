import { describe, it, expect } from "vitest";
import {
  surveyStatus, isSurveyOpen, respondentIds, hasResponded, responseCount,
  canManage, choiceResults, ratingAverage, ratingDistribution, yesNoSplit,
  isAnswerValid, allAnswered, orderSurveysForWidget, searchableFields, failureLine,
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

  // closes_at is wired to the hub's session_deadline_column: once it passes the
  // hub refuses responses and releases results WITHOUT changing status, so a
  // client reading status alone would offer a survey the hub rejects.
  // The deadlines here are DAYS from `now`, not hours: closes_at is a floating
  // wall time, so `new Date()` reads it in whatever zone the test runner sits
  // in. Anything within ±14h of `now` would pass or fail by machine.
  it("treats a passed closes_at as closed even while status is open", () => {
    const now = new Date("2026-08-05T12:00:00Z");
    expect(isSurveyOpen({ status: "open", closes_at: "2026-08-01T09:00" }, now)).toBe(false);
    expect(surveyStatus({ status: "open", closes_at: "2026-08-01T09:00" }, now)).toBe("closed");
  });

  it("keeps a survey open until its deadline arrives", () => {
    const now = new Date("2026-08-05T12:00:00Z");
    expect(isSurveyOpen({ status: "open", closes_at: "2026-08-09T18:00" }, now)).toBe(true);
  });

  it("treats a missing or unparseable closes_at as no deadline", () => {
    const now = new Date("2026-08-05T12:00:00Z");
    for (const closes_at of [null, undefined, "", "whenever"]) {
      expect(isSurveyOpen({ status: "open", closes_at }, now)).toBe(true);
    }
  });
});

describe("respondentIds / hasResponded / responseCount", () => {
  // Receipt rows (response_receipts), one per member per survey — NOT response
  // rows, which are what these helpers used to be handed.
  const receipts = [
    { survey_id: "s1", member_id: "m1" },
    { survey_id: "s1", member_id: "m2" },
    { survey_id: "s2", member_id: "m3" },
  ];

  it("collects member ids per survey", () => {
    expect(respondentIds("s1", receipts)).toEqual(new Set(["m1", "m2"]));
  });

  it("hasResponded reflects respondentIds", () => {
    expect(hasResponded("s1", receipts, "m1")).toBe(true);
    expect(hasResponded("s1", receipts, "m3")).toBe(false);
    expect(hasResponded("s2", receipts, "m3")).toBe(true);
    expect(hasResponded("s1", receipts, null)).toBe(false);
  });

  it("responseCount counts distinct respondents", () => {
    expect(responseCount("s1", receipts)).toBe(2);
    expect(responseCount("s2", receipts)).toBe(1);
    expect(responseCount("s3", receipts)).toBe(0);
  });

  it("ignores rows with no member id instead of inventing a respondent", () => {
    // An anonymous survey's RESPONSE rows carry no member id. Passed here by
    // mistake, they used to add `undefined` to the set — so a survey with
    // fifty anonymous answers reported exactly one respondent.
    const anonymousResponses = [
      { survey_id: "s1", question_id: "q1", answer: "yes" },
      { survey_id: "s1", question_id: "q1", answer: "no" },
    ];
    expect(respondentIds("s1", anonymousResponses)).toEqual(new Set());
    expect(responseCount("s1", anonymousResponses)).toBe(0);
  });

  it("tolerates a missing receipt list", () => {
    expect(responseCount("s1", undefined)).toBe(0);
  });
});

describe("canManage", () => {
  const survey = { id: "s1", created_by: "m-creator" };

  it("adults can manage any survey", () => {
    expect(canManage(survey, adult)).toBe(true);
  });

  it("non-adult creator cannot manage (server enforces adult_writable)", () => {
    expect(canManage(survey, { id: "m-creator", role: "child" })).toBe(false);
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

describe("orderSurveysForWidget", () => {
  const surveys = [
    { id: "s1", title: "Old",    created_at: "2026-07-01T00:00:00Z" },
    { id: "s2", title: "New",    created_at: "2026-07-20T00:00:00Z" },
    { id: "s3", title: "Middle", created_at: "2026-07-10T00:00:00Z" },
  ];

  it("puts un-responded first, then newest-first within each group", () => {
    // Responded to the newest (s2); s1 and s3 remain pending.
    const out = orderSurveysForWidget(surveys, new Set(["s2"]));
    expect(out.map((s) => s.id)).toEqual(["s3", "s1", "s2"]);
    expect(out.map((s) => s.responded)).toEqual([0, 0, 1]);
  });

  it("accepts an array of responded ids too", () => {
    const out = orderSurveysForWidget(surveys, ["s1"]);
    expect(out.find((s) => s.id === "s1").responded).toBe(1);
  });

  it("marks all pending when nothing responded", () => {
    const out = orderSurveysForWidget(surveys, new Set());
    expect(out.map((s) => s.id)).toEqual(["s2", "s3", "s1"]);
    expect(out.every((s) => s.responded === 0)).toBe(true);
  });

  it("does not mutate the input surveys", () => {
    orderSurveysForWidget(surveys, new Set(["s1"]));
    expect(surveys[0].responded).toBeUndefined();
  });
});

describe("searchableFields", () => {
  it("matches on the description, not just the survey title", () => {
    expect(searchableFields({ title: "Feedback", description: "summer camp catering" }))
      .toContain("summer camp catering");
  });
});

describe("failureLine", () => {
  const words = { action: "close the survey", thing: "survey" };
  const err = (props, message = "Database request failed") => Object.assign(new Error(message), props);

  it("names a duplicate by its code, and by the hub's text where the code is missing", () => {
    expect(failureLine(err({ status: 400, code: "UNIQUE_CONSTRAINT" }), words)).toBe("That survey already exists.");
    expect(failureLine(err({ status: 400 }, "UNIQUE constraint failed: app_surveys__surveys.id"), words)).toBe("That survey already exists.");
  });

  it("says a 403 is not allowed, with no try again", () => {
    expect(failureLine(err({ status: 403 }), words)).toBe("You don’t have permission to close the survey.");
  });

  it("says a 507 is a full household store", () => {
    expect(failureLine(err({ status: 507 }), words)).toBe("The household’s storage is full — free up space first.");
  });

  it("says a 404, or a re-read that found no row, is removed", () => {
    expect(failureLine(err({ status: 404 }), words)).toBe("This survey has been removed.");
    expect(failureLine(null, { ...words, gone: true })).toBe("This survey has been removed.");
    expect(failureLine(err({ status: 409 }), { ...words, gone: true })).toBe("This survey has been removed.");
  });

  it("says a 409, or a re-read that found the row changed, is someone else's change", () => {
    expect(failureLine(err({ status: 409 }), words)).toBe("This survey was changed by someone else — check it first.");
    expect(failureLine(null, { ...words, gone: false })).toBe("This survey was changed by someone else — check it first.");
  });

  it("keeps try again for no answer, a hub failure, and any other 400", () => {
    for (const e of [new TypeError("Failed to fetch"), err({ status: 500 }), err({ status: 503 }), err({ status: 400 }), undefined]) {
      expect(failureLine(e, words)).toBe("Couldn’t close the survey — try again.");
    }
  });

  it("says neither removed nor changed when the re-read after changed: 0 failed", () => {
    expect(failureLine(null, words)).toBe("Couldn’t close the survey — try again.");
  });

  it("says an unguarded write whose row is still there was refused", () => {
    expect(failureLine({ status: 403 }, words)).toBe("You don’t have permission to close the survey.");
  });

  it("never shows the hub's text", () => {
    expect(failureLine(err({ status: 403 }, "Row policy denied"), words)).not.toMatch(/Row policy/);
  });
});
