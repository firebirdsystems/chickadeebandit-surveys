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

export function respondentIds(surveyId, responses) {
  const ids = new Set();
  for (const r of responses) {
    if (r.survey_id === surveyId) ids.add(r.member_id);
  }
  return ids;
}

export function hasResponded(surveyId, responses, memberId) {
  return respondentIds(surveyId, responses).has(memberId);
}

export function responseCount(surveyId, responses) {
  return respondentIds(surveyId, responses).size;
}

export function canManage(survey, me) {
  if (!me) return false;
  return survey.created_by === me.id || isAdult(me);
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
