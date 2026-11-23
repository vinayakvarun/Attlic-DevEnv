/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Scalable Core Domain Types
 */

export type RecruiterRole = 'owner' | 'recruiter';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  jobTitle?: string;
  phone?: string;
  companyName?: string;
  industry?: string;
  companyWebsite?: string;
  targetCampuses?: string[];
  isProfileComplete?: boolean;
  organizationId?: string;
  organizationName?: string;
  role?: RecruiterRole;
  createdAt: string;
  updatedAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  ownerEmail: string;
  companyWebsite?: string;
  contactPhone?: string;
  industry?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string; // usually `${organizationId}_${userId}`
  organizationId: string;
  organizationName?: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: RecruiterRole;
  status: 'active' | 'invited';
  invitedBy?: string;
  joinedAt: string;
}

export type AssessmentStatus = 'draft' | 'published' | 'archived';

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'short_text'
  | 'code_snippet'
  | 'coding_problem';

export type CodingLanguage = 'python' | 'c' | 'cpp' | 'java' | 'javascript';

export interface CodingTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isSample: boolean; // true = visible sample case, false = hidden grading case
  explanation?: string;
  weight?: number;
}

export interface CodingProblemConfig {
  allowedLanguages: CodingLanguage[];
  defaultLanguage: CodingLanguage;
  starterCode: Record<CodingLanguage, string>;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  timeLimitSeconds?: number;
  memoryLimitMb?: number;
  testCases: CodingTestCase[];
}

export interface CodingTestCaseResult {
  testCaseId: string;
  isSample: boolean;
  passed: boolean;
  status: 'AC' | 'WA' | 'CE' | 'RE' | 'TLE';
  actualOutput?: string;
  expectedOutput?: string;
  input?: string;
  errorMessage?: string;
  executionTimeMs: number;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  sectionId?: string;
  type: QuestionType;
  title: string;
  codeSnippet?: string;
  codeLanguage?: string;
  codingConfig?: CodingProblemConfig;
  options: QuestionOption[];
  correctOptionIds: string[];
  shortTextAcceptedAnswers?: string[];
  partialMarking?: boolean;
  zeroMarksForUnanswered?: boolean;
  explanation?: string;
  marks: number;
  negativeMarks: number;
  difficulty: 'easy' | 'medium' | 'hard';
  isRequired?: boolean;
  requiresAnswerKeyReview?: boolean;
  unsupportedTypeWarning?: string | null;
}

export interface StandardizedQuestion {
  id: string;
  sourceItemId?: string;
  type: QuestionType;
  title: string;
  description?: string;
  options: QuestionOption[];
  correctAnswers: string[];
  marks: number;
  negativeMarks: number;
  isRequired: boolean;
  requiresAnswerKeyReview: boolean;
  unsupportedTypeWarning?: string | null;
}

export interface StandardizedSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  questions: StandardizedQuestion[];
}

export interface StandardizedFormImport {
  schemaVersion: '1.0';
  source: {
    type: 'google_forms' | 'manual_json';
    formId: string;
    originalUrl?: string;
    importedAt: string;
    importedBy?: string;
  };
  assessment: {
    title: string;
    description: string;
    showImmediateResults?: boolean;
    sections: StandardizedSection[];
  };
  summary: {
    totalSections: number;
    totalQuestions: number;
    supportedQuestions: number;
    unsupportedQuestions: number;
    requiresAnswerKeyReview: number;
    warnings: string[];
    errors?: string[];
  };
}

export interface AssessmentSection {
  id: string;
  title: string;
  description?: string;
  durationMinutes?: number;
  isCodingSection?: boolean;
  order: number;
  questions: Question[];
}

export interface AntiCheatingConfig {
  trackTabSwitches: boolean;
  maxTabSwitches: number;
  enableTwoMinuteViolationBlock?: boolean; // 2-minute block if violations reach/exceed threshold
  enforceFullscreen: boolean;
  forceFullscreen: boolean; // strict F11 / chrome fullscreen enforcement
  blockCopyPaste: boolean;
  webcamMonitoringNotice: boolean;
}

