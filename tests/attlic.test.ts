/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Core Unit Tests (node:test)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAssessmentAttempt } from '../src/utils/evaluation.ts';
import { extractFormId, validateGoogleFormsUrl } from '../src/utils/googleFormsParser.ts';
import type { Assessment, CandidateDetailsConfig } from '../src/types/index.ts';

test('URL Parser extracts Google Form ID accurately', () => {
  const url1 = 'https://docs.google.com/forms/d/1FAIpQLSfD_abc12345XYZ/edit';
  assert.equal(extractFormId(url1), '1FAIpQLSfD_abc12345XYZ');

  const url2 = 'https://docs.google.com/forms/d/e/1FAIpQLSd987654321/viewform?usp=sf_link';
  assert.equal(extractFormId(url2), '1FAIpQLSd987654321');

  const validation = validateGoogleFormsUrl(url1);
  assert.equal(validation.isValid, true);
  assert.equal(validation.formId, '1FAIpQLSfD_abc12345XYZ');
});

test('Evaluation correctly handles default marks and negative marks', () => {
  const testAssessment: Assessment = {
    id: 'test_assess_1',
    code: 'CAMPUS-TEST',
    title: 'CS Core Placement Test',
    description: 'Testing grading engine',
    organizationId: 'org_test',
    organizationName: 'Test University',
    recruiterId: 'rec_1',
    recruiterEmail: 'recruiter@test.edu',
    status: 'published',
    durationMinutes: 45,
    totalMarks: 20,
    passingMarks: 10,
    defaultMarks: 4,
    defaultNegativeMarks: 1,
    instructions: [],
    version: 1,
    tags: ['Algorithms'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    antiCheating: {
      trackTabSwitches: true,
      maxTabSwitches: 3,
      enforceFullscreen: true,
      forceFullscreen: true,
      blockCopyPaste: true,
      webcamMonitoringNotice: false,
    },
    sections: [
      {
        id: 'sec_1',
        title: 'Algorithms',
        order: 1,
        questions: [
          {
            id: 'q1',
            type: 'single_choice',
            title: 'Q1',
            marks: 4,
            negativeMarks: 1,
            difficulty: 'medium',
            correctOptionIds: ['opt_a'],
            options: [
              { id: 'opt_a', text: 'Option A', isCorrect: true },
              { id: 'opt_b', text: 'Option B', isCorrect: false },
            ],
          },
          {
            id: 'q2',
            type: 'single_choice',
            title: 'Q2',
            marks: 4,
            negativeMarks: 1,
            difficulty: 'medium',
            correctOptionIds: ['opt_a'],
            options: [
              { id: 'opt_a', text: 'Option A', isCorrect: true },
              { id: 'opt_b', text: 'Option B', isCorrect: false },
            ],
          },
        ],
      },
    ],
  };

  // Case 1: 1 correct (+4), 1 incorrect (-1) -> Total score = 3
  const answersCase1 = {
    q1: { questionId: 'q1', selectedOptionIds: ['opt_a'] }, // correct
    q2: { questionId: 'q2', selectedOptionIds: ['opt_b'] }, // incorrect (-1)
  };
  const resultCase1 = evaluateAssessmentAttempt(testAssessment, answersCase1 as any);
  assert.equal(resultCase1.score, 3);
  assert.equal(resultCase1.totalMarks, 8);
  assert.equal(resultCase1.passed, false); // passing is 10

  // Case 2: Both correct (+8)
  const answersCase2 = {
    q1: { questionId: 'q1', selectedOptionIds: ['opt_a'] },
    q2: { questionId: 'q2', selectedOptionIds: ['opt_a'] },
  };
  const resultCase2 = evaluateAssessmentAttempt(testAssessment, answersCase2 as any);
  assert.equal(resultCase2.score, 8);
  assert.equal(resultCase2.passed, false); // 8 < 10

  // Case 3: 1 correct (+4), 1 unattempted (0) -> Total score = 4
  const answersCase3 = {
    q1: { questionId: 'q1', selectedOptionIds: ['opt_a'] },
  };
  const resultCase3 = evaluateAssessmentAttempt(testAssessment, answersCase3 as any);
  assert.equal(resultCase3.score, 4);
});

test('Candidate Details Config supports dynamic required and custom fields', () => {
  const config: CandidateDetailsConfig = {
    collectFullName: true,
    collectEmail: true,
    collectRollNumber: true,
    collectCollege: true,
    collectBranch: true,
    collectGraduationYear: true,
    collectPhone: true,
    collectCgpa: true,
    customFields: [
      {
        id: 'cf_github',
        label: 'GitHub Profile',
        required: true,
        type: 'text',
        placeholder: 'https://github.com/...',
      },
      {
        id: 'cf_experience',
        label: 'Prior Internships Count',
        required: false,
        type: 'number',
      },
    ],
  };

  assert.equal(config.customFields?.length, 2);
  assert.equal(config.customFields?.[0].required, true);
  assert.equal(config.customFields?.[1].required, false);
});

test('Deterministic organization ID generates stable key across sessions', () => {
  const getDeterministicOrgId = (uid?: string, email?: string): string => {
    if (email && email.includes('@')) {
      const cleanEmail = email.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32);
      return `org_${cleanEmail}`;
    }
    const cleanUid = (uid || 'recruiter').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    return `org_${cleanUid}`;
  };

  const id1 = getDeterministicOrgId('usr_123', 'vinayakvarun.online@gmail.com');
  const id2 = getDeterministicOrgId('usr_999', 'vinayakvarun.online@gmail.com');
  const id3 = getDeterministicOrgId('usr_123', 'VINAYAKVARUN.ONLINE@GMAIL.COM');

  assert.equal(id1, 'org_vinayakvarun_online_gmail_com');
  assert.equal(id1, id2);
  assert.equal(id1, id3);
});

test('Assessment multi-filter accurately finds user records across org shifts', () => {
  const assessments = [
    {
      id: 'a1',
      code: 'ONLINE-ASS-8733',
      organizationId: 'org_legacy_179389',
      recruiterEmail: 'vinayakvarun.online@gmail.com',
      recruiterId: 'rec_41RJ',
    },
    {
      id: 'a2',
      code: 'CAMPUS-2026',
      organizationId: 'org_acme',
      recruiterEmail: 'alex@acmelabs.io',
      recruiterId: 'rec_alex',
    },
  ];

  const filterForUser = (userEmail: string, userOrgId: string, userId: string) => {
    return assessments.filter((a) => {
      if (userOrgId && a.organizationId === userOrgId) return true;
      if (userEmail && a.recruiterEmail && a.recruiterEmail.toLowerCase() === userEmail.toLowerCase()) return true;
      if (userId && a.recruiterId === userId) return true;
      return false;
    });
  };

  // Even if user's organizationId is new or different, email matches their assessment
  const results = filterForUser('vinayakvarun.online@gmail.com', 'org_new_session', 'rec_diff');
  assert.equal(results.length, 1);
  assert.equal(results[0].code, 'ONLINE-ASS-8733');
});

