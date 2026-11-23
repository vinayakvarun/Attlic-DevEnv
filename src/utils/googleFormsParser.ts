/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Google Forms API Extractor & Standardized Assessment Schema Converter
 */

import type {
  Assessment,
  AssessmentSection,
  Question,
  QuestionOption,
  QuestionType,
  StandardizedFormImport,
  StandardizedQuestion,
  StandardizedSection,
} from '../types/index.ts';

/**
 * Validates and extracts the Google Form ID from a given URL or raw ID string.
 */
export function extractFormId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Pattern 1: URL with /forms/d/<id> or /forms/u/X/d/<id>
  const match = trimmed.match(/(?:forms\/(?:u\/\d+\/)?d\/(?:e\/)?)([a-zA-Z0-9_-]{10,})/i);
  if (match && match[1]) {
    return match[1];
  }

  // Pattern 2: Raw ID alphanumeric with hyphens/underscores (typically 20-50 chars)
  if (/^[a-zA-Z0-9_-]{15,70}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Validates Google Form URL format and provides contextual guidance.
 */
export function validateGoogleFormsUrl(input: string): {
  isValid: boolean;
  formId: string | null;
  isRespondentLink: boolean;
  warning?: string;
} {
  const formId = extractFormId(input);
  if (!formId) {
    return {
      isValid: false,
      formId: null,
      isRespondentLink: false,
      warning: 'Invalid Google Forms link. Please provide a valid URL like https://docs.google.com/forms/d/<FORM_ID>/edit',
    };
  }

  const isRespondent = input.includes('/viewform') || input.includes('/d/e/');
  let warning: string | undefined;

  if (isRespondent) {
    warning =
      'This appears to be a public respondent link (/viewform). The official Google Forms API requires edit permissions. If the import fails with permission errors, please use your Form Editor URL (/edit).';
  }

  return {
    isValid: true,
    formId,
    isRespondentLink: isRespondent,
    warning,
  };
}

/**
 * Converts a raw Google Forms API v1 JSON response into attlic's standardized JSON format.
 */
export function convertGoogleFormToAttlicAssessment(
  apiData: any,
  originalUrl: string,
  importedBy?: string
): StandardizedFormImport {
  const formId = apiData?.formId || extractFormId(originalUrl) || `form_${Date.now()}`;
  const formTitle = apiData?.info?.title || apiData?.info?.documentTitle || 'Imported Google Form Assessment';
  const formDescription = apiData?.info?.description || 'Converted from Google Forms into attlic proctored format.';

  const warnings: string[] = [];
  const sections: StandardizedSection[] = [];

  let currentSectionQuestions: StandardizedQuestion[] = [];
  let currentSectionTitle = 'Section 1: General';
  let currentSectionDescription = '';
  let currentSectionOrder = 1;

  let totalQuestionsCount = 0;
  let supportedQuestionsCount = 0;
  let unsupportedQuestionsCount = 0;
  let requiresAnswerKeyReviewCount = 0;

  const flushCurrentSection = (nextTitle?: string, nextDesc?: string) => {
    sections.push({
      id: `sec_${currentSectionOrder}_${Date.now()}_${Math.floor(10 + Math.random() * 90)}`,
      title: currentSectionTitle,
      description: currentSectionDescription,
      order: currentSectionOrder,
      questions: currentSectionQuestions,
    });
    currentSectionQuestions = [];
    currentSectionOrder += 1;
    if (nextTitle) currentSectionTitle = nextTitle;
    if (nextDesc !== undefined) currentSectionDescription = nextDesc;
  };

  const rawItems: any[] = Array.isArray(apiData?.items) ? apiData.items : [];

  for (let idx = 0; idx < rawItems.length; idx++) {
    const item = rawItems[idx];

    // PageBreakItem represents a section break in Google Forms
    if (item.pageBreakItem) {
      if (currentSectionQuestions.length > 0 || sections.length === 0) {
        flushCurrentSection(item.title || `Section ${currentSectionOrder}`, item.description || '');
      } else {
        currentSectionTitle = item.title || `Section ${currentSectionOrder}`;
        currentSectionDescription = item.description || '';
      }
      continue;
    }

    // Process questions
    if (item.questionItem) {
      totalQuestionsCount += 1;
      const q = item.questionItem.question;
      const qTitle = item.title?.trim() || `Question ${totalQuestionsCount}`;
      const qDescription = item.description || '';
      const isRequired = !!q.required;

      let qType: QuestionType = 'single_choice';
      let options: QuestionOption[] = [];
      let correctAnswers: string[] = [];
      let isSupported = true;
      let typeWarning: string | null = null;
      let requiresReview = false;
      let marks = 1;

      // Check choice question (RADIO, CHECKBOX, DROP_DOWN)
      if (q.choiceQuestion) {
        const choiceType = q.choiceQuestion.type;
        if (choiceType === 'CHECKBOX') {
          qType = 'multiple_choice';
        } else if (choiceType === 'RADIO' || choiceType === 'DROP_DOWN') {
          qType = 'single_choice';
        } else {
          qType = 'single_choice';
        }

        const rawOpts: any[] = Array.isArray(q.choiceQuestion.options) ? q.choiceQuestion.options : [];
        options = rawOpts.map((opt, oIdx) => ({
          id: `opt_${String.fromCharCode(97 + oIdx)}`,
          text: opt.value || `Option ${oIdx + 1}`,
        }));

        // Detect True/False
        if (options.length === 2) {
          const lowerTexts = options.map((o) => o.text.trim().toLowerCase());
          if (lowerTexts.includes('true') && lowerTexts.includes('false')) {
            // True / False preserved as single choice
          }
        }
      } else if (q.textQuestion) {
        qType = 'short_text';
        options = [];
      } else {
        // Unsupported types: scaleQuestion, dateQuestion, timeQuestion, fileUploadQuestion, etc.
        isSupported = false;
        unsupportedQuestionsCount += 1;
        const rawTypeKey = Object.keys(q).find((k) => k.endsWith('Question')) || 'customQuestion';
        typeWarning = `Google Forms item type "${rawTypeKey}" is not natively evaluatable. Converted to short text placeholder to avoid dropping questions.`;
        warnings.push(`Question "${qTitle.slice(0, 40)}...": ${typeWarning}`);
        qType = 'short_text';
        options = [];
      }

      if (isSupported) {
        supportedQuestionsCount += 1;
      }

      // Check Grading / Answer Key
      if (q.grading) {
        if (typeof q.grading.pointValue === 'number') {
          marks = q.grading.pointValue;
        }

        const answersList = q.grading.correctAnswers?.answers;
        if (Array.isArray(answersList) && answersList.length > 0) {
          const correctTextValues = answersList.map((a: any) => a.value?.trim()).filter(Boolean);
          // Match with generated option ids
          const matchedIds = options
            .filter((o) => correctTextValues.includes(o.text.trim()))
            .map((o) => o.id);

          if (matchedIds.length > 0) {
            correctAnswers = matchedIds;
            requiresReview = false;
          } else if (qType === 'short_text' && correctTextValues.length > 0) {
            correctAnswers = correctTextValues;
            requiresReview = false;
          } else {
            requiresReview = true;
          }
        } else {
          requiresReview = true;
        }
      } else {
        requiresReview = true;
      }

      if (requiresReview) {
        requiresAnswerKeyReviewCount += 1;
      }

      const stdQ: StandardizedQuestion = {
        id: `q_${totalQuestionsCount}_${Date.now()}`,
        sourceItemId: item.itemId || q.questionId,
        type: qType,
        title: qTitle,
        description: qDescription,
        options,
        correctAnswers,
        marks: marks > 0 ? marks : 1,
        negativeMarks: 0,
        isRequired,
        requiresAnswerKeyReview: requiresReview,
        unsupportedTypeWarning: typeWarning,
      };

      currentSectionQuestions.push(stdQ);
    } else if (item.questionGroupItem) {
      // Grid questions
      const groupQuestions: any[] = Array.isArray(item.questionGroupItem.questions)
        ? item.questionGroupItem.questions
        : [];

      for (let gIdx = 0; gIdx < groupQuestions.length; gIdx++) {
        totalQuestionsCount += 1;
        unsupportedQuestionsCount += 1;
        const gQ = groupQuestions[gIdx];
        const gTitle = `${item.title || 'Grid'} - ${gQ.rowQuestion?.title || `Row ${gIdx + 1}`}`;

        warnings.push(`Grid question "${gTitle}" converted to single choice option row.`);

        const stdQ: StandardizedQuestion = {
          id: `q_${totalQuestionsCount}_grid_${Date.now()}`,
          sourceItemId: item.itemId,
          type: 'single_choice',
          title: gTitle,
          description: item.description || '',
          options: [
            { id: 'opt_a', text: 'Column 1' },
            { id: 'opt_b', text: 'Column 2' },
          ],
          correctAnswers: [],
          marks: 1,
          negativeMarks: 0,
          isRequired: false,
          requiresAnswerKeyReview: true,
          unsupportedTypeWarning: 'Imported from Google Forms Grid Item.',
        };
        currentSectionQuestions.push(stdQ);
      }
    } else if (item.textItem) {
      // Instructional text, preserve in section description if empty
      if (!currentSectionDescription && item.description) {
        currentSectionDescription = item.description;
      }
    }
  }

  // Flush remaining section
  flushCurrentSection();

  // If there are questions with answer keys missing, add warning
  if (requiresAnswerKeyReviewCount > 0) {
    warnings.unshift(
      `${requiresAnswerKeyReviewCount} question(s) do not have accessible answer keys from Google Forms and require manual configuration in attlic.`
    );
  }

  return {
    schemaVersion: '1.0',
    source: {
      type: 'google_forms',
      formId,
      originalUrl,
      importedAt: new Date().toISOString(),
      importedBy: importedBy || 'attlic recruiter',
    },
    assessment: {
      title: formTitle,
      description: formDescription,
      sections: sections.filter((s) => s.questions.length > 0 || sections.length === 1),
    },
    summary: {
      totalSections: sections.length,
      totalQuestions: totalQuestionsCount,
      supportedQuestions: supportedQuestionsCount,
      unsupportedQuestions: unsupportedQuestionsCount,
      requiresAnswerKeyReview: requiresAnswerKeyReviewCount,
      warnings,
    },
  };
}

/**
 * Validates a standardized JSON document before importing or converting.
 */
export function validateStandardizedJson(json: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!json || typeof json !== 'object') {
    return { isValid: false, errors: ['Input is not a valid JSON object.'] };
  }

  if (json.schemaVersion !== '1.0') {
    errors.push('Missing or unsupported schemaVersion (expected "1.0").');
  }

  if (!json.assessment || typeof json.assessment !== 'object') {
    errors.push('Missing required "assessment" object in JSON.');
  } else {
    if (!json.assessment.title || typeof json.assessment.title !== 'string') {
      errors.push('Assessment title is missing or invalid.');
    }

    if (!Array.isArray(json.assessment.sections) || json.assessment.sections.length === 0) {
      errors.push('Assessment must contain at least one section.');
    } else {
      json.assessment.sections.forEach((sec: any, sIdx: number) => {
        if (!sec.title) {
          errors.push(`Section ${sIdx + 1} is missing a title.`);
        }
        if (!Array.isArray(sec.questions)) {
          errors.push(`Section ${sIdx + 1} questions must be an array.`);
        } else {
          sec.questions.forEach((q: any, qIdx: number) => {
            if (!q.title && !q.text) {
              errors.push(`Question ${qIdx + 1} in Section ${sIdx + 1} is missing a title/statement.`);
            }
          });
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Converts a StandardizedFormImport into an attlic editable Assessment domain entity.
 */
export function convertStandardizedToAssessment(
  std: StandardizedFormImport,
  organizationId: string,
  recruiterId: string,
  recruiterEmail: string,
  organizationName: string
): Assessment {
  const now = new Date().toISOString();
  const baseCode = (std.assessment.title || 'CAMPUS')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 10);
  const code = `${baseCode || 'FORM'}-${Math.floor(1000 + Math.random() * 9000)}`;

  let totalMarks = 0;

  const sections: AssessmentSection[] = std.assessment.sections.map((sec, sIdx) => {
    const questions: Question[] = sec.questions.map((q, qIdx) => {
      const qMarks = Number(q.marks) || 1;
      totalMarks += qMarks;

      return {
        id: `q_${Date.now()}_${sIdx}_${qIdx}`,
        sectionId: sec.id,
        type: q.type,
        title: q.title,
        explanation: q.description || '',
        options: q.options || [],
        correctOptionIds: q.correctAnswers || [],
        marks: qMarks,
        negativeMarks: q.negativeMarks || 0,
        difficulty: 'medium',
        isRequired: q.isRequired ?? true,
        requiresAnswerKeyReview: !!q.requiresAnswerKeyReview,
        unsupportedTypeWarning: q.unsupportedTypeWarning || null,
      };
    });

    return {
      id: sec.id || `sec_${sIdx + 1}`,
      title: sec.title,
      description: sec.description || '',
      order: sec.order || sIdx + 1,
      questions,
    };
  });

  return {
    id: `assess_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    organizationId,
    recruiterId,
    recruiterEmail,
    organizationName,
    code,
    title: std.assessment.title,
    description: `${std.assessment.description} (Imported from Google Form ID: ${std.source.formId})`,
    status: 'draft',
    version: 1,
    durationMinutes: 45,
    totalMarks: totalMarks > 0 ? totalMarks : 100,
    passingMarks: Math.round((totalMarks > 0 ? totalMarks : 100) * 0.4),
    sections,
    antiCheating: {
      trackTabSwitches: true,
      maxTabSwitches: 3,
      enableTwoMinuteViolationBlock: true,
      enforceFullscreen: true,
      forceFullscreen: true,
      blockCopyPaste: true,
      webcamMonitoringNotice: false,
    },
    instructions: [
      'This assessment was converted from an authorized Google Form.',
      'Review question answer keys and point values before publishing.',
      'Active tab switching telemetry is enforced during testing.',
    ],
    showImmediateResults: std.assessment.showImmediateResults ?? true,
    creationSource: 'google_forms',
    enableCodingEnvironment: false,
    tags: ['Google Forms Import', 'Campus Drive 2026', 'Draft'],
    createdAt: now,
    updatedAt: now,
  };
}