export interface CandidateCustomField {
  id: string;
  label: string;
  placeholder?: string;
  required: boolean;
  type: 'text' | 'number';
}

export interface CandidateDetailsConfig {
  collectFullName: boolean; // mandatory true
  collectEmail: boolean; // mandatory true
  collectRollNumber: boolean;
  collectCollege: boolean;
  collectBranch: boolean;
  collectGraduationYear: boolean;
  collectPhone: boolean;
  collectCgpa: boolean;
  customFields: CandidateCustomField[];
}

export type PredefinedTheme =
  | 'default_white_mono'
  | 'default_black_mono'
  | 'default_dark_grey'
  | 'default_light_grey'
  | 'kiwi'
  | 'coconut'
  | 'banana'
  | 'litchi'
  | 'orange'
  | 'plum'
  | 'peanut'
  | 'blueberry'
  | 'dragonfruit'
  | 'pomegranate'
  | 'mango'
  | 'papaya'
  | 'guava'
  | 'passionfruit'
  | 'watermelon'
  | 'avocado'
  | 'fig'
  | 'cherry'
  | 'blackberry'
  | 'raspberry'
  | 'cranberry'
  | 'mulberry'
  | 'starfruit'
  | 'persimmon'
  | 'apricot'
  | 'peach'
  | 'nectarine'
  | 'grapefruit'
  | 'lime'
  | 'lemon'
  | 'tangerine'
  | 'yuzu'
  | 'kumquat'
  | 'jackfruit'
  | 'durian'
  | 'rambutan'
  | 'mangosteen'
  | 'acai'
  | 'elderberry'
  | 'gooseberry'
  | 'light'
  | 'dark'
  | 'minimal'
  | 'professional'
  | 'high_contrast';

export interface AppearanceColors {
  primary: string;           // Primary accent (buttons, active states)
  secondary: string;         // Secondary surfaces / panels
  accent: string;            // Highlights / badges / status
  background: string;        // Main page background
  cardBackground: string;    // Question card / container background
  textMain: string;          // Main headings & question text
  textSecondary: string;     // Labels, hints, instructions
  buttonPrimary: string;     // Action buttons
  timerColor: string;        // Countdown timer badge / text
  progressIndicator: string; // Progress bar fill / completion color
}

export type FontFamily = 'sans' | 'serif' | 'mono' | 'roboto' | 'poppins';
export type FontSizeScale = 'sm' | 'md' | 'lg' | 'xl';
export type LineSpacingScale = 'tight' | 'normal' | 'relaxed';

export interface AppearanceTypography {
  fontFamily: FontFamily;
  headingSize: FontSizeScale;
  questionSize: FontSizeScale;
  optionSize: FontSizeScale;
  generalTextSize: FontSizeScale;
  lineSpacing: LineSpacingScale;
}

export interface AppearanceLayout {
  headerLayout: 'standard' | 'compact' | 'centered' | 'minimal';
  questionCardDesign: 'bordered' | 'elevated' | 'flat' | 'glass';
  sidebarVisibility: 'visible' | 'collapsed' | 'hidden';
  questionNavigationPanel: 'palette' | 'list' | 'compact_bar';
  progressBar: 'bar' | 'percentage_pill' | 'step_dots' | 'none';
  sectionNavigation: 'tabs' | 'dropdown' | 'breadcrumbs';
  buttonAppearance: 'rounded-md' | 'rounded-full' | 'rounded-none' | 'pill';
  questionNumberVisibility: boolean;
  marksVisibility: boolean;
}

export interface AppearanceBranding {
  companyLogoUrl?: string;
  companyDisplayName?: string;
  showCompanyLogo: boolean;
  welcomeMessage?: string;
  showWelcomeScreen: boolean;
  showTitleDisplay: boolean;
  customSubtitle?: string;
  footerBrandingText?: string;
  footerSupportEmail?: string;
}

