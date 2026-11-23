/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Pure Evaluation Logic Engine
 */

import type { Assessment, CandidateAnswer } from '../types/index.ts';
import { evaluateCodingQuestionSync, getDefaultCodingConfig } from './codeExecutionEngine.ts';

export interface EvaluationResult {
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
}

/**
 * Checks whether an assessment object contains at least one question with an intact answer key
 * (or is a purely coding/subjective assessment where answer keys are embedded in test cases).
 * Returns false if `sanitizeAssessmentForCandidate` stripped all answer keys.
 */
export function hasIntactAnswerKey(
  assessment: Pick<Assessment, 'sections'> | null | undefined
): boolean {
  if (!assessment || !Array.isArray(assessment.sections)) return false;
  const allQuestions = assessment.sections.flatMap((s) => s.questions || []);
  if (allQuestions.length === 0) return false;

  // If every question is an objective MCQ/True-False question, at least one must have a non-empty answer key
  const objectiveQuestions = allQuestions.filter(
    (q) =>
      q.type === 'single_choice' ||
      q.type === 'multiple_choice' ||
      q.type === 'true_false'
  );

  if (objectiveQuestions.length > 0) {
    const anyHasKey = objectiveQuestions.some((q) => {
      const hasIds = Array.isArray(q.correctOptionIds) && q.correctOptionIds.length > 0;
      const hasAns =
        Array.isArray((q as any).correctAnswers) && (q as any).correctAnswers.length > 0;
      const hasOptFlag = (q.options || []).some((o) => o.isCorrect === true);
      return hasIds || hasAns || hasOptFlag;
    });
    if (!anyHasKey) return false;
  }

  // If there are coding questions, check that hidden test cases were not stripped by sanitizeAssessmentForCandidate
  const codingQuestions = allQuestions.filter((q) => q.type === 'coding_problem');
  if (codingQuestions.length > 0) {
    const anyLockedHidden = codingQuestions.some((q) =>
      (q.codingConfig?.testCases || []).some((tc) => (tc as any).isHiddenLocked === true)
    );
    if (anyLockedHidden) return false;
  }

  return true;
}

