/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Unit tests for Google Forms Parser & Standardized Schema Converter
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFormId,
  validateGoogleFormsUrl,
  convertGoogleFormToAttlicAssessment,
  validateStandardizedJson,
} from './googleFormsParser.ts';

test('extractFormId correctly parses diverse Google Form URLs and IDs', () => {
  const editUrl = 'https://docs.google.com/forms/d/1FAIpQLSfD_campusQuiz2026CS/edit';
  assert.equal(extractFormId(editUrl), '1FAIpQLSfD_campusQuiz2026CS');

  const viewUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfD_campusQuiz2026CS/viewform?usp=sf_link';
  assert.equal(extractFormId(viewUrl), '1FAIpQLSfD_campusQuiz2026CS');

  const rawId = '1FAIpQLSfD_campusQuiz2026CS';
  assert.equal(extractFormId(rawId), '1FAIpQLSfD_campusQuiz2026CS');

  const invalid = 'https://google.com/search?q=test';
  assert.equal(extractFormId(invalid), null);
});

test('validateGoogleFormsUrl identifies valid URLs and flags respondent links', () => {
  const editUrl = 'https://docs.google.com/forms/d/1FAIpQLSfD_campusQuiz2026CS/edit';
  const editRes = validateGoogleFormsUrl(editUrl);
  assert.equal(editRes.isValid, true);
  assert.equal(editRes.isRespondentLink, false);

  const respUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfD_campusQuiz2026CS/viewform';
  const respRes = validateGoogleFormsUrl(respUrl);
  assert.equal(respRes.isValid, true);
  assert.equal(respRes.isRespondentLink, true);
  assert.match(respRes.warning || '', /public respondent link/);
});