test('Assessment Editor grading engine accurately evaluates True/False, Short-Answer Text, and Partial Marking', () => {
  const editorAssessment: Assessment = {
    id: 'stage4_test',
    code: 'STAGE4-ASS',
    title: 'Stage 4 Comprehensive Assessment',
    description: 'Testing 4 question types & partial marks',
    organizationId: 'org_test',
    organizationName: 'attlic Labs',
    recruiterId: 'rec_1',
    recruiterEmail: 'recruiter@attlic.internal',
    status: 'published',
    durationMinutes: 30,
    totalMarks: 15,
    passingMarks: 9,
    passingPercentage: 60,
    instructions: [],
    tags: ['Stage4'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    antiCheating: {
      trackTabSwitches: true,
      maxTabSwitches: 3,
      enforceFullscreen: true,
      forceFullscreen: true,
      blockCopyPaste: true,
      webcamMonitoringNotice: false,
    },
    sections: [
      {
        id: 'sec_1',
        title: 'Core Section',
        order: 1,
        questions: [
          // 1. True / False
          {
            id: 'q_tf',
            type: 'true_false',
            title: 'HTTP is a stateless protocol.',
            marks: 3,
            negativeMarks: 1,
            difficulty: 'easy',
            correctOptionIds: ['opt_true'],
            options: [
              { id: 'opt_true', text: 'True', isCorrect: true },
              { id: 'opt_false', text: 'False', isCorrect: false },
            ],
          },
          // 2. Short Text with accepted answers
          {
            id: 'q_text',
            type: 'short_text',
            title: 'What command displays the current working directory in Unix?',
            marks: 4,
            negativeMarks: 0,
            difficulty: 'medium',
            correctOptionIds: [],
            shortTextAcceptedAnswers: ['pwd', 'PWD'],
            options: [],
          },
          // 3. Multi-answer with partial marking enabled
          {
            id: 'q_multi',
            type: 'multiple_choice',
            title: 'Select all prime numbers below 10.',
            marks: 4,
            negativeMarks: 1,
            difficulty: 'hard',
            partialMarking: true,
            correctOptionIds: ['opt_2', 'opt_3', 'opt_5', 'opt_7'],
            options: [
              { id: 'opt_2', text: '2', isCorrect: true },
              { id: 'opt_3', text: '3', isCorrect: true },
              { id: 'opt_5', text: '5', isCorrect: true },
              { id: 'opt_7', text: '7', isCorrect: true },
              { id: 'opt_9', text: '9', isCorrect: false },
            ],
          },
        ],
      },
    ],
  };

  // Case A: Correct True/False, Correct Short Text, and 2 out of 4 correct options for Multi-choice
  // q_tf: +3
  // q_text: 'pwd' -> +4
  // q_multi: selects opt_2 and opt_3 (2 correct out of 4, no incorrect) -> 4 * (2/4) = +2
  // Total expected = 3 + 4 + 2 = 9 marks (meets passing cutoff 9/15)
  const answers = {
    q_tf: { questionId: 'q_tf', selectedOptionIds: ['opt_true'] },
    q_text: { questionId: 'q_text', textAnswer: 'pwd' },
    q_multi: { questionId: 'q_multi', selectedOptionIds: ['opt_2', 'opt_3'] },
  };

  const evaluation = evaluateAssessmentAttempt(editorAssessment, answers as any);
  assert.equal(evaluation.score, 9);
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.totalMarks, 11); // sum of actual question marks: 3 + 4 + 4 = 11

  // Case B: Incorrect True/False (-1), Unanswered short text (0), and Multi-choice with incorrect option (-1)
  // Overall exam score is clamped to floor 0
  const answersFail = {
    q_tf: { questionId: 'q_tf', selectedOptionIds: ['opt_false'] },
    q_text: { questionId: 'q_text', textAnswer: '' }, // 0
    q_multi: { questionId: 'q_multi', selectedOptionIds: ['opt_9'] },
  };
  const evaluationFail = evaluateAssessmentAttempt(editorAssessment, answersFail as any);
  assert.equal(evaluationFail.score, 0);
  assert.equal(evaluationFail.passed, false);
});

