/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Candidate Examination Environment & Proctoring Test Hall
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Assessment,
  Candidate,
  CandidateAttempt,
  CandidateAnswer,
  Question,
  CodingLanguage,
} from '../../types';
import { useAssessments } from '../../context/AssessmentContext';
import { BrandLogo, renderWithAttlicBrand } from '../common/BrandLogo';
import {
  SUPPORTED_CODING_LANGUAGES,
  getDefaultCodingConfig,
  getDefaultStarterCode,
  executeCodeAgainstInput,
  evaluateCodingQuestion,
  evaluateCodingQuestionSync,
} from '../../utils/codeExecutionEngine';
import {
  getDefaultAppearance,
  getScopedStudentThemeStyle,
  FONT_FAMILY_CLASSES,
  FONT_SIZE_CLASSES,
  LINE_SPACING_CLASSES,
  BUTTON_RADIUS_CLASSES,
} from '../../utils/appearanceDefaults';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Send,
  ShieldAlert,
  FileCheck2,
  Maximize2,
  HelpCircle,
  X,
  Sparkles,
  Building2,
  RotateCcw,
  Code2,
  Terminal,
  Play,
  Lock,
} from 'lucide-react';
import { WaitingAnimation } from '../common/WaitingAnimation';
import { applyCandidateRandomization } from '../../utils/examFeatures';
import { MonacoCodeEditor } from '../common/MonacoCodeEditor';

interface CandidateTestRunnerProps {
  assessment: Assessment;
  candidate: Candidate;
  onFinish: (attempt: CandidateAttempt) => void;
  onExit: () => void;
}