test('convertGoogleFormToAttlicAssessment converts 3 sections, single-choice, checkbox, required/optional, and answer keys', () => {
  const mockApiResponse = {
    formId: '1FAIpQLSfD_sampleTest2026',
    info: {
      title: 'University Campus Engineering Assessment',
      description: 'Comprehensive evaluation of CS algorithms and system fundamentals.',
    },
    items: [
      // Section 1: Algorithmic Foundations
      {
        itemId: 'item_1',
        title: 'What is the time complexity of binary search on sorted array?',
        description: 'Assume standard array indexing.',
        questionItem: {
          question: {
            questionId: 'q_item_1',
            required: true,
            grading: {
              pointValue: 2,
              correctAnswers: {
                answers: [{ value: 'O(log n)' }],
              },
            },
            choiceQuestion: {
              type: 'RADIO',
              options: [
                { value: 'O(n)' },
                { value: 'O(log n)' },
                { value: 'O(n^2)' },
              ],
            },
          },
        },
      },
      // Section 2 Break
      {
        itemId: 'break_1',
        title: 'Section 2: Operating Systems & Concurrency',
        description: 'Multi-threading and synchronization mechanisms.',
        pageBreakItem: {},
      },
      // Checkbox question with multiple answers
      {
        itemId: 'item_2',
        title: 'Which of the following are necessary conditions for deadlock?',
        questionItem: {
          question: {
            questionId: 'q_item_2',
            required: false,
            grading: {
              pointValue: 4,
              correctAnswers: {
                answers: [
                  { value: 'Mutual Exclusion' },
                  { value: 'Hold and Wait' },
                  { value: 'Circular Wait' },
                ],
              },
            },
            choiceQuestion: {
              type: 'CHECKBOX',
              options: [
                { value: 'Mutual Exclusion' },
                { value: 'Hold and Wait' },
                { value: 'Preemption' },
                { value: 'Circular Wait' },
              ],
            },
          },
        },
      },
      // Question without grading (inaccessible answer key)
      {
        itemId: 'item_3',
        title: 'Explain the difference between a process and a thread.',
        questionItem: {
          question: {
            questionId: 'q_item_3',
            required: true,
            textQuestion: {
              paragraph: true,
            },
          },
        },
      },
      // Section 3 Break
      {
        itemId: 'break_2',
        title: 'Section 3: System Design & Feedback',
        description: 'Architecture patterns and evaluation rating.',
        pageBreakItem: {},
      },
      // Unsupported question type (linear scale)
      {
        itemId: 'item_4',
        title: 'Rate your confidence in Distributed Systems on a scale of 1-10.',
        questionItem: {
          question: {
            questionId: 'q_item_4',
            required: false,
            scaleQuestion: {
              low: 1,
              high: 10,
            },
          },
        },
      },
    ],
  };

  const converted = convertGoogleFormToAttlicAssessment(
    mockApiResponse,
    'https://docs.google.com/forms/d/1FAIpQLSfD_sampleTest2026/edit'
  );

  assert.equal(converted.schemaVersion, '1.0');
  assert.equal(converted.source.formId, '1FAIpQLSfD_sampleTest2026');
  assert.equal(converted.assessment.title, 'University Campus Engineering Assessment');

  // Verify 3 sections preserved
  assert.equal(converted.assessment.sections.length, 3);
  assert.equal(converted.assessment.sections[0].title, 'Section 1: General');
  assert.equal(converted.assessment.sections[1].title, 'Section 2: Operating Systems & Concurrency');
  assert.equal(converted.assessment.sections[2].title, 'Section 3: System Design & Feedback');

  // Verify questions
  const q1 = converted.assessment.sections[0].questions[0];
  assert.equal(q1.type, 'single_choice');
  assert.equal(q1.marks, 2);
  assert.equal(q1.isRequired, true);
  assert.equal(q1.requiresAnswerKeyReview, false);
  assert.equal(q1.correctAnswers.length, 1);
  assert.equal(q1.correctAnswers[0], 'opt_b'); // 'O(log n)' mapped to opt_b

  const q2 = converted.assessment.sections[1].questions[0];
  assert.equal(q2.type, 'multiple_choice');
  assert.equal(q2.isRequired, false);
  assert.equal(q2.correctAnswers.length, 3);

  const q3 = converted.assessment.sections[1].questions[1];
  assert.equal(q3.type, 'short_text');
  assert.equal(q3.requiresAnswerKeyReview, true); // No grading present

  const q4 = converted.assessment.sections[2].questions[0];
  assert.notEqual(q4.unsupportedTypeWarning, null); // scaleQuestion converted with warning

  // Verify summary
  assert.equal(converted.summary.totalSections, 3);
  assert.equal(converted.summary.totalQuestions, 4);
  assert.equal(converted.summary.supportedQuestions, 3);
  assert.equal(converted.summary.unsupportedQuestions, 1);
  assert.equal(converted.summary.requiresAnswerKeyReview, 2); // q3 and q4
});

test('validateStandardizedJson validates schema structure', () => {
  const validJson = {
    schemaVersion: '1.0',
    source: { type: 'google_forms', formId: 'f123', importedAt: new Date().toISOString() },
    assessment: {
      title: 'Valid Quiz',
      description: 'Desc',
      sections: [
        {
          id: 's1',
          title: 'Section 1',
          order: 1,
          questions: [
            {
              id: 'q1',
              type: 'single_choice',
              title: 'What is 2+2?',
              options: [{ id: 'opt_1', text: '4' }],
              correctAnswers: ['opt_1'],
              marks: 1,
              negativeMarks: 0,
              isRequired: true,
              requiresAnswerKeyReview: false,
            },
          ],
        },
      ],
    },
    summary: { totalSections: 1, totalQuestions: 1, supportedQuestions: 1, unsupportedQuestions: 0, requiresAnswerKeyReview: 0, warnings: [] },
  };

  const res = validateStandardizedJson(validJson);
  assert.equal(res.isValid, true);
  assert.equal(res.errors.length, 0);

  const invalidJson = { schemaVersion: '0.9', assessment: { title: 'Missing sections' } };
  const badRes = validateStandardizedJson(invalidJson);
  assert.equal(badRes.isValid, false);
  assert.ok(badRes.errors.length > 0);
});