export interface AppearanceCandidateExperience {
  showQuestionNumbers: boolean;
  showTotalQuestionCount: boolean;
  showQuestionMarks: boolean;
  showProgressPercentage: boolean;
  showAnswerStatus: boolean;
  showTimer: boolean;
  showSectionProgress: boolean;
}

export interface AssessmentAppearance {
  theme: PredefinedTheme;
  colors: AppearanceColors;
  typography: AppearanceTypography;
  layout: AppearanceLayout;
  branding: AppearanceBranding;
  candidateExperience: AppearanceCandidateExperience;
  customCss?: string;
}

export interface Assessment {
  id: string;
  organizationId: string;
  recruiterId: string;
  recruiterEmail: string;
  organizationName: string;
  companyName?: string;
  category?: string;
  code: string; // Unique alphanumeric test key like "CAMPUS-2026-CS"
  title: string;
  description: string;
  status: AssessmentStatus;
  version: number;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  passingPercentage?: number;
  defaultMarks?: number;
  defaultNegativeMarks?: number;
  showImmediateResults?: boolean;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  allowedEmailDomains?: string[];
  requireCandidateSnapshot?: boolean;
  creationSource?: 'scratch' | 'google_forms' | 'wizard';
  enableCodingEnvironment?: boolean;
  candidateDetailsConfig?: CandidateDetailsConfig;
  sections: AssessmentSection[];
  antiCheating: AntiCheatingConfig;
  instructions: string[];
  tags: string[];
  targetCampuses?: string[];
  appearance?: AssessmentAppearance;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  rollNumber: string;
  college?: string;
  branch?: string;
  graduationYear?: number;
  phone?: string;
  cgpa?: string;
  snapshotDataUrl?: string;
  customDetails?: Record<string, string>;
}

export interface CandidateAnswer {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer?: string;
  codingLanguage?: CodingLanguage;
  codeByLanguage?: Partial<Record<CodingLanguage, string>>;
  codeAnswer?: string;
  passedTestCases?: number;
  totalTestCases?: number;
  codingResults?: CodingTestCaseResult[];
  isMarkedForReview: boolean;
  visited: boolean;
  timeSpentSeconds: number;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'disqualified' | 'evaluated';

export interface ViolationLog {
  timestamp: string;
  type: 'tab_switch' | 'fullscreen_exit' | 'copy_paste_attempt' | 'window_blur';
  message: string;
}

export type CandidatePipelineStatus = 'pending' | 'shortlisted' | 'waitlisted' | 'rejected';

export interface CandidateAttempt {
  id: string;
  organizationId: string;
  assessmentId: string;
  assessmentCode: string;
  assessmentTitle: string;
  candidate: Candidate;
  status: AttemptStatus;
  pipelineStatus?: CandidatePipelineStatus;
  startedAt: string;
  submittedAt?: string;
  currentSectionId: string;
  answers: Record<string, CandidateAnswer>;
  tabSwitchCount: number;
  violationLogs: ViolationLog[];
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  sectionScores?: Record<string, { score: number; total: number }>;
}

export interface LiveMonitoringSession {
  attemptId: string;
  organizationId: string;
  candidateName: string;
  candidateEmail: string;
  college: string;
  assessmentTitle: string;
  assessmentCode: string;
  startedAt: string;
  timeRemainingSeconds: number;
  answeredCount: number;
  totalQuestions: number;
  tabSwitchCount: number;
  status: 'active' | 'warning' | 'submitted' | 'disconnected';
  lastPing: string;
}

export type NavigationPage =
  | 'landing'
  | 'recruiter_login'
  | 'recruiter_register'
  | 'forgot_password'
  | 'candidate_portal'
  | 'candidate_test'
  | 'about'
  | 'privacy'
  | 'terms'
  | 'recruiter_dashboard';

export type DashboardTab =
  | 'overview'
  | 'assessments'
  | 'create'
  | 'editor'
  | 'import'
  | 'candidates'
  | 'analytics'
  | 'organization'
  | 'settings';