function normalizeAnswerText(val: string | undefined | null): string {
  return String(val || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Resolves the canonical set of correct option IDs and normalized correct option texts for an objective question.
 */
function resolveCorrectOptions(q: Assessment['sections'][number]['questions'][number]): {
  correctIds: Set<string>;
  correctTexts: Set<string>;
} {
  const correctIds = new Set<string>();
  const correctTexts = new Set<string>();
  const options = Array.isArray(q.options) ? q.options : [];

  const rawKeys: string[] = [
    ...(Array.isArray(q.correctOptionIds) ? q.correctOptionIds : []),
    ...(Array.isArray((q as any).correctAnswers) ? (q as any).correctAnswers : []),
  ]
    .map((k) => String(k || '').trim())
    .filter((k) => k.length > 0);

  // 1. Add any option explicitly flagged with isCorrect: true
  options.forEach((opt) => {
    if (opt && opt.isCorrect === true) {
      if (opt.id) correctIds.add(String(opt.id).trim());
      const normText = normalizeAnswerText(opt.text);
      if (normText) correctTexts.add(normText);
    }
  });

  // 2. Match raw keys against option IDs, option texts, or option letter indices (A/B/C/D or 0/1/2/3)
  rawKeys.forEach((key) => {
    const normKey = normalizeAnswerText(key);
    const byId = options.find((o) => String(o.id).trim() === key || normalizeAnswerText(o.id) === normKey);
    if (byId) {
      correctIds.add(String(byId.id).trim());
      const normText = normalizeAnswerText(byId.text);
      if (normText) correctTexts.add(normText);
      return;
    }

    const byText = options.find((o) => normalizeAnswerText(o.text) === normKey);
    if (byText) {
      correctIds.add(String(byText.id).trim());
      if (normKey) correctTexts.add(normKey);
      return;
    }

    // Also add raw key directly so direct ID or text comparison still works
    correctIds.add(key);
    if (normKey) correctTexts.add(normKey);
  });

  return { correctIds, correctTexts };
}

function isOptionSelectionCorrect(
  selectedIdOrText: string,
  options: Assessment['sections'][number]['questions'][number]['options'],
  correctIds: Set<string>,
  correctTexts: Set<string>
): boolean {
  const cleanSel = String(selectedIdOrText || '').trim();
  if (!cleanSel) return false;
  if (correctIds.has(cleanSel)) return true;

  const normSel = normalizeAnswerText(cleanSel);
  if (correctTexts.has(normSel)) return true;

  const matchedOpt = (options || []).find(
    (o) => String(o.id).trim() === cleanSel || normalizeAnswerText(o.id) === normSel
  );
  if (matchedOpt) {
    if (matchedOpt.isCorrect === true) return true;
    const optText = normalizeAnswerText(matchedOpt.text);
    if (optText && correctTexts.has(optText)) return true;
  }

  return false;
}

export function evaluateAssessmentAttempt(
  assessment: Pick<Assessment, 'sections' | 'passingMarks' | 'totalMarks'>,
  answers: Record<string, CandidateAnswer>
): EvaluationResult {
  let calculatedScore = 0;
  let maxMarks = 0;

  assessment.sections.forEach((sec) => {
    sec.questions.forEach((q) => {
      const qMarks = Number(q.marks) || 0;
      const qNeg = Number(q.negativeMarks) || 0;
      maxMarks += qMarks;

      const userAns = answers[q.id];
      if (!userAns) return;

      if (q.type === 'coding_problem') {
        const cfg = q.codingConfig || getDefaultCodingConfig();
        const lang = userAns.codingLanguage || cfg.defaultLanguage || 'python';
        const codeFromLangMap = userAns.codeByLanguage?.[lang];
        const codeText = (
          userAns.codeAnswer ||
          codeFromLangMap ||
          userAns.textAnswer ||
          ''
        ).trim();

        const hasRecordedRuns =
          typeof userAns.totalTestCases === 'number' &&
          userAns.totalTestCases > 0 &&
          typeof userAns.passedTestCases === 'number';

        if (!codeText && !hasRecordedRuns) {
          return; // Unanswered coding problem -> 0 marks
        }

        let passedCount = userAns.passedTestCases ?? 0;
        let totalCount = userAns.totalTestCases ?? 0;

        // Determine if the assessment has full unlocked test cases so we can authoritatively evaluate codeText
        const allTestCases = Array.isArray(cfg.testCases) ? cfg.testCases : [];
        const hasFullUnlockedTestCases =
          allTestCases.length > 0 &&
          allTestCases.every((tc) => !(tc as any).isHiddenLocked);

        if (codeText && (!hasRecordedRuns || hasFullUnlockedTestCases)) {
          const evalRes = evaluateCodingQuestionSync(q, lang, codeText);
          const syncTotal = evalRes.totalTestCases ?? evalRes.totalCount ?? 0;
          const syncPassed = evalRes.passedTestCases ?? evalRes.passedCount ?? 0;
          // Use the fresh evaluation if no runs were recorded OR if it ran against full unlocked test cases
          if (!hasRecordedRuns || syncPassed >= passedCount || syncTotal >= totalCount) {
            passedCount = syncPassed;
            totalCount = syncTotal;
          }
        }

        if (totalCount > 0 && passedCount === totalCount) {
          calculatedScore += qMarks;
        } else if (q.partialMarking !== false && totalCount > 0 && passedCount > 0) {
          const partialShare = Math.round((passedCount / totalCount) * qMarks * 10) / 10;
          calculatedScore += partialShare;
        } else if (passedCount === 0 && codeText) {
          calculatedScore = Math.max(0, calculatedScore - qNeg);
        }
        return;
      }

      const selected = Array.isArray(userAns.selectedOptionIds)
        ? userAns.selectedOptionIds.filter((s) => String(s || '').trim().length > 0)
        : [];
      const textAns = (userAns.textAnswer || '').trim();

      // Zero marks for completely unanswered question
      const isUnanswered = selected.length === 0 && textAns.length === 0;
      if (isUnanswered) {
        return;
      }

      const { correctIds, correctTexts } = resolveCorrectOptions(q);

      if (q.type === 'single_choice' || q.type === 'true_false') {
        const candidateChoice = selected[0] || textAns;
        if (
          candidateChoice &&
          isOptionSelectionCorrect(candidateChoice, q.options, correctIds, correctTexts)
        ) {
          calculatedScore += qMarks;
        } else if (selected.length > 0 || textAns.length > 0) {
          calculatedScore = Math.max(0, calculatedScore - qNeg);
        }
      } else if (q.type === 'multiple_choice') {
        // Deduplicate selected options
        const uniqueSelected = Array.from(new Set(selected));
        const totalCorrectOptionsCount =
          correctIds.size > 0 ? correctIds.size : correctTexts.size;

        let correctSelected = 0;
        let incorrectSelected = 0;
        uniqueSelected.forEach((sel) => {
          if (isOptionSelectionCorrect(sel, q.options, correctIds, correctTexts)) {
            correctSelected++;
          } else {
            incorrectSelected++;
          }
        });

        if (
          totalCorrectOptionsCount > 0 &&
          correctSelected === totalCorrectOptionsCount &&
          incorrectSelected === 0
        ) {
          calculatedScore += qMarks;
        } else if (
          q.partialMarking !== false &&
          totalCorrectOptionsCount > 0 &&
          correctSelected > 0 &&
          incorrectSelected === 0
        ) {
          // Proportional partial marks for choosing subset of correct answers with 0 wrong choices
          const partialShare =
            Math.round((correctSelected / totalCorrectOptionsCount) * qMarks * 10) / 10;
          calculatedScore += partialShare;
        } else if (uniqueSelected.length > 0) {
          calculatedScore = Math.max(0, calculatedScore - qNeg);
        }
      } else if (q.type === 'short_text') {
        const rawAccepted = [
          ...(Array.isArray(q.shortTextAcceptedAnswers) ? q.shortTextAcceptedAnswers : []),
          ...(Array.isArray(q.correctOptionIds) ? q.correctOptionIds : []),
          ...(Array.isArray((q as any).correctAnswers) ? (q as any).correctAnswers : []),
        ];
        // Filter out empty or whitespace-only placeholder strings (e.g. [''] initialized by editor)
        const accepted = rawAccepted
          .map((a) => normalizeAnswerText(a))
          .filter((a) => a.length > 0);

        const normCandidateText = normalizeAnswerText(textAns);

        if (accepted.length > 0) {
          const matched = accepted.some(
            (a) =>
              a === normCandidateText ||
              // Also allow case-insensitive exact match after stripping trailing punctuation
              a.replace(/[.,;!?]+$/, '') === normCandidateText.replace(/[.,;!?]+$/, '')
          );
          if (matched) {
            calculatedScore += qMarks;
          } else if (normCandidateText.length > 0) {
            calculatedScore = Math.max(0, calculatedScore - qNeg);
          }
        } else if (normCandidateText.length > 0) {
          // If no answer key was specified by the recruiter, non-empty response awards marks
          calculatedScore += qMarks;
        }
      }
    });
  });

  const finalMarks = maxMarks > 0 ? maxMarks : assessment.totalMarks || 100;
  const finalScore = Math.max(0, Math.round(calculatedScore * 100) / 100);
  const percentage = finalMarks > 0 ? Math.round((finalScore / finalMarks) * 100) : 0;
  const passed = finalScore >= (Number(assessment.passingMarks) || 0);

  return {
    score: finalScore,
    totalMarks: finalMarks,
    percentage,
    passed,
  };
}

