// Shared utilities (memberColor, initial, esc, isAdult, formatRelativeDate) live in /hub-sdk.js.
export { AVATAR_COLORS, memberColor, initial, esc, isAdult, formatRelativeDate } from "./shared.js";
// This file exports surveys-specific logic only.

import { isAdult } from "./shared.js";

export function surveyStatus(survey) {
  return survey.status === "closed" ? "closed" : "open";
}

export function isSurveyOpen(survey) {
  return surveyStatus(survey) === "open";
}

/**
 * Respondents for a survey, from RECEIPT rows (`response_receipts`) — never
 * from response rows.
 *
 * These used to be handed the responses table. That is wrong in two ways at
 * once. An anonymous survey's response rows carry no member id at all, so every
 * one of them added `undefined` to the set and the whole survey counted as
 * exactly one respondent. And a non-anonymous survey's responses are
 * `endpoint_only, read: "none"` — an app cannot read them while the survey is
 * open, so the set was empty anyway.
 *
 * Receipts are the table that records who has responded, for both modes. Rows
 * without a member id are ignored rather than counted, so passing the wrong
 * table can no longer invent a respondent.
 *
 * NOTE ON SCOPE: receipts are `owner_only` with `adults_bypass: false`, so a
 * caller reading them through /api/db sees only their own. These helpers
 * therefore answer "have I responded?" honestly and "how many have?" only for
 * a receipt list the caller genuinely holds in full. For the household-wide
 * count use the hub's `api/response-progress` endpoint, which returns the
 * aggregate without exposing the rows.
 */
export function respondentIds(surveyId, receipts) {
  const ids = new Set();
  for (const receipt of receipts ?? []) {
    if (receipt.survey_id === surveyId && receipt.member_id) ids.add(receipt.member_id);
  }
  return ids;
}

/** Whether `memberId` has a receipt for this survey. */
export function hasResponded(surveyId, receipts, memberId) {
  if (!memberId) return false;
  return respondentIds(surveyId, receipts).has(memberId);
}

/** Distinct respondents in the receipt rows provided — see the scope note above. */
export function responseCount(surveyId, receipts) {
  return respondentIds(surveyId, receipts).size;
}

/**
 * Widget ordering: tag each survey with a `responded` flag (1/0) from the set
 * of survey ids the viewer has a receipt for, then sort un-responded first and
 * newest first within each group. Receipts are fetched separately rather than
 * joined, because the hub's row-policy rewriter rejects referencing the
 * governed response_receipts table inside a subquery of the surveys query.
 */
export function orderSurveysForWidget(surveys, respondedIds) {
  const responded = respondedIds instanceof Set ? respondedIds : new Set(respondedIds ?? []);
  return surveys
    .map((s) => ({ ...s, responded: responded.has(s.id) ? 1 : 0 }))
    .sort((a, b) => (a.responded - b.responded) || String(b.created_at).localeCompare(String(a.created_at)));
}

export function canManage(survey, me) {
  if (!me) return false;
  return isAdult(me);
}

export function choiceResults(questionId, options, responses) {
  const matching = responses.filter(r => r.question_id === questionId);
  const total = matching.length;
  const result = new Map();
  for (const opt of options) {
    const count = matching.filter(r => r.answer === opt).length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    result.set(opt, { count, pct });
  }
  return result;
}

export function ratingAverage(questionId, responses) {
  const matching = responses.filter(r => r.question_id === questionId);
  if (matching.length === 0) return 0;
  const sum = matching.reduce((s, r) => s + Number(r.answer), 0);
  return sum / matching.length;
}

export function ratingDistribution(questionId, responses) {
  const matching = responses.filter(r => r.question_id === questionId);
  const dist = new Map([["1", 0], ["2", 0], ["3", 0], ["4", 0], ["5", 0]]);
  for (const r of matching) {
    if (dist.has(r.answer)) dist.set(r.answer, dist.get(r.answer) + 1);
  }
  return dist;
}

export function yesNoSplit(questionId, responses) {
  const matching = responses.filter(r => r.question_id === questionId);
  const yes = matching.filter(r => r.answer === "yes").length;
  const no = matching.filter(r => r.answer === "no").length;
  const total = yes + no;
  return {
    yes,
    no,
    yesPct: total > 0 ? Math.round((yes / total) * 100) : 0,
    noPct: total > 0 ? Math.round((no / total) * 100) : 0,
  };
}

export function isAnswerValid(question, answer) {
  if (answer == null) return false;
  switch (question.type) {
    case "text":
      return String(answer).trim().length > 0;
    case "choice":
      return (question.options ?? []).includes(answer);
    case "rating":
      return ["1", "2", "3", "4", "5"].includes(String(answer));
    case "yesno":
      return answer === "yes" || answer === "no";
    default:
      return false;
  }
}

export function allAnswered(questions, answers) {
  return questions.every(q => isAnswerValid(q, answers[q.id]));
}