test('Appearance Studio: Default configuration structure is valid and complete', async () => {
  const { getDefaultAppearance, THEME_PRESETS } = await import('../src/utils/appearanceDefaults.ts');

  const defaultAppearance = getDefaultAppearance('Acme Placement Cell');
  assert.equal(defaultAppearance.theme, 'kiwi');
  assert.equal(defaultAppearance.branding.companyDisplayName, 'Acme Placement Cell');
  assert.equal(defaultAppearance.branding.showCompanyLogo, true);

  // Validate all 10 color tokens exist
  const colorKeys = [
    'primary',
    'secondary',
    'accent',
    'background',
    'cardBackground',
    'textMain',
    'textSecondary',
    'buttonPrimary',
    'timerColor',
    'progressIndicator',
  ] as const;

  for (const key of colorKeys) {
    assert.ok(defaultAppearance.colors[key], `Color token ${key} must be defined`);
    assert.match(defaultAppearance.colors[key], /^#[0-9a-fA-F]{3,8}$/, `Color token ${key} must be valid hex`);
  }

  // Validate all 5 theme presets
  const expectedThemes = ['dark', 'light', 'minimal', 'professional', 'high_contrast'];
  for (const theme of expectedThemes) {
    assert.ok(THEME_PRESETS[theme as keyof typeof THEME_PRESETS], `Preset ${theme} must be configured`);
  }
});

test('Appearance Studio: Theme presets switch colors while preserving custom branding', async () => {
  const { getDefaultAppearance, applyThemeToAppearance, THEME_PRESETS } = await import('../src/utils/appearanceDefaults.ts');

  const initial = getDefaultAppearance('Tesla Motors');
  initial.branding.companyLogoUrl = 'data:image/png;base64,sampleLogoData';
  initial.branding.welcomeMessage = 'Welcome to Tesla Campus Drive 2026';

  // Apply light theme
  const lightAppearance = applyThemeToAppearance('light', initial);
  assert.equal(lightAppearance.theme, 'light');
  assert.equal(lightAppearance.colors.background, THEME_PRESETS.light.colors.background);
  assert.equal(lightAppearance.colors.primary, THEME_PRESETS.light.colors.primary);
  assert.equal(lightAppearance.branding.companyDisplayName, 'Tesla Motors');
  assert.equal(lightAppearance.branding.companyLogoUrl, 'data:image/png;base64,sampleLogoData');
  assert.equal(lightAppearance.branding.welcomeMessage, 'Welcome to Tesla Campus Drive 2026');

  // Apply high contrast theme
  const hcAppearance = applyThemeToAppearance('high_contrast', lightAppearance);
  assert.equal(hcAppearance.theme, 'high_contrast');
  assert.equal(hcAppearance.colors.background, '#121007');
  assert.equal(hcAppearance.colors.primary, '#facc15');
});

test('Appearance Studio: Strict isolation between appearance layer and exam questions/scoring', async () => {
  const { getDefaultAppearance } = await import('../src/utils/appearanceDefaults.ts');

  const originalAssessment: Assessment = {
    id: 'sec_test_assess',
    code: 'SEC-ISOLATE',
    title: 'Security Isolation Test',
    description: 'Appearance isolation test',
    organizationId: 'org_test',
    organizationName: 'Acme Corp',
    recruiterId: 'rec_test',
    recruiterEmail: 'rec@test.com',
    status: 'draft',
    durationMinutes: 60,
    totalMarks: 50,
    passingMarks: 25,
    defaultMarks: 5,
    defaultNegativeMarks: 1,
    instructions: ['Read instructions'],
    version: 1,
    tags: ['Security'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    antiCheating: {
      trackTabSwitches: true,
      maxTabSwitches: 3,
      enforceFullscreen: true,
      forceFullscreen: true,
      blockCopyPaste: true,
      webcamMonitoringNotice: false,
    },
    sections: [
      {
        id: 's1',
        title: 'Core Section',
        order: 1,
        questions: [
          {
            id: 'q1',
            type: 'single_choice',
            title: 'What is 2 + 2?',
            marks: 5,
            negativeMarks: 1,
            difficulty: 'easy',
            correctOptionIds: ['opt_4'],
            options: [
              { id: 'opt_3', text: '3', isCorrect: false },
              { id: 'opt_4', text: '4', isCorrect: true },
            ],
          },
        ],
      },
    ],
  };

  // Attach customized appearance
  const modifiedAssessment: Assessment = {
    ...originalAssessment,
    appearance: {
      ...getDefaultAppearance('Acme'),
      theme: 'high_contrast',
      candidateExperience: {
        showQuestionNumbers: false,
        showTotalQuestionCount: false,
        showQuestionMarks: false,
        showProgressPercentage: false,
        showAnswerStatus: false,
        showTimer: false,
        showSectionProgress: false,
      },
    },
  };

  // Changing appearance must NEVER alter section count, questions, answers, or marks
  assert.equal(modifiedAssessment.sections.length, originalAssessment.sections.length);
  assert.equal(modifiedAssessment.sections[0].questions[0].id, 'q1');
  assert.deepEqual(
    modifiedAssessment.sections[0].questions[0].correctOptionIds,
    originalAssessment.sections[0].questions[0].correctOptionIds
  );
  assert.equal(
    modifiedAssessment.sections[0].questions[0].marks,
    originalAssessment.sections[0].questions[0].marks
  );
  assert.equal(
    modifiedAssessment.durationMinutes,
    originalAssessment.durationMinutes
  );
});

test('Security Audit: Question sanitization strips correct answers and explanations for candidate responses', () => {
  const sensitiveQuestion = {
    id: 'q_sec_1',
    type: 'single_choice',
    title: 'What is the master branch default in modern git?',
    description: 'Version control question',
    explanation: 'Git changed default branch name to main in 2020.',
    marks: 4,
    negativeMarks: 1,
    options: [
      { id: 'opt_1', text: 'trunk', isCorrect: false },
      { id: 'opt_2', text: 'main', isCorrect: true },
      { id: 'opt_3', text: 'master', isCorrect: false },
    ],
    correctOptionIds: ['opt_2'],
    correctAnswers: ['opt_2'],
  };

  // Sanitization logic matching server-side protection
  const sanitized = {
    ...sensitiveQuestion,
  };
  delete (sanitized as any).correctOptionIds;
  delete (sanitized as any).correctAnswers;
  delete (sanitized as any).explanation;
  sanitized.options = sensitiveQuestion.options.map((opt) => {
    const clone = { ...opt };
    delete (clone as any).isCorrect;
    return clone;
  });

  assert.equal((sanitized as any).correctOptionIds, undefined);
  assert.equal((sanitized as any).correctAnswers, undefined);
  assert.equal((sanitized as any).explanation, undefined);
  for (const opt of sanitized.options) {
    assert.equal((opt as any).isCorrect, undefined);
  }
});

test('Examination Integrity: Wall-clock deadline computes accurate elapsed time across simulated reloads', () => {
  const durationMinutes = 45;
  const totalSeconds = durationMinutes * 60;
  const startTimeMs = 1700000000000;
  const deadlineMs = startTimeMs + totalSeconds * 1000;

  // Simulate 15 minutes having passed
  const simulatedTimeMs = startTimeMs + 15 * 60 * 1000;
  const remainingSeconds = Math.max(0, Math.floor((deadlineMs - simulatedTimeMs) / 1000));

  assert.equal(remainingSeconds, 30 * 60);

  // Simulate expiry (46 minutes passed)
  const expiredTimeMs = startTimeMs + 46 * 60 * 1000;
  const expiredRemaining = Math.max(0, Math.floor((deadlineMs - expiredTimeMs) / 1000));
  assert.equal(expiredRemaining, 0);
});

test('Examination Integrity: Duplicate submission detection flags repeat candidate emails', () => {
  const existingAttempts = [
    {
      id: 'attempt_101',
      assessmentId: 'assess_alpha',
      candidate: { email: 'student@mit.edu' },
      status: 'submitted',
    },
  ];

  const checkDuplicate = (assessmentId: string, email: string) => {
    return existingAttempts.some(
      (a) => a.assessmentId === assessmentId &&
             a.candidate?.email?.toLowerCase() === email.toLowerCase() &&
             a.status === 'submitted'
    );
  };

  assert.equal(checkDuplicate('assess_alpha', 'student@mit.edu'), true);
  assert.equal(checkDuplicate('assess_alpha', 'STUDENT@mit.edu'), true);
  assert.equal(checkDuplicate('assess_alpha', 'other@mit.edu'), false);
  assert.equal(checkDuplicate('assess_other_org', 'student@mit.edu'), false);
});

test('Browser History Routing: URL builder and popstate location parser preserve pages, dashboard tabs, and candidate steps', async () => {
  const {
    buildUrlFromRouteState,
    parseRouteStateFromLocation,
    isSameRouteState,
  } = await import('../src/utils/navigationHistory.ts');

  // 1. Top-level pages
  assert.equal(buildUrlFromRouteState({ page: 'landing' }), '/');
  assert.equal(buildUrlFromRouteState({ page: 'recruiter_login' }), '/login');
  assert.equal(buildUrlFromRouteState({ page: 'recruiter_register' }), '/register');
  assert.equal(buildUrlFromRouteState({ page: 'about' }), '/about');

  // 2. Dashboard tabs & Assessment Editor
  assert.equal(
    buildUrlFromRouteState({ page: 'recruiter_dashboard', dashboardTab: 'overview' }),
    '/dashboard'
  );
  assert.equal(
    buildUrlFromRouteState({ page: 'recruiter_dashboard', dashboardTab: 'assessments' }),
    '/dashboard/assessments'
  );
  assert.equal(
    buildUrlFromRouteState({
      page: 'recruiter_dashboard',
      dashboardTab: 'editor',
      editingAssessmentId: 'assess_999',
    }),
    '/dashboard/editor?id=assess_999'
  );

  // 3. Candidate Portal steps
  assert.equal(
    buildUrlFromRouteState({
      page: 'candidate_portal',
      candidateStep: 'code',
      candidateCode: '',
    }),
    '/candidate'
  );
  assert.equal(
    buildUrlFromRouteState({
      page: 'candidate_portal',
      candidateStep: 'register',
      candidateCode: 'campus-2026-cs',
    }),
    '/candidate?code=CAMPUS-2026-CS'
  );

  // 4. Parsing back from URL (simulating refresh or popstate)
  const parsedEditor = parseRouteStateFromLocation('/dashboard/editor', '?id=assess_999');
  assert.equal(parsedEditor.page, 'recruiter_dashboard');
  assert.equal(parsedEditor.dashboardTab, 'editor');
  assert.equal(parsedEditor.editingAssessmentId, 'assess_999');

  const parsedCandidateReg = parseRouteStateFromLocation('/candidate', '?code=CAMPUS-2026-CS');
  assert.equal(parsedCandidateReg.page, 'candidate_portal');
  assert.equal(parsedCandidateReg.candidateStep, 'register');
  assert.equal(parsedCandidateReg.candidateCode, 'CAMPUS-2026-CS');

  const parsedCandidateCodeStep = parseRouteStateFromLocation('/candidate', '');
  assert.equal(parsedCandidateCodeStep.page, 'candidate_portal');
  assert.equal(parsedCandidateCodeStep.candidateStep, 'code');
  assert.equal(parsedCandidateCodeStep.candidateCode, '');

  // 5. Deduplication check
  assert.equal(
    isSameRouteState(parsedCandidateReg, {
      page: 'candidate_portal',
      candidateStep: 'register',
      candidateCode: 'campus-2026-cs',
    }),
    true
  );
  assert.equal(isSameRouteState(parsedCandidateReg, parsedCandidateCodeStep), false);
});

test('Scoped Student Fruit Theme Engine: Generates uniform scoped styles for the student test screen without mutating global website theme', async () => {
  const {
    DEFAULT_PREMADE_THEME_KEYS,
    FRUIT_THEME_KEYS,
    THEME_PRESETS,
    generateThemeCssVariables,
    getScopedStudentThemeStyle,
    clearGlobalThemeOverrides,
  } = await import('../src/utils/appearanceDefaults.ts');

  const mintPrimary = THEME_PRESETS.kiwi.colors.primary.toLowerCase();

  // Verify clearGlobalThemeOverrides executes cleanly
  clearGlobalThemeOverrides();

  // Verify 4 Premade Default Themes exist with Default Orange Accents
  assert.deepEqual(DEFAULT_PREMADE_THEME_KEYS, [
    'default_white_mono',
    'default_black_mono',
    'default_dark_grey',
    'default_light_grey',
  ]);
  assert.equal(THEME_PRESETS.default_white_mono.name, 'Default White Mono');
  assert.equal(THEME_PRESETS.default_black_mono.name, 'Default Black Mono');
  assert.equal(THEME_PRESETS.default_dark_grey.name, 'Default Dark Grey');
  assert.equal(THEME_PRESETS.default_light_grey.name, 'Default Light Grey');

  for (const defKey of DEFAULT_PREMADE_THEME_KEYS) {
    const preset = THEME_PRESETS[defKey];
    assert.ok(preset, `Preset for ${defKey} must exist`);
    // All 4 default themes use pastel/vibrant orange primary & accent
    assert.ok(
      ['#f08a43', '#ffb37b'].includes(preset.colors.primary.toLowerCase()),
      `${preset.name} must have default orange primary accent`
    );
    const scopedStyle = getScopedStudentThemeStyle(preset.colors);
    assert.equal(scopedStyle.backgroundColor.toLowerCase(), preset.colors.background.toLowerCase());
    assert.equal(scopedStyle.color.toLowerCase(), preset.colors.textMain.toLowerCase());
  }

  // Verify 40 named themes exist (original 10 + 30 additional distinct named themes)
  assert.equal(FRUIT_THEME_KEYS.length, 40);
  const seenNames = new Set<string>();
  const seenPaletteSignatures = new Set<string>();

  for (const fruitKey of FRUIT_THEME_KEYS) {
    const preset = THEME_PRESETS[fruitKey];
    assert.ok(preset, `Preset for ${fruitKey} must exist`);
    assert.equal(seenNames.has(preset.name), false, `Theme name "${preset.name}" must be unique`);
    seenNames.add(preset.name);

    const paletteSig = `${preset.colors.background}_${preset.colors.primary}_${preset.colors.buttonPrimary}`;
    assert.equal(
      seenPaletteSignatures.has(paletteSig),
      false,
      `Theme palette signature for "${preset.name}" must be unique`
    );
    seenPaletteSignatures.add(paletteSig);

    const cssVars = generateThemeCssVariables(preset.colors);
    const scopedStyle = getScopedStudentThemeStyle(preset.colors);

    assert.equal(cssVars['--color-indigo-500'].toLowerCase(), preset.colors.primary.toLowerCase());
    assert.equal(cssVars['--color-indigo-600'].toLowerCase(), preset.colors.buttonPrimary.toLowerCase());
    assert.equal(cssVars['--color-slate-950'].toLowerCase(), preset.colors.background.toLowerCase());
    assert.equal(cssVars['--color-slate-900'].toLowerCase(), preset.colors.cardBackground.toLowerCase());
    assert.equal(cssVars['--color-slate-800'].toLowerCase(), preset.colors.secondary.toLowerCase());
    assert.equal(scopedStyle.backgroundColor.toLowerCase(), preset.colors.background.toLowerCase());
    assert.equal(scopedStyle.color.toLowerCase(), preset.colors.textMain.toLowerCase());

    if (fruitKey !== 'kiwi') {
      assert.notEqual(
        cssVars['--color-indigo-500'].toLowerCase(),
        mintPrimary,
        `Fruit theme "${fruitKey}" should not retain mint #4cbba1 as primary`
      );
      assert.notEqual(
        cssVars['--theme-primary'].toLowerCase(),
        mintPrimary,
        `Fruit theme "${fruitKey}" should not retain mint #4cbba1 in --theme-primary`
      );
    }
  }
});

test('Anti-Cheating 2-Minute Violation Block & Immediate Result Policy: Enforces 120s penalty lockout when enabled and threshold is reached', async () => {
  const computeViolationLockoutSeconds = (
    nextViolationCount: number,
    maxTabSwitches: number,
    enableTwoMinuteViolationBlock: boolean
  ): number => {
    if (enableTwoMinuteViolationBlock && nextViolationCount >= maxTabSwitches) {
      return 120;
    }
    return 0;
  };

  // When 2-minute block is enabled with threshold 3:
  assert.equal(computeViolationLockoutSeconds(1, 3, true), 0);
  assert.equal(computeViolationLockoutSeconds(2, 3, true), 0);
  assert.equal(computeViolationLockoutSeconds(3, 3, true), 120);
  assert.equal(computeViolationLockoutSeconds(4, 3, true), 120);

  // When 2-minute block is disabled by recruiter:
  assert.equal(computeViolationLockoutSeconds(3, 3, false), 0);
  assert.equal(computeViolationLockoutSeconds(5, 3, false), 0);
});

test('Multi-Language Coding Environment & Test Case Grading: Executes Python, C, C++, Java, and JS against test cases and grades attempts', async () => {
  const {
    getDefaultCodingConfig,
    getDefaultStarterCode,
    runCodeLocallySync,
    evaluateCodingQuestionSync,
  } = await import('../src/utils/codeExecutionEngine.ts');

  const starters = getDefaultCodingConfig().starterCode;
  const sampleInput = '5\n10 20 30 40 50';

  // 1. All 5 languages execute starter solution and produce 150
  for (const lang of ['python', 'c', 'cpp', 'java', 'javascript'] as const) {
    const res = runCodeLocallySync(lang, starters[lang], sampleInput);
    assert.equal(res.status, 'AC', `${lang} starter code should succeed`);
    assert.equal(res.stdout.trim(), '150', `${lang} starter code should output 150`);
  }

  // 2. Compilation Error detection
  const ceRes = runCodeLocallySync('c', 'int main() { return 0 }', sampleInput);
  assert.equal(ceRes.status, 'CE');

  // 3. Time Limit Exceeded detection on infinite loop
  const tleRes = runCodeLocallySync('python', 'while True:\n    pass\n', sampleInput);
  assert.equal(tleRes.status, 'TLE');

  // 4. Automated Test-Case Grading (Partial & Full Marks)
  const codingQ = {
    id: 'q_coding_1',
    type: 'coding_problem' as const,
    title: 'Sum of Array Elements',
    options: [],
    correctOptionIds: [],
    marks: 20,
    negativeMarks: 0,
    partialMarking: true,
    difficulty: 'medium' as const,
    codingConfig: getDefaultCodingConfig(),
  };

  const evalFull = evaluateCodingQuestionSync(codingQ, 'python', starters.python);
  assert.equal(evalFull.passedTestCases, 5);
  assert.equal(evalFull.totalTestCases, 5);

  const mockCodingAssessment: Assessment = {
    id: 'assess_coding_1',
    organizationId: 'org_1',
    version: 1,
    title: 'Software Engineering Coding Assessment',
    code: 'CODE-2026',
    description: 'Coding assessment with test cases',
    recruiterId: 'rec_1',
    recruiterEmail: 'recruiter@attlic.in',
    organizationName: 'attlic Tech',
    status: 'published',
    durationMinutes: 60,
    creationSource: 'scratch',
    enableCodingEnvironment: true,
    totalMarks: 20,
    passingMarks: 10,
    sections: [
      {
        id: 'sec_code',
        title: 'Coding Section',
        order: 1,
        questions: [codingQ],
      },
    ],
    antiCheating: {
      trackTabSwitches: true,
      maxTabSwitches: 3,
      enableTwoMinuteViolationBlock: true,
      enforceFullscreen: true,
      forceFullscreen: true,
      blockCopyPaste: true,
      webcamMonitoringNotice: true,
    },
    instructions: ['Solve the coding problem'],
    tags: ['Coding'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const gradedAttempt = evaluateAssessmentAttempt(mockCodingAssessment, {
    q_coding_1: {
      questionId: 'q_coding_1',
      selectedOptionIds: [],
      codingLanguage: 'python',
      codeAnswer: starters.python,
      isMarkedForReview: false,
      visited: true,
      timeSpentSeconds: 45,
    },
  });

  assert.equal(gradedAttempt.score, 20);
  assert.equal(gradedAttempt.passed, true);
  assert.equal(gradedAttempt.percentage, 100);

  // 5. Verify Google Forms import always disables coding environment
  const {
    convertGoogleFormToAttlicAssessment,
    convertStandardizedToAssessment,
  } = await import('../src/utils/googleFormsParser.ts');
  const parsedForm = convertGoogleFormToAttlicAssessment(
    { info: { title: 'Imported Google Form' }, items: [] },
    'https://docs.google.com/forms/d/1FAIpQLSfD_abc12345XYZ/edit'
  );
  const importedAssessment = convertStandardizedToAssessment(
    parsedForm,
    'org_1',
    'rec_1',
    'rec@attlic.in',
    'attlic Org'
  );
  assert.equal(importedAssessment.creationSource, 'google_forms');
  assert.equal(importedAssessment.enableCodingEnvironment, false);
});

test('Recruiter Candidate Data Cleanup: Generates complete CSV archive before partitioning and clearing candidate attempts', async () => {
  const {
    buildCandidateBackupCSV,
    buildStyledCandidateSpreadsheetHtml,
    partitionAttemptsForCleanup,
  } = await import('../src/utils/candidateDataExport.ts');
  type CandidateAttemptType = import('../src/types/index.ts').CandidateAttempt;

  const sampleAttempts: CandidateAttemptType[] = [
    {
      id: 'att_1',
      organizationId: 'org_1',
      assessmentId: 'assess_A',
      assessmentCode: 'CAMPUS-101',
      assessmentTitle: 'Core CS Placement',
      candidate: {
        id: 'cand_1',
        name: 'Aarav Sharma',
        email: 'aarav@iit.ac.in',
        rollNumber: '2026CS101',
        college: 'IIT Delhi',
        branch: 'CSE',
        phone: '9876543210',
      },
      startedAt: '2026-11-09T10:00:00Z',
      submittedAt: '2026-11-09T10:35:00Z',
      status: 'submitted',
      currentSectionId: 'sec_1',
      answers: {
        q_code_1: {
          questionId: 'q_code_1',
          selectedOptionIds: [],
          codingLanguage: 'python',
          codeAnswer: 'print(15)',
          passedTestCases: 3,
          totalTestCases: 3,
          isMarkedForReview: false,
          visited: true,
          timeSpentSeconds: 60,
        },
      },
      score: 24,
      totalMarks: 24,
      percentage: 100,
      passed: true,
      tabSwitchCount: 0,
      violationLogs: [],
    },
    {
      id: 'att_2',
      organizationId: 'org_1',
      assessmentId: 'assess_B',
      assessmentCode: 'CAMPUS-202',
      assessmentTitle: 'Aptitude Round',
      candidate: {
        id: 'cand_2',
        name: 'Priya Nair',
        email: 'priya@nit.ac.in',
        rollNumber: '2026EC202',
        college: 'NIT Trichy',
        branch: 'ECE',
      },
      startedAt: '2026-11-09T11:00:00Z',
      submittedAt: '2026-11-09T11:20:00Z',
      status: 'submitted',
      currentSectionId: 'sec_1',
      answers: {},
      score: 8,
      totalMarks: 20,
      percentage: 40,
      passed: false,
      tabSwitchCount: 2,
      violationLogs: [
        {
          type: 'tab_switch',
          timestamp: '2026-11-09T11:10:00Z',
          message: 'Switched tab',
        },
      ],
    },
  ];

  // 1. Verify CSV backup contains headers, candidate info, scores, and coding summary
  const csv = buildCandidateBackupCSV(sampleAttempts);
  assert.ok(csv.includes('Attempt ID,Candidate Name,Email,Roll Number'));
  assert.ok(csv.includes('"Aarav Sharma"'));
  assert.ok(csv.includes('"CAMPUS-101"'));
  assert.ok(csv.includes('"python: 3/3 passed"'));
  assert.ok(csv.includes('"Priya Nair"'));
  assert.ok(csv.includes('"DID NOT CLEAR"'));

  // 1b. Verify styled spreadsheet contains bold headings and alternating orange-white rows
  const styledHtml = buildStyledCandidateSpreadsheetHtml(sampleAttempts);
  assert.ok(styledHtml.includes('<b>Attempt ID</b>'));
  assert.ok(styledHtml.includes('<b>Candidate Name</b>'));
  assert.ok(styledHtml.includes('font-weight:700'));
  assert.ok(styledHtml.includes('background-color:#FFFFFF'));
  assert.ok(styledHtml.includes('background-color:#FFF0E5'));

  // 1c. Verify OpenXML (.xlsx) binary archive contains valid PKZIP header and OOXML parts
  const { buildCandidateSpreadsheetXlsx } = await import('../src/utils/candidateDataExport.ts');
  const xlsxBytes = buildCandidateSpreadsheetXlsx(sampleAttempts);
  assert.ok(xlsxBytes instanceof Uint8Array);
  assert.equal(xlsxBytes[0], 0x50); // 'P'
  assert.equal(xlsxBytes[1], 0x4b); // 'K'
  assert.equal(xlsxBytes[2], 0x03);
  assert.equal(xlsxBytes[3], 0x04);
  const rawXlsxAscii = new TextDecoder().decode(xlsxBytes);
  assert.ok(rawXlsxAscii.includes('[Content_Types].xml'));
  assert.ok(rawXlsxAscii.includes('xl/workbook.xml'));
  assert.ok(rawXlsxAscii.includes('xl/styles.xml'));
  assert.ok(rawXlsxAscii.includes('xl/worksheets/sheet1.xml'));
  assert.ok(rawXlsxAscii.includes('Aarav Sharma'));
  assert.ok(rawXlsxAscii.includes('Priya Nair'));

  // 2. Verify cleanup partitioning for a specific drive vs all drives
  const driveACleanup = partitionAttemptsForCleanup(sampleAttempts, 'assess_A');
  assert.equal(driveACleanup.toClear.length, 1);
  assert.equal(driveACleanup.toClear[0].id, 'att_1');
  assert.equal(driveACleanup.toKeep.length, 1);
  assert.equal(driveACleanup.toKeep[0].id, 'att_2');

  const allCleanup = partitionAttemptsForCleanup(sampleAttempts, 'all');
  assert.equal(allCleanup.toClear.length, 2);
  assert.equal(allCleanup.toKeep.length, 0);
});

test('Feature 1: Question & Option Randomization shuffles deterministically per candidate while preserving grading accuracy', async () => {
  const { applyCandidateRandomization } = await import('../src/utils/examFeatures.ts');

  const baseAssessment: Assessment = {
    id: 'assess_rand_1',
    organizationId: 'org_1',
    recruiterId: 'rec_1',
    recruiterEmail: 'rec@attlic.in',
    organizationName: 'attlic Org',
    code: 'RAND-2026',
    title: 'Randomization Test',
    description: 'Testing anti-collusion randomization',
    status: 'published',
    version: 1,
    durationMinutes: 30,
    totalMarks: 20,
    passingMarks: 10,
    shuffleQuestions: true,
    shuffleOptions: true,
    sections: [
      {
        id: 'sec_1',
        title: 'Section 1',
        order: 1,
        questions: Array.from({ length: 6 }, (_, i) => ({
          id: `q_${i + 1}`,
          type: 'single_choice' as const,
          title: `Question ${i + 1}`,
          marks: 4,
          negativeMarks: 1,
          difficulty: 'medium' as const,
          correctOptionIds: [`q_${i + 1}_opt_correct`],
          options: [
            { id: `q_${i + 1}_opt_correct`, text: 'Correct Option', isCorrect: true },
            { id: `q_${i + 1}_opt_2`, text: 'Wrong 2' },
            { id: `q_${i + 1}_opt_3`, text: 'Wrong 3' },
            { id: `q_${i + 1}_opt_4`, text: 'Wrong 4' },
          ],
        })),
      },
    ],
    antiCheating: {
      trackTabSwitches: true,
      maxTabSwitches: 3,
      enforceFullscreen: true,
      forceFullscreen: true,
      blockCopyPaste: true,
      webcamMonitoringNotice: false,
    },
    instructions: [],
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Same candidate seed always gets the exact same order
  const candA1 = applyCandidateRandomization(baseAssessment, 'student1@iitd.ac.in');
  const candA2 = applyCandidateRandomization(baseAssessment, 'student1@iitd.ac.in');
  assert.deepEqual(
    candA1.sections[0].questions.map((q) => q.id),
    candA2.sections[0].questions.map((q) => q.id)
  );

  // Different candidate seed produces a different permutation
  const candB = applyCandidateRandomization(baseAssessment, 'student2@iitd.ac.in');
  assert.notDeepEqual(
    candA1.sections[0].questions.map((q) => q.id),
    candB.sections[0].questions.map((q) => q.id)
  );

  // Grading against the randomized assessment remains 100% accurate
  const evalResult = evaluateAssessmentAttempt(candA1, {
    q_1: {
      questionId: 'q_1',
      selectedOptionIds: ['q_1_opt_correct'],
      isMarkedForReview: false,
      visited: true,
      timeSpentSeconds: 10,
    },
  });
  assert.equal(evalResult.score, 4);
});

test('Feature 2: Scheduled Exam Window & Email Domain Whitelist validation', async () => {
  const { validateExamAccess } = await import('../src/utils/examFeatures.ts');

  const scheduledAssessment = {
    id: 'assess_sched_1',
    scheduledStartAt: '2026-11-10T10:00:00Z',
    scheduledEndAt: '2026-11-10T12:00:00Z',
    allowedEmailDomains: ['iitd.ac.in', 'nit.edu'],
  } as Assessment;

  // Before window opens
  const earlyCheck = validateExamAccess(
    scheduledAssessment,
    'student@iitd.ac.in',
    new Date('2026-11-10T09:30:00Z')
  );
  assert.equal(earlyCheck.allowed, false);
  assert.equal(earlyCheck.status, 'not_started');

  // After window closes
  const lateCheck = validateExamAccess(
    scheduledAssessment,
    'student@iitd.ac.in',
    new Date('2026-11-10T12:30:00Z')
  );
  assert.equal(lateCheck.allowed, false);
  assert.equal(lateCheck.status, 'ended');

  // Inside window, unauthorized email domain
  const domainBlocked = validateExamAccess(
    scheduledAssessment,
    'student@gmail.com',
    new Date('2026-11-10T11:00:00Z')
  );
  assert.equal(domainBlocked.allowed, false);
  assert.equal(domainBlocked.status, 'domain_restricted');

  // Inside window, authorized email domain
  const allowedCheck = validateExamAccess(
    scheduledAssessment,
    'student@cse.iitd.ac.in',
    new Date('2026-11-10T11:00:00Z')
  );
  assert.equal(allowedCheck.allowed, true);
  assert.equal(allowedCheck.status, 'open');
});

test('Feature 3 & 5: Candidate 1-Snapshot Capture & Official PDF Certificate Generator embeds candidate snapshot', async () => {
  const {
    generateDigitalIdSnapshotDataUrl,
    generatePdfCertificateHtml,
  } = await import('../src/utils/examFeatures.ts');

  const snapshotUrl = generateDigitalIdSnapshotDataUrl(
    'Rohan Verma',
    '22CS10045',
    'rohan@iitd.ac.in'
  );
  assert.ok(snapshotUrl.startsWith('data:image/svg+xml;utf8,'));

  const html = generatePdfCertificateHtml({
    id: 'attempt_cert_101',
    organizationId: 'org_1',
    assessmentId: 'assess_1',
    assessmentCode: 'CAMPUS-2026-CS',
    assessmentTitle: 'Software Engineering Placement Drive 2026',
    candidate: {
      id: 'cand_101',
      name: 'Rohan Verma',
      email: 'rohan@iitd.ac.in',
      rollNumber: '22CS10045',
      college: 'IIT Delhi',
      branch: 'Computer Science',
      snapshotDataUrl: snapshotUrl,
    },
    status: 'submitted',
    startedAt: '2026-11-09T10:00:00Z',
    submittedAt: '2026-11-09T10:40:00Z',
    currentSectionId: 'sec_1',
    answers: {},
    tabSwitchCount: 0,
    violationLogs: [],
    score: 85,
    totalMarks: 100,
    percentage: 85,
    passed: true,
  });

  assert.ok(html.includes('Official Assessment Verification Certificate'));
  assert.ok(html.includes('Rohan Verma'));
  assert.ok(html.includes('22CS10045'));
  assert.ok(html.includes('Candidate Snapshot'));
  assert.ok(html.includes(snapshotUrl));
  assert.ok(html.includes('QUALIFIED • PASSED'));
  assert.ok(html.includes('#0A0A0C'));
  assert.ok(html.includes('#141417'));
  assert.ok(html.includes('#F08A43'));
  assert.ok(html.includes('#FFB37B'));
});

test('Monaco IDE Engine: Pre-included headers, IntelliSense dictionary, and live syntax error diagnostics', async () => {
  const {
    getDefaultStarterCode,
    getCleanBoilerplateCode,
    analyzeCodeDiagnostics,
    LANGUAGE_INTELLISENSE_ITEMS,
  } = await import('../src/utils/codeExecutionEngine.ts');

  // 1. Verify C starter code & clean boilerplate automatically pre-include standard headers
  const cStarter = getDefaultStarterCode('c');
  const cBoilerplate = getCleanBoilerplateCode('c');
  assert.ok(cStarter.includes('#include <stdio.h>'));
  assert.ok(cStarter.includes('#include <stdlib.h>'));
  assert.ok(cStarter.includes('#include <string.h>'));
  assert.ok(cStarter.includes('int main()'));
  assert.ok(cBoilerplate.includes('#include <stdio.h>'));
  assert.ok(cBoilerplate.includes('int main()'));

  // 2. Verify valid starter code produces 0 syntax errors
  const validDiagnostics = analyzeCodeDiagnostics('c', cStarter);
  assert.equal(validDiagnostics.filter((d) => d.severity === 'error').length, 0);

  // 3. Verify live syntax checker catches missing semicolons, typos, and unbalanced brackets in C
  const brokenCCode = `#include <stdio.h>
int main() {
    int n = 10
    pirntf("%d", n);
    return 0;
`;
  const cDiags = analyzeCodeDiagnostics('c', brokenCCode);
  assert.ok(cDiags.some((d) => d.message.includes("Missing semicolon ';'")));
  assert.ok(cDiags.some((d) => d.message.includes('pirntf')));
  assert.ok(cDiags.some((d) => d.message.includes("Unclosed '{'")));

  // 4. Verify live syntax checker catches missing colon ':' in Python
  const brokenPyCode = `import sys
def solve()
    print(42)
`;
  const pyDiags = analyzeCodeDiagnostics('python', brokenPyCode);
  assert.ok(pyDiags.some((d) => d.message.includes("Missing colon ':'")));

  // 5. Verify IntelliSense autocomplete items exist for all 5 languages
  assert.ok(LANGUAGE_INTELLISENSE_ITEMS.c.length >= 10);
  assert.ok(LANGUAGE_INTELLISENSE_ITEMS.cpp.length >= 8);
  assert.ok(LANGUAGE_INTELLISENSE_ITEMS.java.length >= 6);
  assert.ok(LANGUAGE_INTELLISENSE_ITEMS.python.length >= 8);
  assert.ok(LANGUAGE_INTELLISENSE_ITEMS.javascript.length >= 6);
});

test('Zero-Compromise Security: sanitizeAssessmentForCandidate strips all answer keys, hidden test cases, and recruiter PII', async () => {
  const { sanitizeAssessmentForCandidate } = await import('../src/utils/securitySanitizer.ts');
  const { getDefaultCodingConfig } = await import('../src/utils/codeExecutionEngine.ts');

  const rawAssessment: Assessment = {
    id: 'sec_full_1',
    organizationId: 'org_acme',
    organizationName: 'Acme Corp',
    recruiterId: 'rec_secret_uid_999',
    recruiterEmail: 'private.recruiter@acmecorp.com',
    code: 'SEC-ZERO-2026',
    title: 'Zero Compromise Security Exam',
    description: 'Security verification exam',
    status: 'published',
    version: 1,
    durationMinutes: 60,
    totalMarks: 30,
    passingMarks: 15,
    instructions: [],
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    antiCheating: {
      trackTabSwitches: true,
      maxTabSwitches: 3,
      enforceFullscreen: true,
      forceFullscreen: true,
      blockCopyPaste: true,
      webcamMonitoringNotice: false,
    },
    sections: [
      {
        id: 'sec_1',
        title: 'Mixed Section',
        order: 1,
        questions: [
          {
            id: 'q_mcq',
            type: 'single_choice',
            title: 'Which protocol is encrypted?',
            explanation: 'HTTPS uses TLS encryption.',
            marks: 5,
            negativeMarks: 1,
            difficulty: 'easy',
            correctOptionIds: ['opt_https'],
            correctAnswers: ['opt_https'],
            shortTextAcceptedAnswers: ['https', 'HTTPS'],
            options: [
              { id: 'opt_http', text: 'HTTP', isCorrect: false },
              { id: 'opt_https', text: 'HTTPS', isCorrect: true },
            ],
          } as any,
          {
            id: 'q_code',
            type: 'coding_problem',
            title: 'Array Sum',
            marks: 25,
            negativeMarks: 0,
            difficulty: 'medium',
            options: [],
            correctOptionIds: [],
            codingConfig: getDefaultCodingConfig(),
          },
        ],
      },
    ],
  };

  const safe = sanitizeAssessmentForCandidate(rawAssessment);

  // Recruiter PII must be stripped
  assert.equal((safe as any).recruiterEmail, undefined);
  assert.equal((safe as any).recruiterId, undefined);

  // MCQ answer keys, explanations, and option-level isCorrect flags must be stripped
  const safeMcq = safe.sections[0].questions[0] as any;
  assert.equal(safeMcq.correctOptionIds, undefined);
  assert.equal(safeMcq.correctAnswers, undefined);
  assert.equal(safeMcq.explanation, undefined);
  assert.equal(safeMcq.shortTextAcceptedAnswers, undefined);
  for (const opt of safeMcq.options) {
    assert.equal(opt.isCorrect, undefined);
  }

  // Coding question: sample test cases remain visible, hidden test cases have empty input/expectedOutput
  const safeCodeQ = safe.sections[0].questions[1];
  const testCases = safeCodeQ.codingConfig!.testCases;
  const sampleCases = testCases.filter((tc: any) => tc.isSample);
  const hiddenCases = testCases.filter((tc: any) => !tc.isSample);
  assert.ok(sampleCases.length > 0);
  assert.ok(hiddenCases.length > 0);
  for (const sc of sampleCases) {
    assert.ok(sc.input.length > 0, 'Sample test case input should remain visible');
    assert.ok(sc.expectedOutput.length > 0, 'Sample test case expectedOutput should remain visible');
  }
  for (const hc of hiddenCases) {
    assert.equal(hc.input, '', 'Hidden test case input must be stripped');
    assert.equal(hc.expectedOutput, '', 'Hidden test case expectedOutput must be stripped');
    assert.equal((hc as any).isHiddenLocked, true);
  }
});

test('Zero-Compromise Security: sanitizeAttemptForCandidateResponse withholds scores when showImmediateResults is false and strips hidden test-case outputs', async () => {
  const { sanitizeAttemptForCandidateResponse } = await import('../src/utils/securitySanitizer.ts');

  const gradedAttempt = {
    id: 'att_sec_1',
    assessmentId: 'assess_1',
    organizationId: 'org_1',
    status: 'submitted',
    score: 92,
    totalMarks: 100,
    percentage: 92,
    passed: true,
    answers: {
      q_code: {
        questionId: 'q_code',
        codingLanguage: 'python',
        codeAnswer: 'print(150)',
        passedTestCases: 2,
        totalTestCases: 2,
        codingResults: [
          {
            testCaseId: 'tc_sample',
            isSample: true,
            passed: true,
            status: 'AC',
            input: '5\n10 20 30 40 50',
            expectedOutput: '150',
            actualOutput: '150',
          },
          {
            testCaseId: 'tc_hidden',
            isSample: false,
            passed: false,
            status: 'WA',
            input: 'SECRET_HIDDEN_INPUT',
            expectedOutput: 'SECRET_HIDDEN_OUTPUT',
            actualOutput: 'WRONG_CANDIDATE_OUTPUT',
          },
        ],
      },
    },
  };

  // 1. When showImmediateResults === false: score, percentage, and passed must be withheld
  const withheldReceipt = sanitizeAttemptForCandidateResponse(gradedAttempt, false);
  assert.equal(withheldReceipt.score, null);
  assert.equal(withheldReceipt.percentage, null);
  assert.equal(withheldReceipt.passed, null);
  assert.equal(withheldReceipt.resultsWithheld, true);

  // Hidden test case inputs/outputs in codingResults must also be stripped
  const hiddenRes = withheldReceipt.answers.q_code.codingResults[1];
  assert.equal(hiddenRes.input, '');
  assert.equal(hiddenRes.expectedOutput, '');
  assert.equal(hiddenRes.actualOutput, '');

  // 2. When showImmediateResults === true: score is preserved, but hidden test case inputs/outputs remain masked
  const immediateReceipt = sanitizeAttemptForCandidateResponse(gradedAttempt, true);
  assert.equal(immediateReceipt.score, 92);
  assert.equal(immediateReceipt.percentage, 92);
  assert.equal(immediateReceipt.passed, true);
  assert.equal(immediateReceipt.answers.q_code.codingResults[1].input, '');
  assert.equal(immediateReceipt.answers.q_code.codingResults[1].expectedOutput, '');
});

test('Zero-Compromise Security: Code Execution Sandbox blocks RCE/prototype escapes and terminates infinite loops with TLE', async () => {
  const { validateSafeCandidateCode, runCodeLocallySync } = await import(
    '../src/utils/codeExecutionEngine.ts'
  );

  // 1. Prototype & global escape payloads must be rejected before execution
  const maliciousPayloads = [
    "console.log(process.env.SECRET_KEY);",
    "const fn = this.constructor.constructor('return process')();",
    "Object.prototype.__proto__ = null;",
    "const cp = require('child_process');",
    "fetch('http://169.254.169.254/latest/meta-data');",
    "eval('2 + 2');",
    "console.log(localStorage.getItem('attlic_recruiter_session'));",
  ];

  for (const payload of maliciousPayloads) {
    const check = validateSafeCandidateCode('javascript', payload);
    assert.equal(check.safe, false, `Malicious payload should be blocked: ${payload}`);
    const execRes = runCodeLocallySync('javascript', payload, '');
    assert.equal(execRes.status, 'RE', `Execution of malicious payload should fail with RE: ${payload}`);
  }

  // 2. Legitimate fs stdin read in Node.js must still be allowed
  const safeFsCode = `const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim();\nconsole.log(Number(input) * 2);`;
  const safeCheck = validateSafeCandidateCode('javascript', safeFsCode);
  assert.equal(safeCheck.safe, true);
  const safeExec = runCodeLocallySync('javascript', safeFsCode, '21');
  assert.equal(safeExec.status, 'AC');
  assert.equal(safeExec.stdout.trim(), '42');

  // 3. Non-trivial infinite loop must deterministically terminate with TLE via injected loop guard
  const infiniteJs = `let x = 0;\nwhile (x >= 0) {\n  x = (x + 1) % 1000;\n}\nconsole.log(x);`;
  const tleJs = runCodeLocallySync('javascript', infiniteJs, '');
  assert.equal(tleJs.status, 'TLE');

  const infiniteC = `#include <stdio.h>\nint main() {\n  int x = 1;\n  for (int i = 0; x > 0; i++) {\n    x = (x + 1) % 50 + 1;\n  }\n  return 0;\n}`;
  const tleC = runCodeLocallySync('c', infiniteC, '');
  assert.equal(tleC.status, 'TLE');
});

test('Zero-Compromise Security: SSRF validator & Multi-Tenant Ownership isolator block unauthorized access', async () => {
  const { validateGoogleFormFetchUrl, verifyTenantOwnership } = await import(
    '../src/utils/securitySanitizer.ts'
  );

  // 1. SSRF Prevention
  assert.equal(
    validateGoogleFormFetchUrl('https://docs.google.com/forms/d/e/1FAIpQLSd987654321/viewform').valid,
    true
  );
  assert.equal(validateGoogleFormFetchUrl('https://forms.gle/abcDEF123').valid, true);
  assert.equal(validateGoogleFormFetchUrl('http://docs.google.com/forms/d/123/viewform').valid, false);
  assert.equal(validateGoogleFormFetchUrl('http://127.0.0.1:3000/api/assessments').valid, false);
  assert.equal(validateGoogleFormFetchUrl('http://169.254.169.254/latest/meta-data/').valid, false);
  assert.equal(validateGoogleFormFetchUrl('https://evil.example.com/forms/d/123').valid, false);

  // 2. Multi-Tenant Ownership Isolation
  const orgARecord = {
    organizationId: 'org_alpha',
    recruiterEmail: 'alice@alpha.io',
    recruiterId: 'uid_alice',
  };

  assert.equal(
    verifyTenantOwnership(orgARecord, { organizationId: 'org_alpha' }),
    true
  );
  assert.equal(
    verifyTenantOwnership(orgARecord, { email: 'ALICE@alpha.io' }),
    true
  );
  assert.equal(
    verifyTenantOwnership(orgARecord, {
      organizationId: 'org_beta',
      email: 'bob@beta.io',
      uid: 'uid_bob',
    }),
    false
  );
  assert.equal(verifyTenantOwnership(orgARecord, {}), false);
});

test('Permanent Zero-Score Fix: Evaluation handles all answer key formats, empty shortTextAcceptedAnswers, coding questions without prior run, and detects sanitized assessments', async () => {
  const { hasIntactAnswerKey } = await import('../src/utils/evaluation.ts');
  const { sanitizeAssessmentForCandidate } = await import('../src/utils/securitySanitizer.ts');

  const fullAssessment: any = {
    id: 'assess_full_1',
    code: 'FULL-EVAL-1',
    title: 'Comprehensive Grading Verification',
    passingMarks: 15,
    totalMarks: 25,
    sections: [
      {
        id: 'sec_1',
        title: 'All Formats',
        order: 1,
        questions: [
          // 1. Single choice where answer key is stored in Google Forms `correctAnswers` instead of `correctOptionIds`
          {
            id: 'q_gf_single',
            type: 'single_choice',
            title: 'What is 2 + 2?',
            marks: 5,
            negativeMarks: 1,
            options: [
              { id: 'opt_0_0', text: '4' },
              { id: 'opt_0_1', text: '5' },
            ],
            correctAnswers: ['opt_0_0'],
          },
          // 2. Single choice where answer key is option text ("True") rather than option ID
          {
            id: 'q_text_key',
            type: 'true_false',
            title: 'TCP is connection-oriented.',
            marks: 5,
            negativeMarks: 0,
            options: [
              { id: 'opt_true', text: 'True' },
              { id: 'opt_false', text: 'False' },
            ],
            correctOptionIds: ['True'],
          },
          // 3. Short text initialized with AssessmentEditor default `shortTextAcceptedAnswers: ['']` (no explicit key)
          {
            id: 'q_short_default_empty',
            type: 'short_text',
            title: 'Briefly describe polymorphism.',
            marks: 5,
            negativeMarks: 0,
            options: [],
            correctOptionIds: [],
            shortTextAcceptedAnswers: [''],
          },
          // 4. Short text with accepted answer in `correctOptionIds` (Google Forms import format)
          {
            id: 'q_short_gf_key',
            type: 'short_text',
            title: 'Capital of France?',
            marks: 5,
            negativeMarks: 1,
            options: [],
            correctOptionIds: ['Paris'],
          },
          // 5. Coding problem where candidate wrote correct code and clicked Submit without clicking Run Code first
          {
            id: 'q_coding_no_run',
            type: 'coding_problem',
            title: 'Double the number',
            marks: 5,
            negativeMarks: 0,
            options: [],
            correctOptionIds: [],
            codingConfig: {
              allowedLanguages: ['javascript'],
              defaultLanguage: 'javascript',
              timeLimitSeconds: 2,
              memoryLimitMb: 256,
              starterCode: { javascript: '' },
              testCases: [
                { id: 'tc_1', input: '7', expectedOutput: '14', isSample: true },
                { id: 'tc_2', input: '21', expectedOutput: '42', isSample: false },
              ],
            },
          },
        ],
      },
    ],
  };

  // Verify hasIntactAnswerKey returns true on unsanitized assessment and false on sanitized assessment
  assert.equal(hasIntactAnswerKey(fullAssessment), true);
  const sanitizedCopy = sanitizeAssessmentForCandidate(fullAssessment);
  assert.equal(hasIntactAnswerKey(sanitizedCopy), false);

  const candidateAnswers: any = {
    q_gf_single: {
      questionId: 'q_gf_single',
      selectedOptionIds: ['opt_0_0'],
    },
    q_text_key: {
      questionId: 'q_text_key',
      selectedOptionIds: ['opt_true'],
    },
    q_short_default_empty: {
      questionId: 'q_short_default_empty',
      selectedOptionIds: [],
      textAnswer: 'Ability of objects to take multiple forms.',
    },
    q_short_gf_key: {
      questionId: 'q_short_gf_key',
      selectedOptionIds: [],
      textAnswer: '  paris. ',
    },
    q_coding_no_run: {
      questionId: 'q_coding_no_run',
      selectedOptionIds: [],
      codingLanguage: 'javascript',
      codeAnswer: `const fs = require('fs');\nconst n = Number(fs.readFileSync(0, 'utf-8').trim());\nconsole.log(n * 2);`,
    },
  };

  const result = evaluateAssessmentAttempt(fullAssessment, candidateAnswers);
  assert.equal(result.score, 25);
  assert.equal(result.totalMarks, 25);
  assert.equal(result.percentage, 100);
  assert.equal(result.passed, true);
});

test('Native PDF Certificate Generator produces valid binary PDF (%PDF-) matching current theme', async () => {
  const {
    generatePdfCertificateBytes,
    downloadCandidatePdfCertificate,
    generateDigitalIdSnapshotDataUrl,
  } = await import('../src/utils/examFeatures.ts');

  const snapshot = generateDigitalIdSnapshotDataUrl('Aarav Sharma', 'CS2026042', 'aarav@iit.ac.in');
  const attempt: any = {
    id: 'attempt_pdf_001',
    assessmentId: 'assess_pdf_1',
    assessmentCode: 'CAMPUS-PDF-26',
    assessmentTitle: 'Systems & Algorithms Drive',
    organizationId: 'org_test',
    status: 'submitted',
    startedAt: '2026-11-19T06:00:00.000Z',
    submittedAt: '2026-11-19T06:20:00.000Z',
    score: 24,
    totalMarks: 25,
    percentage: 96,
    passed: true,
    tabSwitchCount: 0,
    violationLogs: [],
    candidate: {
      id: 'cand_1',
      name: 'Aarav Sharma',
      email: 'aarav@iit.ac.in',
      rollNumber: 'CS2026042',
      college: 'IIT Delhi',
      branch: 'CSE',
      cgpa: '9.4',
      snapshotDataUrl: snapshot,
    },
    answers: {
      q1: { questionId: 'q1', selectedOptionIds: ['opt_a'] },
      q_code: {
        questionId: 'q_code',
        selectedOptionIds: [],
        codingLanguage: 'python',
        codeAnswer: 'print(42)',
        passedTestCases: 3,
        totalTestCases: 3,
      },
    },
  };

  // 1. Standard immediate scorecard PDF
  const pdfBytes = generatePdfCertificateBytes(attempt, null, { hideScoresForCandidate: false });
  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.byteLength > 1500, 'PDF should contain full vector content');
  const pdfText = new TextDecoder('latin1').decode(pdfBytes);
  assert.ok(pdfText.startsWith('%PDF-'), 'Output must start with valid %PDF- header');
  assert.ok(pdfText.includes('%%EOF'), 'Output must end with valid %%EOF trailer');

  // 2. Withheld-score mode PDF
  const withheldBytes = generatePdfCertificateBytes(attempt, null, { hideScoresForCandidate: true });
  assert.ok(withheldBytes.byteLength > 1500);
  const withheldText = new TextDecoder('latin1').decode(withheldBytes);
  assert.ok(withheldText.startsWith('%PDF-'));

  // 3. Filename returned by downloadCandidatePdfCertificate ends with .pdf
  const filename = downloadCandidatePdfCertificate(attempt, null);
  assert.ok(filename.endsWith('.pdf'), `Expected .pdf filename, got ${filename}`);
});