export const CandidateTestRunner: React.FC<CandidateTestRunnerProps> = ({
  assessment: rawAssessment,
  candidate,
  onFinish,
  onExit,
}) => {
  const { submitCandidateAttempt } = useAssessments();

  // Deterministic per-candidate question & option randomization (when enabled by recruiter in General tab)
  const assessment = useMemo(
    () =>
      applyCandidateRandomization(
        rawAssessment,
        `${candidate.email || candidate.id || candidate.name}`
      ),
    [rawAssessment, candidate.email, candidate.id, candidate.name]
  );

  // Appearance configuration (scoped strictly to the student test-taking screen)
  const appearance = useMemo(() => {
    return assessment.appearance || getDefaultAppearance(assessment.companyName || assessment.organizationName);
  }, [assessment.appearance, assessment.companyName, assessment.organizationName]);

  const scopedThemeStyle = useMemo(
    () => getScopedStudentThemeStyle(appearance.colors) as React.CSSProperties,
    [appearance.colors]
  );

  const buttonRadiusClass = BUTTON_RADIUS_CLASSES[appearance.layout.buttonAppearance] || 'rounded-lg';
  const fontFamilyClass = FONT_FAMILY_CLASSES[appearance.typography.fontFamily] || 'font-sans';
  const headingSizeClass = FONT_SIZE_CLASSES.heading[appearance.typography.headingSize] || 'text-xl font-bold';
  const questionSizeClass = FONT_SIZE_CLASSES.question[appearance.typography.questionSize] || 'text-base font-semibold';
  const optionSizeClass = FONT_SIZE_CLASSES.option[appearance.typography.optionSize] || 'text-xs';
  const lineSpacingClass = LINE_SPACING_CLASSES[appearance.typography.lineSpacing] || 'leading-relaxed';

  const cardDesignClass = useMemo(() => {
    switch (appearance.layout.questionCardDesign) {
      case 'elevated':
        return 'shadow-xl shadow-black/40 border border-white/10';
      case 'flat':
        return 'border-0';
      case 'glass':
        return 'backdrop-blur-md bg-opacity-80 border border-white/15';
      case 'bordered':
      default:
        return 'border border-slate-800';
    }
  }, [appearance.layout.questionCardDesign]);

  // Test setup
  const totalQuestions = assessment.sections.reduce((acc, s) => acc + s.questions.length, 0);
  const allQuestionsFlat = assessment.sections.flatMap((s) => s.questions);

  const [hasStarted, setHasStarted] = useState(false);
  const [pledgeChecked, setPledgeChecked] = useState(false);

  // Active state
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, CandidateAnswer>>({});
  const answersRef = useRef<Record<string, CandidateAnswer>>({});
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Timer & Wall-clock deadline
  const totalSecondsAllocated = assessment.durationMinutes * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSecondsAllocated);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);

  // Autosave & Network connectivity status
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string>('All responses saved');

  const sessionKey = useMemo(() => {
    const safeEmail = (candidate.email || 'guest').toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `attlic_exam_session_${assessment.id}_${safeEmail}`;
  }, [assessment.id, candidate.email]);

  // Proctoring & End-of-Exam modals
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationLockoutSeconds, setViolationLockoutSeconds] = useState<number>(0);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [showEndOfExamModal, setShowEndOfExamModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // In-Built Coding IDE Execution State
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [customStdin, setCustomStdin] = useState('5\n10 20 30 40 50');
  const [customRunOutput, setCustomRunOutput] = useState<{
    status: string;
    stdout: string;
    stderr: string;
    executionTimeMs: number;
  } | null>(null);

  // Strict Fullscreen Mode enforcement
  const isFullscreenConfigured =
    assessment.antiCheating?.forceFullscreen ??
    assessment.antiCheating?.enforceFullscreen ??
    true;
  const [isFullscreenLocked, setIsFullscreenLocked] = useState(false);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);

  const requestBrowserFullscreen = async () => {
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
    } catch {
      // Fullscreen entry restricted by browser context
    }
  };

  const checkIsFullscreen = () => {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  };

  const currentSection = assessment.sections[currentSectionIndex] || assessment.sections[0];
  const currentQuestion: Question | undefined = currentSection?.questions[currentQuestionIndex];

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Restore examination session on page refresh or accidental reload
  useEffect(() => {
    try {
      const savedStr = localStorage.getItem(sessionKey);
      if (savedStr) {
        const saved = JSON.parse(savedStr);
        if (saved && saved.deadlineMs) {
          const now = Date.now();
          const leftSec = Math.floor((saved.deadlineMs - now) / 1000);
          if (leftSec > 0) {
            setHasStarted(true);
            setPledgeChecked(true);
            setDeadlineMs(saved.deadlineMs);
            setSecondsRemaining(leftSec);
            if (saved.answers) setAnswers(saved.answers);
            if (typeof saved.currentSectionIndex === 'number') setCurrentSectionIndex(saved.currentSectionIndex);
            if (typeof saved.currentQuestionIndex === 'number') setCurrentQuestionIndex(saved.currentQuestionIndex);
            if (typeof saved.tabSwitchCount === 'number') setTabSwitchCount(saved.tabSwitchCount);
            if (typeof saved.violationLockoutUntilMs === 'number' && saved.violationLockoutUntilMs > now) {
              const lockLeft = Math.ceil((saved.violationLockoutUntilMs - now) / 1000);
              setViolationLockoutSeconds(lockLeft);
              setShowViolationModal(true);
            }
          } else {
            // Expired while away
            setSecondsRemaining(0);
          }
        }
      }
    } catch {
      // Ignore malformed session cache
    }
  }, [sessionKey]);

  // Autosave answers & session state to localStorage
  useEffect(() => {
    if (!hasStarted) return;
    try {
      const activeDeadline = deadlineMs || (Date.now() + secondsRemaining * 1000);
      const violationLockoutUntilMs =
        violationLockoutSeconds > 0 ? Date.now() + violationLockoutSeconds * 1000 : undefined;
      const payload = {
        assessmentId: assessment.id,
        candidateEmail: candidate.email,
        deadlineMs: activeDeadline,
        answers,
        currentSectionIndex,
        currentQuestionIndex,
        tabSwitchCount,
        violationLockoutUntilMs,
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem(sessionKey, JSON.stringify(payload));
      setLastAutosavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      // quota exception fallback
    }
  }, [
    hasStarted,
    answers,
    currentSectionIndex,
    currentQuestionIndex,
    tabSwitchCount,
    violationLockoutSeconds,
    deadlineMs,
    sessionKey,
  ]);

  // 2-Minute (120s) Blocked Timer Countdown when violation limit is reached/exceeded
  useEffect(() => {
    if (violationLockoutSeconds <= 0) return;
    const lockTimer = setInterval(() => {
      setViolationLockoutSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(lockTimer);
  }, [violationLockoutSeconds]);

  // Proctoring Focus Loss Listener
  useEffect(() => {
    if (!hasStarted || assessment.antiCheating?.trackTabSwitches === false) return;
    const maxAllowed = assessment.antiCheating?.maxTabSwitches || 3;
    const twoMinBlockEnabled = assessment.antiCheating?.enableTwoMinuteViolationBlock !== false;

    const triggerViolation = () => {
      setTabSwitchCount((prev) => {
        const nextCount = prev + 1;
        if (twoMinBlockEnabled && nextCount >= maxAllowed) {
          setViolationLockoutSeconds(120); // 2-minute blocked penalty timer
        }
        setShowViolationModal(true);
        return nextCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation();
      }
    };

    const handleWindowBlur = () => {
      if (!showViolationModal && !showSubmitConfirmModal && !showEndOfExamModal && !isFullscreenLocked) {
        triggerViolation();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [
    hasStarted,
    showViolationModal,
    showSubmitConfirmModal,
    showEndOfExamModal,
    isFullscreenLocked,
    assessment.antiCheating?.trackTabSwitches,
    assessment.antiCheating?.maxTabSwitches,
    assessment.antiCheating?.enableTwoMinuteViolationBlock,
  ]);

  // Strict Fullscreen Change Listener
  useEffect(() => {
    if (!hasStarted || !isFullscreenConfigured) return;

    const handleFullscreenChange = () => {
      const inFs = checkIsFullscreen();
      if (!inFs) {
        setIsFullscreenLocked(true);
        setFullscreenExitCount((c) => c + 1);
      } else {
        setIsFullscreenLocked(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, [hasStarted, isFullscreenConfigured]);

  // Wall-Clock Accurate Countdown Timer
  useEffect(() => {
    if (!hasStarted) return;

    const timer = setInterval(() => {
      if (deadlineMs) {
        const remaining = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          clearInterval(timer);
          handleFinalSubmit();
        }
      } else {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleFinalSubmit();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, deadlineMs]);

  // Mark current question as visited
  useEffect(() => {
    if (!hasStarted || !currentQuestion) return;
    setAnswers((prev) => {
      const existing = prev[currentQuestion.id];
      if (!existing) {
        return {
          ...prev,
          [currentQuestion.id]: {
            questionId: currentQuestion.id,
            selectedOptionIds: [],
            isMarkedForReview: false,
            visited: true,
            timeSpentSeconds: 0,
          },
        };
      }
      return {
        ...prev,
        [currentQuestion.id]: { ...existing, visited: true },
      };
    });
  }, [hasStarted, currentSectionIndex, currentQuestionIndex]);

  const handleSelectOption = (questionId: string, optionId: string, isMulti: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId] || {
        questionId,
        selectedOptionIds: [],
        isMarkedForReview: false,
        visited: true,
        timeSpentSeconds: 0,
      };

      let nextOptionIds: string[];
      if (isMulti) {
        nextOptionIds = current.selectedOptionIds.includes(optionId)
          ? current.selectedOptionIds.filter((id) => id !== optionId)
          : [...current.selectedOptionIds, optionId];
      } else {
        nextOptionIds = [optionId];
      }

      const next = {
        ...prev,
        [questionId]: {
          ...current,
          selectedOptionIds: nextOptionIds,
        },
      };
      answersRef.current = next;
      return next;
    });
  };

  const handleTextAnswerChange = (questionId: string, text: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] || {
        questionId,
        selectedOptionIds: [],
        isMarkedForReview: false,
        visited: true,
        timeSpentSeconds: 0,
      };
      const next = {
        ...prev,
        [questionId]: {
          ...current,
          textAnswer: text,
        },
      };
      answersRef.current = next;
      return next;
    });
  };

  const handleToggleMarkForReview = (questionId: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] || {
        questionId,
        selectedOptionIds: [],
        isMarkedForReview: false,
        visited: true,
        timeSpentSeconds: 0,
      };
      return {
        ...prev,
        [questionId]: {
          ...current,
          isMarkedForReview: !current.isMarkedForReview,
        },
      };
    });
  };

  const handleClearResponse = (questionId: string) => {
    const targetQ = allQuestionsFlat.find((item) => item.id === questionId);
    setAnswers((prev) => {
      const current = prev[questionId];
      if (!current) return prev;
      if (targetQ?.type === 'coding_problem') {
        const cfg = targetQ.codingConfig || getDefaultCodingConfig();
        const activeLang = current.codingLanguage || cfg.defaultLanguage || 'python';
        const starter =
          cfg.starterCode?.[activeLang]?.trim()
            ? cfg.starterCode[activeLang]
            : getDefaultStarterCode(activeLang);
        const next = {
          ...prev,
          [questionId]: {
            ...current,
            codeAnswer: starter,
            codeByLanguage: {
              ...(current.codeByLanguage || {}),
              [activeLang]: starter,
            },
            passedTestCases: undefined,
            totalTestCases: undefined,
            codingResults: undefined,
          },
        };
        answersRef.current = next;
        return next;
      }
      const next = {
        ...prev,
        [questionId]: {
          ...current,
          selectedOptionIds: [],
          textAnswer: '',
          codeAnswer: '',
          passedTestCases: undefined,
          totalTestCases: undefined,
          codingResults: undefined,
        },
      };
      answersRef.current = next;
      return next;
    });
  };

  // Coding Problem Helpers
  const getCodingStateForQuestion = (q: Question) => {
    const cfg = q.codingConfig || getDefaultCodingConfig();
    const ans = answers[q.id];
    const activeLang: CodingLanguage =
      ans?.codingLanguage && cfg.allowedLanguages.includes(ans.codingLanguage)
        ? ans.codingLanguage
        : cfg.defaultLanguage || cfg.allowedLanguages[0] || 'python';
    const defaultStarter =
      cfg.starterCode?.[activeLang]?.trim()
        ? cfg.starterCode[activeLang]
        : getDefaultStarterCode(activeLang);
    const savedForLang = ans?.codeByLanguage?.[activeLang];
    const currentCode =
      savedForLang !== undefined && savedForLang.trim().length > 0
        ? savedForLang
        : ans?.codeAnswer && ans?.codingLanguage === activeLang && ans.codeAnswer.trim().length > 0
        ? ans.codeAnswer
        : defaultStarter;

    return {
      cfg,
      activeLang,
      currentCode,
      results: ans?.codingResults,
      passedTestCases: ans?.passedTestCases,
      totalTestCases: ans?.totalTestCases ?? cfg.testCases.length,
    };
  };

  const handleCodingLanguageSelect = (q: Question, nextLang: CodingLanguage) => {
    const cfg = q.codingConfig || getDefaultCodingConfig();
    const defaultStarter =
      cfg.starterCode?.[nextLang]?.trim()
        ? cfg.starterCode[nextLang]
        : getDefaultStarterCode(nextLang);

    setAnswers((prev) => {
      const current = prev[q.id] || {
        questionId: q.id,
        selectedOptionIds: [],
        isMarkedForReview: false,
        visited: true,
        timeSpentSeconds: 0,
      };
      const existingLangCode = current.codeByLanguage?.[nextLang];
      const nextCode =
        existingLangCode !== undefined && existingLangCode.trim().length > 0
          ? existingLangCode
          : defaultStarter;
      const next = {
        ...prev,
        [q.id]: {
          ...current,
          codingLanguage: nextLang,
          codeAnswer: nextCode,
          codeByLanguage: {
            ...(current.codeByLanguage || {}),
            [nextLang]: nextCode,
          },
        },
      };
      answersRef.current = next;
      return next;
    });
    setCustomRunOutput(null);
  };

  const handleCodingSourceChange = (q: Question, nextCode: string) => {
    const { activeLang } = getCodingStateForQuestion(q);
    setAnswers((prev) => {
      const current = prev[q.id] || {
        questionId: q.id,
        selectedOptionIds: [],
        isMarkedForReview: false,
        visited: true,
        timeSpentSeconds: 0,
      };
      const next = {
        ...prev,
        [q.id]: {
          ...current,
          codingLanguage: activeLang,
          codeAnswer: nextCode,
          codeByLanguage: {
            ...(current.codeByLanguage || {}),
            [activeLang]: nextCode,
          },
        },
      };
      answersRef.current = next;
      return next;
    });
  };

  const handleResetCodingStarter = (q: Question) => {
    const { cfg, activeLang } = getCodingStateForQuestion(q);
    const starter = cfg.starterCode?.[activeLang] ?? getDefaultStarterCode(activeLang);
    handleCodingSourceChange(q, starter);
    setCustomRunOutput(null);
  };

  const handleRunCodingTests = async (q: Question, runCustom: boolean) => {
    const { cfg, activeLang, currentCode } = getCodingStateForQuestion(q);
    setIsRunningCode(true);
    try {
      if (runCustom) {
        const res = await executeCodeAgainstInput(
          activeLang,
          currentCode,
          customStdin,
          (cfg.timeLimitSeconds || 2) * 1000
        );
        setCustomRunOutput(res);
      } else {
        setCustomRunOutput(null);
        const evalRes = await evaluateCodingQuestion(q, activeLang, currentCode, false, assessment.code);
        setAnswers((prev) => {
          const current = prev[q.id] || {
            questionId: q.id,
            selectedOptionIds: [],
            isMarkedForReview: false,
            visited: true,
            timeSpentSeconds: 0,
          };
          const next = {
            ...prev,
            [q.id]: {
              ...current,
              codingLanguage: activeLang,
              codeAnswer: currentCode,
              codeByLanguage: {
                ...(current.codeByLanguage || {}),
                [activeLang]: currentCode,
              },
              passedTestCases: evalRes.passedTestCases,
              totalTestCases: evalRes.totalTestCases,
              codingResults: evalRes.results,
            },
          };
          answersRef.current = next;
          return next;
        });
      }
    } finally {
      setIsRunningCode(false);
    }
  };

  const isLastQuestionOfExam =
    currentSectionIndex === assessment.sections.length - 1 &&
    currentQuestionIndex === (currentSection?.questions.length || 1) - 1;

  const handleNextQuestion = () => {
    if (currentQuestionIndex < currentSection.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentSectionIndex < assessment.sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setCurrentQuestionIndex(0);
    } else {
      // Candidate reached the final question and clicked Next -> prompt to review all questions or submit test
      setShowEndOfExamModal(true);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      setCurrentQuestionIndex(assessment.sections[currentSectionIndex - 1].questions.length - 1);
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    const vLogs: any[] = [];
    if (tabSwitchCount > 0) {
      vLogs.push({
        timestamp: new Date().toISOString(),
        type: 'tab_switch',
        message: `${tabSwitchCount} tab switch / focus loss warning events recorded during exam.`,
      });
    }
    if (fullscreenExitCount > 0) {
      vLogs.push({
        timestamp: new Date().toISOString(),
        type: 'fullscreen_exit',
        message: `${fullscreenExitCount} fullscreen exit incidents recorded during exam.`,
      });
    }

    // Ensure all coding_problem answers have up-to-date test case evaluations before final submit
    const finalizedAnswers: Record<string, CandidateAnswer> = {
      ...answers,
      ...answersRef.current,
    };
    assessment.sections.forEach((sec) => {
      sec.questions.forEach((q) => {
        if (q.type === 'coding_problem') {
          const existingAns = finalizedAnswers[q.id];
          if (existingAns && existingAns.codeAnswer && existingAns.codeAnswer.trim()) {
            const lang =
              existingAns.codingLanguage ||
              q.codingConfig?.defaultLanguage ||
              'python';
            const syncRes = evaluateCodingQuestionSync(q, lang, existingAns.codeAnswer);
            finalizedAnswers[q.id] = {
              ...existingAns,
              codingLanguage: lang,
              passedTestCases: syncRes.passedTestCases,
              totalTestCases: syncRes.totalTestCases,
              codingResults: syncRes.results,
            };
          }
        }
      });
    });

    const newAttempt: CandidateAttempt = {
      id: `attempt-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      assessmentId: assessment.id,
      assessmentCode: assessment.code,
      assessmentTitle: assessment.title,
      organizationId: assessment.organizationId || '',
      candidate,
      status: 'submitted',
      startedAt: new Date(Date.now() - (totalSecondsAllocated - secondsRemaining) * 1000).toISOString(),
      currentSectionId: currentSection.id,
      answers: finalizedAnswers,
      tabSwitchCount,
      violationLogs: vLogs,
      score: 0,
      totalMarks: assessment.totalMarks,
      percentage: 0,
      passed: false,
    };

    try {
      localStorage.removeItem(sessionKey);
    } catch {}

    const evaluated = await submitCandidateAttempt(newAttempt);
    setIsSubmitting(false);
    onFinish(evaluated);
  };

  // Stats for review palette
  const answeredCount = Object.values(answers).filter(
    (a) =>
      a.selectedOptionIds.length > 0 ||
      (a.textAnswer && a.textAnswer.trim().length > 0) ||
      (a.codeAnswer && a.codeAnswer.trim().length > 0)
  ).length;

  const markedReviewCount = Object.values(answers).filter((a) => a.isMarkedForReview).length;
  const unansweredCount = totalQuestions - answeredCount;

  const minutesLeft = Math.floor(secondsRemaining / 60);
  const secondsLeft = secondsRemaining % 60;
  const isUrgent = minutesLeft < 5;

  // Pre-test Instructions & System Check Screen
  if (!hasStarted) {
    return (
      <div
        className={`min-h-screen flex flex-col justify-between p-4 sm:p-8 ${fontFamilyClass}`}
        data-student-theme={appearance.theme}
        style={scopedThemeStyle}
      >
        <header
          className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b"
          style={{ borderColor: appearance.colors.secondary }}
        >
          {appearance.branding.showCompanyLogo && appearance.branding.companyLogoUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={appearance.branding.companyLogoUrl}
                alt="Logo"
                className="h-9 max-w-[180px] object-contain rounded"
              />
              <span
                className="text-xs font-semibold"
                style={{ color: appearance.colors.textSecondary }}
              >
                {appearance.branding.companyDisplayName || assessment.organizationName}
              </span>
            </div>
          ) : (
            <BrandLogo size="md" showTagline={true} primaryColor={appearance.colors.primary} />
          )}
          <div className="text-right">
            <span
              className="text-[10px] uppercase tracking-wider block font-medium"
              style={{ color: appearance.colors.textSecondary }}
            >
              Candidate Roll No
            </span>
            <span
              className="text-xs font-mono font-bold"
              style={{ color: appearance.colors.primary }}
            >
              {candidate.rollNumber}
            </span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto w-full my-8 space-y-6">
          <div
            className={`rounded-2xl p-6 sm:p-8 space-y-6 ${cardDesignClass}`}
            style={{
              backgroundColor: appearance.colors.cardBackground,
              color: appearance.colors.textMain,
            }}
          >
            <div className="space-y-2">
              <span
                className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border"
                style={{
                  backgroundColor: `${appearance.colors.primary}20`,
                  color: appearance.colors.primary,
                  borderColor: `${appearance.colors.primary}40`,
                }}
              >
                Examination Hall Entry
              </span>
              <h1 className={`text-2xl sm:text-3xl font-extrabold ${headingSizeClass}`}>
                {assessment.title}
              </h1>
              <p className="text-xs" style={{ color: appearance.colors.textSecondary }}>
                Administered by {appearance.branding.companyDisplayName || assessment.organizationName} • Code:{' '}
                <span className="font-mono font-bold" style={{ color: appearance.colors.primary }}>
                  {assessment.code}
                </span>
              </p>
              {appearance.branding.welcomeMessage && (
                <div
                  className="p-3 rounded-lg border text-xs leading-relaxed mt-2"
                  style={{
                    backgroundColor: `${appearance.colors.primary}10`,
                    borderColor: `${appearance.colors.primary}30`,
                    color: appearance.colors.textMain,
                  }}
                >
                  <p className="font-medium">{appearance.branding.welcomeMessage}</p>
                </div>
              )}
            </div>

            {/* Candidate Identity Card */}
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border text-xs"
              style={{
                backgroundColor: appearance.colors.secondary,
                borderColor: `${appearance.colors.primary}20`,
              }}
            >
              <div>
                <span className="block text-[10px] uppercase font-medium" style={{ color: appearance.colors.textSecondary }}>Candidate Name</span>
                <span className="font-semibold">{candidate.name}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-medium" style={{ color: appearance.colors.textSecondary }}>College / University</span>
                <span className="font-semibold">{candidate.college}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-medium" style={{ color: appearance.colors.textSecondary }}>Duration</span>
                <span className="font-semibold font-mono" style={{ color: appearance.colors.timerColor }}>
                  {assessment.durationMinutes} Minutes
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-medium" style={{ color: appearance.colors.textSecondary }}>Total Marks</span>
                <span className="font-semibold font-mono" style={{ color: appearance.colors.accent }}>{assessment.totalMarks} Marks</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: appearance.colors.textMain }}>
                Mandatory Examination Instructions
              </h3>
              <ul className="space-y-2 text-xs" style={{ color: appearance.colors.textSecondary }}>
                {(Array.isArray(assessment.instructions) && assessment.instructions.length > 0
                  ? assessment.instructions
                  : typeof (assessment as any).instructions === 'string' && (assessment as any).instructions.trim()
                  ? [(assessment as any).instructions]
                  : [
                      'Ensure you have a stable internet connection before beginning.',
                      'Fullscreen mode (F11) is enforced. Exiting fullscreen will lock the exam viewport.',
                      'Browser tab-switching and window focus losses are monitored.',
                      'All candidate responses are continuously autosaved locally and synced.',
                    ]
                ).map((inst, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-bold" style={{ color: appearance.colors.primary }}>•</span>
                    <span>{inst}</span>
                  </li>
                ))}
                {isFullscreenConfigured && (
                  <li className="flex items-start gap-2 font-semibold" style={{ color: appearance.colors.primary }}>
                    <span className="font-bold">•</span>
                    <span>
                      Strict Fullscreen Enforcement: The exam must be taken in Fullscreen Mode (F11). Exiting fullscreen will immediately lock your exam viewport.
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2 text-amber-400 font-medium">
                  <span className="font-bold">•</span>
                  <span>
                    Do not switch browser tabs or minimize the examination window. The system tracks all focus-loss events.
                  </span>
                </li>
                {assessment.antiCheating?.enableTwoMinuteViolationBlock !== false && (
                  <li className="flex items-start gap-2 text-rose-400 font-medium">
                    <span className="font-bold">•</span>
                    <span>
                      2-Minute Violation Lockout: Reaching or exceeding the threshold of{' '}
                      {assessment.antiCheating?.maxTabSwitches || 3} tab-switch violations will block your examination screen for 2 minutes (120 seconds).
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {/* Honor Code Pledge */}
            <label
              className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer text-xs"
              style={{
                backgroundColor: appearance.colors.secondary,
                borderColor: `${appearance.colors.primary}40`,
              }}
            >
              <input
                type="checkbox"
                checked={pledgeChecked}
                onChange={(e) => setPledgeChecked(e.target.checked)}
                className="mt-0.5 accent-indigo-500 w-4 h-4 rounded"
                style={{ accentColor: appearance.colors.primary }}
              />
              <span className="leading-relaxed">
                I hereby confirm that I am <strong>{candidate.name}</strong> from <strong>{candidate.college}</strong>.
                I agree to adhere to the examination rules and will not use unauthorized materials, secondary tabs, or external assistance.
              </span>
            </label>

            <div
              className="flex items-center justify-between pt-4 border-t"
              style={{ borderColor: appearance.colors.secondary }}
            >
              <button
                onClick={onExit}
                className="px-4 py-2 text-xs font-medium hover:opacity-80 transition"
                style={{ color: appearance.colors.textSecondary }}
              >
                Cancel & Exit
              </button>

              <button
                disabled={!pledgeChecked}
                onClick={async () => {
                  if (isFullscreenConfigured) {
                    await requestBrowserFullscreen();
                  }
                  const dl = Date.now() + totalSecondsAllocated * 1000;
                  setDeadlineMs(dl);
                  setHasStarted(true);
                }}
                className={`px-6 py-2.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed text-white transition shadow-sm flex items-center gap-2 ${buttonRadiusClass}`}
                style={{ backgroundColor: appearance.colors.buttonPrimary }}
              >
                {isFullscreenConfigured && <Maximize2 className="w-3.5 h-3.5" />}
                <span>
                  {isFullscreenConfigured
                    ? 'Enter Fullscreen (F11) & Start Examination'
                    : 'I Am Ready — Start Examination'}
                </span>
              </button>
            </div>
          </div>
        </main>

        <footer
          className="max-w-4xl mx-auto w-full text-center text-xs"
          style={{ color: appearance.colors.textSecondary }}
        >
          {renderWithAttlicBrand(
            appearance.branding.footerBrandingText || 'ATTLIC Proctoring Shield • Active Encryption'
          )}
        </footer>
      </div>
    );
  }

  // Active Examination Environment
  return (
    <div
      className={`min-h-screen flex flex-col select-none ${fontFamilyClass}`}
      data-student-theme={appearance.theme}
      style={scopedThemeStyle}
    >
      {/* Strict Fullscreen Exit Lock Overlay */}
      {isFullscreenLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
          <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500/70 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto animate-pulse">
              <Maximize2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                Security Lock Active
              </span>
              <h3 className="text-lg font-bold text-white">
                Exam Locked: Full Screen Required
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed pt-1">
                You have exited fullscreen mode. All questions, options, and submission buttons are locked until fullscreen is re-entered.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-rose-400 font-mono font-bold">
              Fullscreen Exits: {fullscreenExitCount} security incident{fullscreenExitCount === 1 ? '' : 's'} logged
            </div>

            <button
              onClick={async () => {
                await requestBrowserFullscreen();
                if (checkIsFullscreen()) {
                  setIsFullscreenLocked(false);
                }
              }}
              className={`w-full py-2.5 text-xs font-semibold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 ${buttonRadiusClass}`}
              style={{ backgroundColor: appearance.colors.buttonPrimary }}
            >
              <Maximize2 className="w-4 h-4" />
              <span>Resume Fullscreen Mode (or Press F11)</span>
            </button>
          </div>
        </div>
      )}

      {/* Proctoring Warning & 2-Minute Blocked Penalty Timer Overlay */}
      {showViolationModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div
            className={`max-w-md w-full bg-slate-900 border-2 rounded-2xl p-6 text-center space-y-4 shadow-2xl ${
              violationLockoutSeconds > 0 ? 'border-rose-500/70' : 'border-amber-500/50'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto border ${
                violationLockoutSeconds > 0
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">
                {violationLockoutSeconds > 0
                  ? 'Violation Limit Exceeded — 2-Minute Penalty Block'
                  : 'Focus Loss / Tab Switch Detected'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {violationLockoutSeconds > 0
                  ? 'You have reached or exceeded the permitted tab-switch violation limit. Your examination is temporarily blocked for 2 minutes before you can resume.'
                  : 'You switched tabs or lost window focus. This incident has been logged on your proctoring audit record.'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-400 font-mono font-bold">
              Violations: {tabSwitchCount} / {assessment.antiCheating?.maxTabSwitches || 3} allowed
            </div>

            {violationLockoutSeconds > 0 && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-300 block font-bold">
                  Mandatory Penalty Lockout Timer
                </span>
                <div className="text-3xl font-mono font-extrabold text-rose-400 tracking-widest">
                  {Math.floor(violationLockoutSeconds / 60)
                    .toString()
                    .padStart(2, '0')}
                  :
                  {(violationLockoutSeconds % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-[11px] text-rose-200/80">
                  Please remain on this window. You will be allowed to resume once the 2-minute penalty timer finishes.
                </p>
              </div>
            )}

            <button
              disabled={violationLockoutSeconds > 0}
              onClick={() => setShowViolationModal(false)}
              className={`w-full py-2.5 text-xs font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${buttonRadiusClass}`}
              style={{ backgroundColor: appearance.colors.buttonPrimary }}
            >
              {violationLockoutSeconds > 0
                ? `Blocked — Wait ${Math.floor(violationLockoutSeconds / 60)}:${(
                    violationLockoutSeconds % 60
                  )
                    .toString()
                    .padStart(2, '0')} to Resume`
                : 'Resume Examination Immediately'}
            </button>
          </div>
        </div>
      )}

      {/* Last Question Next Click -> Review All Questions Again or Submit Test Modal */}
      {showEndOfExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="max-w-md w-full bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Final Question Reached</h3>
                  <p className="text-[11px] text-slate-400">
                    Review all questions again or submit your test
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEndOfExamModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                You have reached the last question of the assessment. Would you like to{' '}
                <strong className="text-white">review all questions again</strong> from Question 1, or{' '}
                <strong className="text-emerald-400">submit your test</strong> now?
              </p>

              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Answered</span>
                  <span className="text-base font-bold font-mono text-emerald-400">{answeredCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Marked Review</span>
                  <span className="text-base font-bold font-mono text-purple-400">{markedReviewCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Unanswered</span>
                  <span className="text-base font-bold font-mono text-slate-400">{unansweredCount}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentSectionIndex(0);
                  setCurrentQuestionIndex(0);
                  setShowEndOfExamModal(false);
                }}
                className={`w-full sm:w-auto px-4 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition flex items-center justify-center gap-1.5 ${buttonRadiusClass}`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Review All Questions Again</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setShowEndOfExamModal(false);
                  handleFinalSubmit();
                }}
                className={`w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white transition shadow-sm flex items-center justify-center gap-1.5 hover:opacity-90 ${buttonRadiusClass}`}
                style={{ backgroundColor: appearance.colors.buttonPrimary }}
              >
                {isSubmitting ? (
                  <>
                    <WaitingAnimation size="xs" inline />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit the Test</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Submit Examination?</h3>
              <button
                onClick={() => setShowSubmitConfirmModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400">
                Please review your answer status before submitting. Once submitted, you cannot modify responses.
              </p>

              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Answered</span>
                  <span className="text-base font-bold font-mono text-emerald-400">{answeredCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Marked Review</span>
                  <span className="text-base font-bold font-mono text-purple-400">{markedReviewCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Unanswered</span>
                  <span className="text-base font-bold font-mono text-slate-400">{unansweredCount}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSubmitConfirmModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Continue Test
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className={`px-5 py-2 text-xs font-semibold text-white transition shadow-sm flex items-center gap-1.5 hover:opacity-90 ${buttonRadiusClass}`}
                style={{ backgroundColor: appearance.colors.buttonPrimary }}
              >
                {isSubmitting ? (
                  <>
                    <WaitingAnimation size="xs" inline />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm Final Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Test Header */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md px-4 sm:px-6 h-16 flex items-center justify-between"
        style={{
          borderColor: appearance.colors.secondary,
          backgroundColor: `${appearance.colors.background}f5`,
        }}
      >
        <div className="flex items-center gap-3">
          {appearance.branding.showCompanyLogo && appearance.branding.companyLogoUrl ? (
            <img
              src={appearance.branding.companyLogoUrl}
              alt="Logo"
              className="h-8 max-w-[140px] object-contain rounded"
            />
          ) : (
            <BrandLogo size="sm" showTagline={false} primaryColor={appearance.colors.primary} />
          )}
          <div
            className="hidden sm:block border-l pl-3"
            style={{ borderColor: appearance.colors.secondary }}
          >
            <h2 className="text-xs font-bold line-clamp-1" style={{ color: appearance.colors.textMain }}>
              {assessment.title}
            </h2>
            <p className="text-[10px] font-mono" style={{ color: appearance.colors.textSecondary }}>
              Code: {assessment.code}
            </p>
          </div>
        </div>

        {/* Section Tabs in Header */}
        {appearance.candidateExperience.showSectionProgress && (
          <div
            className="hidden md:flex items-center gap-1 border p-1 rounded-lg text-xs"
            style={{
              backgroundColor: appearance.colors.secondary,
              borderColor: `${appearance.colors.primary}20`,
            }}
          >
            {assessment.sections.map((sec, idx) => (
              <button
                key={sec.id}
                onClick={() => {
                  setCurrentSectionIndex(idx);
                  setCurrentQuestionIndex(0);
                }}
                className={`px-3 py-1 rounded-md transition ${
                  currentSectionIndex === idx
                    ? 'text-white font-semibold shadow-sm'
                    : 'hover:opacity-80'
                }`}
                style={
                  currentSectionIndex === idx
                    ? { backgroundColor: appearance.colors.buttonPrimary }
                    : { color: appearance.colors.textSecondary }
                }
              >
                {sec.title.split(':')[0] || `Section ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Countdown Timer & Submit Action */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Saved {lastAutosavedAt}</span>
          </div>

          {appearance.candidateExperience.showTimer && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold ${
                isUrgent
                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-400 animate-pulse'
                  : 'border-transparent'
              }`}
              style={
                !isUrgent
                  ? {
                      backgroundColor: appearance.colors.secondary,
                      color: appearance.colors.timerColor,
                      borderColor: `${appearance.colors.timerColor}30`,
                    }
                  : undefined
              }
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {minutesLeft}:{secondsLeft.toString().padStart(2, '0')}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowSubmitConfirmModal(true)}
            className={`px-3.5 py-1.5 text-xs font-semibold text-white transition shadow-sm hover:opacity-90 ${buttonRadiusClass}`}
            style={{ backgroundColor: appearance.colors.buttonPrimary }}
          >
            Submit Test
          </button>
        </div>
      </header>

      {/* Network Disconnection Banner */}
      {!isOnline && (
        <div className="bg-amber-950/90 border-b border-amber-500/40 text-amber-300 text-xs py-2 px-4 text-center flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Network connection interrupted. Offline exam mode active: all your responses are continuously autosaved locally and will sync when internet returns.
          </span>
        </div>
      )}

      {/* Main Examination Viewport (Split Grid: Question on left, Palette on right) */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Active Question Viewer (3 cols) */}
        <div
          className={`lg:col-span-3 flex flex-col justify-between rounded-xl p-6 ${cardDesignClass}`}
          style={{
            backgroundColor: appearance.colors.cardBackground,
            color: appearance.colors.textMain,
          }}
        >
          {currentQuestion ? (
            <div className="space-y-6">
              {/* Progress Indicator Bar */}
              {appearance.candidateExperience.showProgressPercentage && (
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: `${appearance.colors.secondary}` }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${Math.round(((currentQuestionIndex + 1) / Math.max(1, totalQuestions)) * 100)}%`,
                      backgroundColor: appearance.colors.progressIndicator,
                    }}
                  />
                </div>
              )}

              {/* Question Header */}
              <div
                className="flex items-center justify-between pb-3 border-b"
                style={{ borderColor: appearance.colors.secondary }}
              >
                <div className="flex items-center gap-2">
                  {appearance.candidateExperience.showQuestionNumbers && (
                    <span
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: `${appearance.colors.primary}20`,
                        color: appearance.colors.primary,
                        borderColor: `${appearance.colors.primary}40`,
                      }}
                    >
                      Question {currentQuestionIndex + 1}
                      {appearance.candidateExperience.showTotalQuestionCount && ` of ${totalQuestions}`}
                    </span>
                  )}
                  {appearance.candidateExperience.showSectionProgress && (
                    <span className="text-xs font-medium" style={{ color: appearance.colors.textSecondary }}>
                      {currentSection.title}
                    </span>
                  )}
                </div>

                {appearance.candidateExperience.showQuestionMarks && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-emerald-400 font-semibold font-mono">
                      +{currentQuestion.marks} marks
                    </span>
                    {currentQuestion.negativeMarks > 0 && (
                      <span className="text-rose-400 font-semibold font-mono">
                        -{currentQuestion.negativeMarks} neg
                      </span>
                    )}
                    <span
                      className="px-2 py-0.5 rounded text-[10px] uppercase font-bold"
                      style={{
                        backgroundColor: appearance.colors.secondary,
                        color: appearance.colors.textSecondary,
                      }}
                    >
                      {currentQuestion.difficulty}
                    </span>
                  </div>
                )}
              </div>

              {/* Question Title & Code */}
              <div className="space-y-4">
                <h3
                  className={`font-medium leading-relaxed ${questionSizeClass} ${lineSpacingClass}`}
                  style={{ color: appearance.colors.textMain }}
                >
                  {currentQuestion.title}
                </h3>

                {currentQuestion.codeSnippet && (
                  <div
                    className="rounded-lg border p-4 font-mono text-xs overflow-x-auto"
                    style={{
                      backgroundColor: appearance.colors.secondary,
                      borderColor: `${appearance.colors.primary}20`,
                      color: appearance.colors.primary,
                    }}
                  >
                    <pre>{currentQuestion.codeSnippet}</pre>
                  </div>
                )}
              </div>

              {/* Choices Options / Input / Coding IDE */}
              {currentQuestion.type === 'coding_problem' ? (() => {
                const {
                  cfg,
                  activeLang,
                  currentCode,
                  results,
                  passedTestCases,
                  totalTestCases,
                } = getCodingStateForQuestion(currentQuestion);
                const sampleCases = cfg.testCases.filter((tc) => tc.isSample);
                const lineCount = Math.max(12, currentCode.split('\n').length);

                return (
                  <div className="space-y-4 pt-2 select-text">
                    {/* Problem Specs: Input / Output / Constraints & Sample Test Cases */}
                    <div
                      className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border text-xs"
                      style={{
                        backgroundColor: appearance.colors.secondary,
                        borderColor: `${appearance.colors.primary}25`,
                      }}
                    >
                      <div>
                        <span
                          className="text-[10px] uppercase font-bold block mb-1"
                          style={{ color: appearance.colors.primary }}
                        >
                          Input Format
                        </span>
                        <p className="text-[11px] leading-relaxed" style={{ color: appearance.colors.textSecondary }}>
                          {cfg.inputFormat || 'Read input from standard input (stdin).'}
                        </p>
                      </div>
                      <div>
                        <span
                          className="text-[10px] uppercase font-bold block mb-1"
                          style={{ color: appearance.colors.primary }}
                        >
                          Output Format
                        </span>
                        <p className="text-[11px] leading-relaxed" style={{ color: appearance.colors.textSecondary }}>
                          {cfg.outputFormat || 'Print result to standard output (stdout).'}
                        </p>
                      </div>
                      <div>
                        <span
                          className="text-[10px] uppercase font-bold block mb-1"
                          style={{ color: appearance.colors.primary }}
                        >
                          Constraints &amp; Limits
                        </span>
                        <p className="text-[11px] font-mono" style={{ color: appearance.colors.textSecondary }}>
                          {cfg.constraints || 'Standard constraints'} • Time: {cfg.timeLimitSeconds || 2}s • Mem:{' '}
                          {cfg.memoryLimitMb || 256}MB
                        </p>
                      </div>
                    </div>

                    {/* Sample Test Cases Preview */}
                    {sampleCases.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sampleCases.map((stc, sIdx) => (
                          <div
                            key={stc.id}
                            className="p-3 rounded-xl border text-xs space-y-2"
                            style={{
                              backgroundColor: appearance.colors.secondary,
                              borderColor: `${appearance.colors.primary}20`,
                            }}
                          >
                            <span
                              className="text-[10px] uppercase font-bold tracking-wider block"
                              style={{ color: appearance.colors.textSecondary }}
                            >
                              Sample Test Case #{sIdx + 1}
                            </span>
                            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                              <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                                <span className="text-[9px] uppercase text-slate-400 block">Input (stdin)</span>
                                <pre className="text-slate-200 whitespace-pre-wrap">{stc.input}</pre>
                              </div>
                              <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                                <span className="text-[9px] uppercase text-slate-400 block">Expected Output</span>
                                <pre className="text-emerald-400 whitespace-pre-wrap">{stc.expectedOutput}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* In-Built Multi-Language Coding IDE Container */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
                      {/* IDE Top Bar */}
                      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                            <Code2 className="w-4 h-4" />
                            <span>Code Editor</span>
                          </div>

                          <select
                            aria-label="Select Programming Language"
                            value={activeLang}
                            onChange={(e) =>
                              handleCodingLanguageSelect(
                                currentQuestion,
                                e.target.value as CodingLanguage
                              )
                            }
                            className="px-3 py-1 text-xs font-mono font-semibold bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                          >
                            {SUPPORTED_CODING_LANGUAGES.filter((l) =>
                              cfg.allowedLanguages.includes(l.id)
                            ).map((lang) => (
                              <option key={lang.id} value={lang.id}>
                                {lang.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          {typeof passedTestCases === 'number' && (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                                passedTestCases === totalTestCases && totalTestCases > 0
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : passedTestCases > 0
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              }`}
                            >
                              {passedTestCases} / {totalTestCases} Test Cases Passed
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleResetCodingStarter(currentQuestion)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center gap-1 transition"
                            title="Reset to starter code template"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Template</span>
                          </button>
                        </div>
                      </div>

                      {/* Real Monaco Code Editor (VS Code Engine with Colorful Syntax, IntelliSense & Live Error Checking) */}
                      <MonacoCodeEditor
                        language={activeLang}
                        value={currentCode}
                        onChange={(nextVal) =>
                          handleCodingSourceChange(currentQuestion, nextVal)
                        }
                        height="390px"
                        compilerStderr={
                          customRunOutput?.stderr ||
                          results?.find((r) => r.errorMessage)?.errorMessage
                        }
                        showQuickSnippets={true}
                      />

                      {/* IDE Action Bar */}
                      <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useCustomInput}
                            onChange={(e) => setUseCustomInput(e.target.checked)}
                            className="accent-indigo-500"
                          />
                          <span>Test with Custom Input (stdin)</span>
                        </label>

                        <div className="flex items-center gap-2">
                          {useCustomInput && (
                            <button
                              type="button"
                              disabled={isRunningCode}
                              onClick={() => handleRunCodingTests(currentQuestion, true)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Run Custom Input</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isRunningCode}
                            onClick={() => handleRunCodingTests(currentQuestion, false)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>
                              {isRunningCode
                                ? 'Compiling & Running...'
                                : 'Run Code & Evaluate Test Cases'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Custom Input Drawer */}
                      {useCustomInput && (
                        <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
                          <label className="text-[10px] uppercase font-bold text-slate-400 block">
                            Custom Standard Input (stdin)
                          </label>
                          <textarea
                            rows={2}
                            value={customStdin}
                            onChange={(e) => setCustomStdin(e.target.value)}
                            className="w-full p-2 text-xs font-mono bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                          />
                          {customRunOutput && (
                            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`font-bold ${
                                    customRunOutput.status === 'AC'
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  Status: {customRunOutput.status}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {customRunOutput.executionTimeMs} ms
                                </span>
                              </div>
                              {customRunOutput.stdout && (
                                <pre className="text-slate-100 whitespace-pre-wrap">
                                  {customRunOutput.stdout}
                                </pre>
                              )}
                              {customRunOutput.stderr && (
                                <pre className="text-rose-400 whitespace-pre-wrap">
                                  {customRunOutput.stderr}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Test Cases Execution Results Console */}
                      {results && results.length > 0 && (
                        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Terminal className="w-4 h-4 text-emerald-400" />
                              <span>Automated Test Case Execution Report</span>
                            </span>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              Score Impact: {passedTestCases} / {totalTestCases} Passed
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {results.map((r, rIdx) => (
                              <div
                                key={r.testCaseId}
                                className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                                  r.passed
                                    ? 'bg-emerald-950/20 border-emerald-500/40'
                                    : 'bg-rose-950/20 border-rose-500/40'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-white flex items-center gap-1.5">
                                    {!r.isSample && <Lock className="w-3 h-3 text-amber-400" />}
                                    <span>
                                      Test Case #{rIdx + 1}{' '}
                                      {r.isSample ? '(Sample)' : '(Hidden Grading)'}
                                    </span>
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      r.passed
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-rose-500/20 text-rose-300'
                                    }`}
                                  >
                                    {r.status} • {r.executionTimeMs}ms
                                  </span>
                                </div>

                                {r.isSample ? (
                                  <div className="font-mono text-[11px] space-y-1 pt-1 text-slate-300">
                                    <div>
                                      <span className="text-slate-500">Expected: </span>
                                      <span className="text-emerald-300">{r.expectedOutput}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Your Output: </span>
                                      <span className={r.passed ? 'text-emerald-300' : 'text-rose-300'}>
                                        {r.actualOutput || '(empty)'}
                                      </span>
                                    </div>
                                    {r.errorMessage && (
                                      <div className="text-rose-400 text-[10px]">
                                        {r.errorMessage}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-slate-400">
                                    {r.passed
                                      ? '✓ Hidden edge-case input verified successfully.'
                                      : r.errorMessage ||
                                        '✗ Output did not match hidden test case expected output.'}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : currentQuestion.type === 'short_text' ? (
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold" style={{ color: appearance.colors.textSecondary }}>
                    Type your answer below:
                  </label>
                  <textarea
                    rows={4}
                    value={answers[currentQuestion.id]?.textAnswer || ''}
                    onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Enter your concise answer or numeric calculation..."
                    className="w-full p-3 text-xs border rounded-lg placeholder-slate-500 focus:outline-none"
                    style={{
                      backgroundColor: appearance.colors.secondary,
                      borderColor: `${appearance.colors.primary}30`,
                      color: appearance.colors.textMain,
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {currentQuestion.options.map((opt, oIdx) => {
                    const isSelected = answers[currentQuestion.id]?.selectedOptionIds.includes(
                      opt.id
                    );
                    const isMulti = currentQuestion.type === 'multiple_choice';

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(currentQuestion.id, opt.id, isMulti)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center gap-3 ${optionSizeClass} ${lineSpacingClass}`}
                        style={{
                          backgroundColor: isSelected
                            ? `${appearance.colors.primary}20`
                            : appearance.colors.secondary,
                          borderColor: isSelected
                            ? appearance.colors.primary
                            : `${appearance.colors.primary}15`,
                          color: isSelected ? appearance.colors.textMain : appearance.colors.textSecondary,
                        }}
                      >
                        <div
                          className={`w-5 h-5 rounded-${isMulti ? 'md' : 'full'} border flex items-center justify-center shrink-0`}
                          style={{
                            borderColor: isSelected ? appearance.colors.primary : `${appearance.colors.textSecondary}50`,
                            backgroundColor: isSelected ? appearance.colors.buttonPrimary : 'transparent',
                          }}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="leading-relaxed">{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs" style={{ color: appearance.colors.textSecondary }}>
              No questions found in this section.
            </div>
          )}

          {/* Bottom Controls */}
          {currentQuestion && (
            <div
              className="pt-6 mt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
              style={{ borderColor: appearance.colors.secondary }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleMarkForReview(currentQuestion.id)}
                  className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                    answers[currentQuestion.id]?.isMarkedForReview
                      ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  style={{ backgroundColor: appearance.colors.secondary }}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>
                    {answers[currentQuestion.id]?.isMarkedForReview
                      ? 'Marked for Review'
                      : 'Mark for Review'}
                  </span>
                </button>

                <button
                  onClick={() => handleClearResponse(currentQuestion.id)}
                  className="px-3 py-1.5 transition hover:opacity-80"
                  style={{ color: appearance.colors.textSecondary }}
                >
                  Clear Response
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
                  onClick={handlePrevQuestion}
                  className={`px-3 py-1.5 border disabled:opacity-40 flex items-center gap-1 ${buttonRadiusClass}`}
                  style={{
                    backgroundColor: appearance.colors.secondary,
                    borderColor: `${appearance.colors.primary}20`,
                    color: appearance.colors.textMain,
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={handleNextQuestion}
                  className={`px-4 py-1.5 text-white font-medium flex items-center gap-1 shadow-sm ${buttonRadiusClass}`}
                  style={{ backgroundColor: appearance.colors.buttonPrimary }}
                >
                  <span>{isLastQuestionOfExam ? 'Next (Review / Submit)' : 'Save & Next'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Question Palette & Section Overview (1 col) */}
        <div className="space-y-4">
          <div
            className={`rounded-xl p-4 space-y-4 ${cardDesignClass}`}
            style={{
              backgroundColor: appearance.colors.cardBackground,
              color: appearance.colors.textMain,
            }}
          >
            <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: appearance.colors.textSecondary }}>
              Question Palette
            </h4>

            {/* Legend */}
            {appearance.candidateExperience.showAnswerStatus && (
              <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ color: appearance.colors.textSecondary }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Answered ({answeredCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  Review ({markedReviewCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700" />
                  Unanswered ({unansweredCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: appearance.colors.primary }}
                  />
                  Current
                </span>
              </div>
            )}

            {/* Questions Grid for active section */}
            <div className="pt-2 border-t" style={{ borderColor: appearance.colors.secondary }}>
              <span className="text-[11px] block mb-2 font-medium" style={{ color: appearance.colors.textSecondary }}>
                {currentSection.title}:
              </span>
              <div className="grid grid-cols-5 gap-2">
                {currentSection.questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const hasAnswered =
                    ans &&
                    (ans.selectedOptionIds.length > 0 ||
                      (ans.textAnswer && ans.textAnswer.length > 0) ||
                      (ans.codeAnswer && ans.codeAnswer.trim().length > 0));
                  const isCurrent = idx === currentQuestionIndex;
                  const isMarked = ans?.isMarkedForReview;

                  let bgClass = 'bg-slate-950 border-slate-800 text-slate-400';
                  let customStyle: React.CSSProperties | undefined = {
                    backgroundColor: appearance.colors.secondary,
                    borderColor: `${appearance.colors.primary}20`,
                    color: appearance.colors.textSecondary,
                  };
                  if (isCurrent) {
                    bgClass = 'text-white font-bold shadow-sm';
                    customStyle = {
                      backgroundColor: appearance.colors.buttonPrimary,
                      borderColor: appearance.colors.primary,
                      color: '#ffffff',
                      boxShadow: `0 0 0 2px ${appearance.colors.primary}40`,
                    };
                  } else if (isMarked) {
                    bgClass = 'border-purple-500/50 bg-purple-950/60 text-purple-300 font-bold';
                    customStyle = undefined;
                  } else if (hasAnswered) {
                    bgClass = 'font-bold';
                    customStyle = {
                      backgroundColor: `${appearance.colors.primary}25`,
                      borderColor: `${appearance.colors.primary}60`,
                      color: appearance.colors.primary,
                    };
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`h-8 rounded-lg border text-xs font-mono transition flex items-center justify-center ${bgClass}`}
                      style={customStyle}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Candidate Profile Widget */}
          <div
            className={`rounded-xl p-4 text-xs space-y-2 ${cardDesignClass}`}
            style={{
              backgroundColor: appearance.colors.cardBackground,
              color: appearance.colors.textMain,
            }}
          >
            <div className="flex items-center justify-between" style={{ color: appearance.colors.textSecondary }}>
              <span>Candidate</span>
              <span className="font-semibold" style={{ color: appearance.colors.textMain }}>{candidate.name}</span>
            </div>
            <div className="flex items-center justify-between" style={{ color: appearance.colors.textSecondary }}>
              <span>Roll Number</span>
              <span className="font-mono" style={{ color: appearance.colors.textMain }}>{candidate.rollNumber}</span>
            </div>
            <div className="flex items-center justify-between" style={{ color: appearance.colors.textSecondary }}>
              <span>Auto-Save</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
