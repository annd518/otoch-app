// Red flag questionnaire rules. Questions start unanswered (null); a single
// "yes" stops the booking and sends the user to the 103 screen.
import type { RedFlagQuestionnaire } from './apiTypes'

export type Answer = boolean | null
export type Answers = Record<string, Answer>

export function initialAnswers(questionnaire: RedFlagQuestionnaire): Answers {
  return Object.fromEntries(questionnaire.questions.map((q) => [q.id, null]))
}

export function hasPositiveAnswer(answers: Answers): boolean {
  return Object.values(answers).some((value) => value === true)
}

export function allRequiredAnswered(questionnaire: RedFlagQuestionnaire, answers: Answers): boolean {
  return questionnaire.questions.every((q) => !q.required || answers[q.id] === true || answers[q.id] === false)
}

// The continue button is enabled only when every question is answered "no".
export function canSubmitClear(questionnaire: RedFlagQuestionnaire, answers: Answers): boolean {
  return allRequiredAnswered(questionnaire, answers) && !hasPositiveAnswer(answers)
}

export function answersPayload(questionnaire: RedFlagQuestionnaire, answers: Answers): { questionId: string; value: boolean }[] {
  return questionnaire.questions
    .filter((q) => answers[q.id] === true || answers[q.id] === false)
    .map((q) => ({ questionId: q.id, value: answers[q.id] === true }))
}

export type QuestionnaireLabel = 'dev_fixture' | 'server_fixture' | 'unapproved' | 'approved'

export function questionnaireLabel(questionnaire: RedFlagQuestionnaire, source: 'real' | 'mock'): QuestionnaireLabel {
  if (source === 'mock') return 'dev_fixture'
  if (questionnaire.containsFixtures) return 'server_fixture'
  return questionnaire.approved ? 'approved' : 'unapproved'
}

// The server already decided this order is blocked (e.g. answered on another device).
export function questionnaireShowsBlocked(questionnaire: RedFlagQuestionnaire): boolean {
  return questionnaire.orderStatus === 'BLOCKED_RED_FLAG' || questionnaire.redFlagStatus === 'FLAGGED'
}

export const EMERGENCY_PHONE = '103'
