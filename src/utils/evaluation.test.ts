/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Unit Tests for Evaluation Engine
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { evaluateAssessmentAttempt } from './evaluation.ts';
import type { Assessment, CandidateAnswer } from '../types/index.ts';

test('evaluateAssessmentAttempt correctly scores single-choice questions with negative marks', () => {
  const dummyAssessment: Pick<Assessment, 'sections' | 'passingMarks' | 'totalMarks'> = {
    totalMarks: 20,
    passingMarks: 10,
    sections: [
      {
        id: 'sec-1',
        title: 'Section 1',
        order: 1,
        questions: [
          {
            id: 'q1',
            type: 'single_choice',
            title: 'Q1',
            options: [{ id: 'opt1', text: '1' }, { id: 'opt2', text: '2' }],
            correctOptionIds: ['opt1'],
            marks: 10,
            negativeMarks: 2,
            difficulty: 'easy',
          },
          {
            id: 'q2',
            type: 'single_choice',
            title: 'Q2',
            options: [{ id: 'optA', text: 'A' }, { id: 'optB', text: 'B' }],
            correctOptionIds: ['optA'],
            marks: 10,
            negativeMarks: 2,
            difficulty: 'easy',
          },
        ],
      },
    ],
  };

  // Case 1: Q1 correct, Q2 wrong
  const answers: Record<string, CandidateAnswer> = {
    q1: { questionId: 'q1', selectedOptionIds: ['opt1'], isMarkedForReview: false, visited: true, timeSpentSeconds: 10 },
    q2: { questionId: 'q2', selectedOptionIds: ['optB'], isMarkedForReview: false, visited: true, timeSpentSeconds: 10 },
  };

  const result = evaluateAssessmentAttempt(dummyAssessment, answers);
  // Expected: 10 - 2 = 8 marks out of 20 => 40% => failed (passingMarks = 10)
  assert.strictEqual(result.score, 8);
  assert.strictEqual(result.totalMarks, 20);
  assert.strictEqual(result.percentage, 40);
  assert.strictEqual(result.passed, false);
});

test('evaluateAssessmentAttempt handles perfect score with pass status', () => {
  const dummyAssessment: Pick<Assessment, 'sections' | 'passingMarks' | 'totalMarks'> = {
    totalMarks: 10,
    passingMarks: 6,
    sections: [
      {
        id: 'sec-1',
        title: 'Section 1',
        order: 1,
        questions: [
          {
            id: 'q1',
            type: 'single_choice',
            title: 'Q1',
            options: [{ id: 'opt1', text: '1' }],
            correctOptionIds: ['opt1'],
            marks: 10,
            negativeMarks: 0,
            difficulty: 'easy',
          },
        ],
      },
    ],
  };

  const answers: Record<string, CandidateAnswer> = {
    q1: { questionId: 'q1', selectedOptionIds: ['opt1'], isMarkedForReview: false, visited: true, timeSpentSeconds: 5 },
  };

  const result = evaluateAssessmentAttempt(dummyAssessment, answers);
  assert.strictEqual(result.score, 10);
  assert.strictEqual(result.percentage, 100);
  assert.strictEqual(result.passed, true);
});
