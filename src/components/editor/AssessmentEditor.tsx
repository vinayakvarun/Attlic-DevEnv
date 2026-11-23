/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Complete Assessment Editor (Stage 4)
 * Professional Three-Part Interface: Left Navigator, Main Editor, Right Inspector
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Assessment,
  AssessmentSection,
  Question,
  QuestionType,
  QuestionOption,
  DashboardTab,
  CodingLanguage,
  CodingProblemConfig,
  CodingTestCase,
} from '../../types';
import { useAssessments } from '../../context/AssessmentContext';
import { useAuth } from '../../context/AuthContext';
import {
  SUPPORTED_CODING_LANGUAGES,
  getDefaultCodingConfig,
  getDefaultStarterCode,
  getCleanBoilerplateCode,
} from '../../utils/codeExecutionEngine';
import MonacoCodeEditor from '../common/MonacoCodeEditor';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Layers,
  HelpCircle,
  Sliders,
  Sparkles,
  FileText,
  Clock,
  ShieldAlert,
  MoveUp,
  MoveDown,
  Check,
  AlertTriangle,
  Play,
  Share2,
  RefreshCw,
  FolderPlus,
  X,
  ExternalLink,
  Tag,
  Building,
  Target,
  Palette,
  Code2,
  Terminal,
  Shuffle,
  Calendar,
  Camera,
} from 'lucide-react';
import { AppearanceStudio } from './AppearanceStudio';
import { WaitingAnimation } from '../common/WaitingAnimation';

interface AssessmentEditorProps {
  assessmentId: string;
  isScratchSession?: boolean;
  onNavigateTab: (tab: DashboardTab) => void;
  onOpenCandidatePortalWithCode: (code: string) => void;
}

type EditorSelection =
  | { type: 'overview' }
  | { type: 'section'; sectionId: string }
  | { type: 'question'; sectionId: string; questionId: string };

type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ValidationError {
  type: 'title' | 'no_questions' | 'missing_answer_key' | 'invalid_marks' | 'duplicate_id';
  message: string;
  sectionId?: string;
  questionId?: string;
  questionTitle?: string;
}

export const AssessmentEditor: React.FC<AssessmentEditorProps> = ({
  assessmentId,
  isScratchSession = false,
  onNavigateTab,
  onOpenCandidatePortalWithCode,
}) => {
  const { assessments, updateAssessment, publishAssessment, refreshData } = useAssessments();
  const { currentUser } = useAuth();

  // Mode: Questions/Rules vs Appearance Studio
  const [editorMode, setEditorMode] = useState<'content' | 'appearance'>('content');
  const [activeStarterLangTab, setActiveStarterLangTab] = useState<CodingLanguage>('python');

  // Find target assessment
  const targetAssessment = useMemo(() => {
    return assessments.find((a) => a.id === assessmentId);
  }, [assessments, assessmentId]);

  // Working editable assessment state
  const [assessment, setAssessment] = useState<Assessment | null>(null);

  // Visibility Gating:
  // - Completely hidden for recruiters who imported from Google Forms.
  // - Fully functional and editable for recruiters who created from scratch or enabled the coding option.
  const isImportedFromGoogleForm = Boolean(
    assessment?.creationSource === 'google_forms' ||
      (assessment?.tags || []).some((t) => /google form/i.test(t)) ||
      /imported from google form/i.test(assessment?.description || '')
  );
  const canUseCodingEnvironment = Boolean(!isImportedFromGoogleForm);
  const isCodingActive = Boolean(
    !isImportedFromGoogleForm &&
      (assessment?.enableCodingEnvironment ||
        assessment?.sections.some(
          (s) => s.isCodingSection || s.questions.some((q) => q.type === 'coding_problem')
        ))
  );

  const isSectionCoding = (sec?: AssessmentSection | null) =>
    Boolean(sec && (sec.isCodingSection || sec.questions.some((q) => q.type === 'coding_problem')));

  // Active selection in editor
  const [selection, setSelection] = useState<EditorSelection>({ type: 'overview' });

  // Autosave tracking
  const [autosaveEnabled, setAutosaveEnabled] = useState<boolean>(true);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Validation modal state
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [applyDefaultsToast, setApplyDefaultsToast] = useState<string | null>(null);

  // Sync initial assessment
  useEffect(() => {
    if (targetAssessment && (!assessment || assessment.id !== targetAssessment.id)) {
      setAssessment(JSON.parse(JSON.stringify(targetAssessment)));
      // Default to first question if available
      if (
        targetAssessment.sections.length > 0 &&
        targetAssessment.sections[0].questions.length > 0
      ) {
        setSelection({
          type: 'question',
          sectionId: targetAssessment.sections[0].id,
          questionId: targetAssessment.sections[0].questions[0].id,
        });
      } else {
        setSelection({ type: 'overview' });
      }
    }
  }, [targetAssessment]);

  // Protection against accidental page close when saving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (autosaveState === 'saving') {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in your assessment. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autosaveState]);

  const pendingAssessmentRef = useRef<Assessment | null>(null);

  // Flush any pending debounced autosave immediately on unmount (e.g. when navigating to Test Hall or switching tabs)
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (pendingAssessmentRef.current) {
        const toSave = pendingAssessmentRef.current;
        pendingAssessmentRef.current = null;
        updateAssessment(toSave).catch(() => {});
      }
    };
  }, []);

  // Debounced Autosave Trigger
  const triggerAutosave = (updatedAssessment: Assessment) => {
    setAssessment(updatedAssessment);
    pendingAssessmentRef.current = updatedAssessment;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!autosaveEnabled) {
      setAutosaveState('idle');
      return;
    }

    setAutosaveState('saving');

    debounceTimerRef.current = setTimeout(async () => {
      try {
        setSaveErrorMessage(null);
        pendingAssessmentRef.current = null;
        await updateAssessment(updatedAssessment);
        setAutosaveState('saved');
        setLastSavedTime(new Date());
      } catch (err: any) {
        setAutosaveState('error');
        setSaveErrorMessage(err.message || 'Network disconnected or cloud write denied.');
      }
    }, 600);
  };

  // Immediate save on demand
  const handleSaveImmediate = async () => {
    if (!assessment) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    pendingAssessmentRef.current = null;
    try {
      setAutosaveState('saving');
      setSaveErrorMessage(null);
      await updateAssessment(assessment);
      setAutosaveState('saved');
      setLastSavedTime(new Date());
      setApplyDefaultsToast('Assessment changes saved successfully.');
      setTimeout(() => setApplyDefaultsToast(null), 2500);
    } catch (err: any) {
      setAutosaveState('error');
      setSaveErrorMessage(err.message || 'Save failed.');
    }
  };

  // -------------------------------------------------------------
  // Calculated Metrics
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    if (!assessment) {
      return { totalQuestions: 0, totalMarks: 0, sectionBreakdown: [] };
    }

    let qCount = 0;
    let marksSum = 0;
    const breakdown = assessment.sections.map((sec, sIdx) => {
      const secQCount = sec.questions.length;
      const secMarks = sec.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
      qCount += secQCount;
      marksSum += secMarks;
      return {
        id: sec.id,
        title: sec.title || `Section ${sIdx + 1}`,
        questionCount: secQCount,
        marks: secMarks,
      };
    });

    return {
      totalQuestions: qCount,
      totalMarks: marksSum,
      sectionBreakdown: breakdown,
    };
  }, [assessment]);

  // Keep assessment totalMarks synced with sum of questions
  useEffect(() => {
    if (assessment && metrics.totalMarks > 0 && assessment.totalMarks !== metrics.totalMarks) {
      const updated = {
        ...assessment,
        totalMarks: metrics.totalMarks,
        passingMarks: Math.max(
          1,
          Math.round(
            (metrics.totalMarks * (assessment.passingPercentage || 40)) / 100
          )
        ),
      };
      triggerAutosave(updated);
    }
  }, [metrics.totalMarks]);

  // -------------------------------------------------------------
  // Validation Engine
  // -------------------------------------------------------------
  const validateAssessment = (item: Assessment): ValidationError[] => {
    const errors: ValidationError[] = [];

    // 1. Title validation
    if (!item.title || !item.title.trim()) {
      errors.push({
        type: 'title',
        message: 'Assessment title is required and cannot be blank.',
      });
    }

    // 2. Minimum questions check
    const totalQ = item.sections.reduce((acc, s) => acc + s.questions.length, 0);
    if (totalQ === 0) {
      errors.push({
        type: 'no_questions',
        message: 'Assessment must contain at least 1 question before publishing.',
      });
    }

    // 3. Question validations & duplicate check
    const seenIds = new Set<string>();

    item.sections.forEach((sec) => {
      sec.questions.forEach((q, qIdx) => {
        const qTitle = q.title.trim() || `Untitled Question (${qIdx + 1})`;

        // Question statement check
        if (!q.title || !q.title.trim()) {
          errors.push({
            type: 'missing_answer_key',
            message: `Question ${qIdx + 1} in "${sec.title}" is missing its question statement.`,
            questionId: q.id,
            sectionId: sec.id,
            questionTitle: qTitle,
          });
        }

        // Duplicate ID check
        if (seenIds.has(q.id)) {
          errors.push({
            type: 'duplicate_id',
            message: `Duplicate question identifier detected: "${q.id}".`,
            questionId: q.id,
            sectionId: sec.id,
          });
        }
        seenIds.add(q.id);

        // Invalid marks check
        if (isNaN(q.marks) || q.marks <= 0) {
          errors.push({
            type: 'invalid_marks',
            message: `Question "${qTitle.slice(0, 30)}..." has invalid positive marks (${q.marks}). Must be greater than 0.`,
            questionId: q.id,
            sectionId: sec.id,
            questionTitle: qTitle,
          });
        }
        if (q.negativeMarks < 0 || q.negativeMarks > q.marks) {
          errors.push({
            type: 'invalid_marks',
            message: `Question "${qTitle.slice(0, 30)}..." has negative marks (${q.negativeMarks}) exceeding positive marks (${q.marks}).`,
            questionId: q.id,
            sectionId: sec.id,
            questionTitle: qTitle,
          });
        }

        // Answer key validation for auto-graded questions
        if (q.type === 'single_choice' || q.type === 'true_false') {
          const hasCorrect =
            (q.correctOptionIds && q.correctOptionIds.length === 1) ||
            q.options.some((o) => o.isCorrect);
          if (!hasCorrect) {
            errors.push({
              type: 'missing_answer_key',
              message: `Single-choice question "${qTitle.slice(0, 35)}..." has no correct answer selected.`,
              questionId: q.id,
              sectionId: sec.id,
              questionTitle: qTitle,
            });
          }
        } else if (q.type === 'multiple_choice') {
          const hasCorrect =
            (q.correctOptionIds && q.correctOptionIds.length > 0) ||
            q.options.some((o) => o.isCorrect);
          if (!hasCorrect) {
            errors.push({
              type: 'missing_answer_key',
              message: `Multiple-choice question "${qTitle.slice(0, 35)}..." requires at least one correct option checked.`,
              questionId: q.id,
              sectionId: sec.id,
              questionTitle: qTitle,
            });
          }
        } else if (q.type === 'short_text') {
          // If no accepted answers and requires strict grading
          if (q.requiresAnswerKeyReview && (!q.shortTextAcceptedAnswers || q.shortTextAcceptedAnswers.length === 0)) {
            errors.push({
              type: 'missing_answer_key',
              message: `Short-text question "${qTitle.slice(0, 35)}..." has no accepted answer keywords configured.`,
              questionId: q.id,
              sectionId: sec.id,
              questionTitle: qTitle,
            });
          }
        } else if (q.type === 'coding_problem') {
          const tcs = q.codingConfig?.testCases || [];
          const hasValidTestCase = tcs.some((tc) => tc.expectedOutput && tc.expectedOutput.trim().length > 0);
          if (!hasValidTestCase) {
            errors.push({
              type: 'missing_answer_key',
              message: `Coding problem "${qTitle.slice(0, 35)}..." requires at least 1 test case with expected output.`,
              questionId: q.id,
              sectionId: sec.id,
              questionTitle: qTitle,
            });
          }
        }
      });
    });

    return errors;
  };

  // Publish with Validation Check
  const handlePublishToggle = async () => {
    if (!assessment) return;

    if (assessment.status !== 'published') {
      const errors = validateAssessment(assessment);
      if (errors.length > 0) {
        setValidationErrors(errors);
        setShowValidationModal(true);
        return;
      }
    }

    const nextStatus: Assessment['status'] = assessment.status === 'published' ? 'draft' : 'published';
    const updated = {
      ...assessment,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    triggerAutosave(updated);
  };

  // -------------------------------------------------------------
  // Section & Question Operations
  // -------------------------------------------------------------
  const handleAddSection = () => {
    if (!assessment) return;
    const newSecNum = assessment.sections.length + 1;
    const newSection: AssessmentSection = {
      id: `sec_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      title: `Section ${newSecNum}: Subject Knowledge`,
      description: 'Domain-specific placement assessment questions',
      order: newSecNum,
      isCodingSection: false,
      questions: [],
    };
    const updated = {
      ...assessment,
      sections: [...assessment.sections, newSection],
    };
    triggerAutosave(updated);
    setSelection({ type: 'section', sectionId: newSection.id });
  };

  const handleAddCodingSection = () => {
    if (!assessment) return;
    const newSecNum = assessment.sections.length + 1;
    const newSecId = `sec_code_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const newQId = `q_code_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const defaultCodingQ: Question = {
      id: newQId,
      sectionId: newSecId,
      type: 'coding_problem',
      title:
        'Sum of Array Elements: Given an integer N followed by N space-separated integers, compute and print the total sum of all N elements.',
      options: [],
      correctOptionIds: [],
      marks: 20,
      negativeMarks: 0,
      partialMarking: true,
      difficulty: 'medium',
      isRequired: true,
      explanation: 'Read N and accumulate all N integers using 64-bit integer arithmetic.',
      codingConfig: getDefaultCodingConfig(),
    };
    const newCodingSection: AssessmentSection = {
      id: newSecId,
      title: `Section ${newSecNum}: Hands-On Coding Challenges`,
      description: 'Multi-language coding problems evaluated against sample and hidden test cases',
      order: newSecNum,
      isCodingSection: true,
      questions: [defaultCodingQ],
    };
    const updated: Assessment = {
      ...assessment,
      enableCodingEnvironment: true,
      sections: [...assessment.sections, newCodingSection],
    };
    triggerAutosave(updated);
    setSelection({ type: 'question', sectionId: newSecId, questionId: newQId });
  };

  const handleDeleteSection = (sectionId: string) => {
    if (!assessment) return;
    const sec = assessment.sections.find((s) => s.id === sectionId);
    const secTitle = sec?.title || 'Section';

    if (assessment.sections.length <= 1) {
      const resetSecId = sec?.id || `sec_${Date.now()}`;
      const resetSection: AssessmentSection = {
        id: resetSecId,
        title: 'Section 1: Technical & Problem Solving',
        description: '',
        order: 1,
        isCodingSection: false,
        questions: [],
      };
      const updatedSingle: Assessment = {
        ...assessment,
        enableCodingEnvironment: false,
        totalMarks: 0,
        sections: [resetSection],
      };
      triggerAutosave(updatedSingle);
      setSelection({ type: 'section', sectionId: resetSecId });
      setApplyDefaultsToast(
        `Cleared "${secTitle}" (an assessment must contain at least 1 section).`
      );
      setTimeout(() => setApplyDefaultsToast(null), 4000);
      return;
    }

    const remainingSections = assessment.sections
      .filter((s) => s.id !== sectionId)
      .map((s, idx) => ({ ...s, order: idx + 1 }));

    const stillHasCodingSection = remainingSections.some((s) => isSectionCoding(s));
    const nextTotalMarks = remainingSections.reduce(
      (sum, s) => sum + s.questions.reduce((qSum, q) => qSum + (Number(q.marks) || 0), 0),
      0
    );

    const updated: Assessment = {
      ...assessment,
      enableCodingEnvironment: isSectionCoding(sec)
        ? stillHasCodingSection
        : assessment.enableCodingEnvironment,
      totalMarks: nextTotalMarks,
      passingMarks:
        nextTotalMarks > 0
          ? Math.max(
              1,
              Math.round((nextTotalMarks * (assessment.passingPercentage || 40)) / 100)
            )
          : assessment.passingMarks,
      sections: remainingSections,
    };

    triggerAutosave(updated);

    // If the currently viewed section or question belonged to the deleted section, move selection cleanly
    if (
      (selection.type === 'section' && selection.sectionId === sectionId) ||
      (selection.type === 'question' && selection.sectionId === sectionId)
    ) {
      const firstRemaining = remainingSections[0];
      if (firstRemaining && firstRemaining.questions.length > 0) {
        setSelection({
          type: 'question',
          sectionId: firstRemaining.id,
          questionId: firstRemaining.questions[0].id,
        });
      } else if (firstRemaining) {
        setSelection({ type: 'section', sectionId: firstRemaining.id });
      } else {
        setSelection({ type: 'overview' });
      }
    }

    setApplyDefaultsToast(`Deleted section "${secTitle}".`);
    setTimeout(() => setApplyDefaultsToast(null), 3500);
  };

  const handleUpdateSection = (sectionId: string, partial: Partial<AssessmentSection>) => {
    if (!assessment) return;
    const updated = {
      ...assessment,
      sections: assessment.sections.map((s) => (s.id === sectionId ? { ...s, ...partial } : s)),
    };
    triggerAutosave(updated);
  };

  const handleMoveSection = (sectionIndex: number, direction: 'up' | 'down') => {
    if (!assessment) return;
    const targetIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
    if (targetIndex < 0 || targetIndex >= assessment.sections.length) return;

    const reordered = [...assessment.sections];
    const temp = reordered[sectionIndex];
    reordered[sectionIndex] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const updated = {
      ...assessment,
      sections: reordered.map((s, idx) => ({ ...s, order: idx + 1 })),
    };
    triggerAutosave(updated);
  };

  const handleAddQuestion = (targetSectionId?: string, type: QuestionType = 'single_choice') => {
    if (!assessment) return;

    const newQId = `q_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const defaultPos = assessment.defaultMarks || 4;
    const defaultNeg = assessment.defaultNegativeMarks || 1;

    // If adding a coding_problem, ensure it goes into a dedicated Coding Section
    if (type === 'coding_problem') {
      const targetSec = targetSectionId
        ? assessment.sections.find((s) => s.id === targetSectionId)
        : undefined;
      const existingCodingSec =
        targetSec && isSectionCoding(targetSec)
          ? targetSec
          : assessment.sections.find((s) => isSectionCoding(s));

      if (!existingCodingSec) {
        handleAddCodingSection();
        return;
      }

      const newCodingQuestion: Question = {
        id: newQId,
        sectionId: existingCodingSec.id,
        type: 'coding_problem',
        title: `Coding Challenge ${existingCodingSec.questions.length + 1}: Given an integer N followed by N space-separated integers, compute and print the total sum of all N elements.`,
        options: [],
        correctOptionIds: [],
        marks: 20,
        negativeMarks: 0,
        partialMarking: true,
        difficulty: 'medium',
        isRequired: true,
        explanation: 'Read N and accumulate all N integers using 64-bit integer arithmetic.',
        codingConfig: getDefaultCodingConfig(),
      };

      const updated: Assessment = {
        ...assessment,
        enableCodingEnvironment: true,
        sections: assessment.sections.map((s) =>
          s.id === existingCodingSec.id
            ? { ...s, isCodingSection: true, questions: [...s.questions, newCodingQuestion] }
            : s
        ),
      };
      triggerAutosave(updated);
      setSelection({ type: 'question', sectionId: existingCodingSec.id, questionId: newQId });
      return;
    }

    // For regular non-coding questions, find a non-coding section first
    const targetSec = targetSectionId
      ? assessment.sections.find((s) => s.id === targetSectionId)
      : assessment.sections.find((s) => !isSectionCoding(s)) || assessment.sections[0];
    const effectiveSecId = targetSec?.id;
    if (!effectiveSecId) {
      handleAddSection();
      return;
    }

    let initialOptions: QuestionOption[] = [
      { id: 'opt_1', text: 'Option A', isCorrect: true },
      { id: 'opt_2', text: 'Option B', isCorrect: false },
      { id: 'opt_3', text: 'Option C', isCorrect: false },
      { id: 'opt_4', text: 'Option D', isCorrect: false },
    ];
    let initialCorrect = ['opt_1'];

    if (type === 'true_false') {
      initialOptions = [
        { id: 'opt_true', text: 'True', isCorrect: true },
        { id: 'opt_false', text: 'False', isCorrect: false },
      ];
      initialCorrect = ['opt_true'];
    } else if (type === 'short_text') {
      initialOptions = [];
      initialCorrect = [];
    }

    const newQuestion: Question = {
      id: newQId,
      sectionId: effectiveSecId,
      type,
      title: '',
      options: initialOptions,
      correctOptionIds: initialCorrect,
      marks: defaultPos,
      negativeMarks: defaultNeg,
      partialMarking: false,
      difficulty: 'medium',
      isRequired: false,
      explanation: '',
      shortTextAcceptedAnswers: type === 'short_text' ? [''] : undefined,
    };

    const updated = {
      ...assessment,
      sections: assessment.sections.map((s) => {
        if (s.id === effectiveSecId) {
          return { ...s, questions: [...s.questions, newQuestion] };
        }
        return s;
      }),
    };

    triggerAutosave(updated);
    setSelection({ type: 'question', sectionId: effectiveSecId, questionId: newQId });
  };

  const handleUpdateQuestion = (
    sectionId: string,
    questionId: string,
    partial: Partial<Question>
  ) => {
    if (!assessment) return;
    const updated = {
      ...assessment,
      sections: assessment.sections.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            questions: s.questions.map((q) => {
              if (q.id !== questionId) return q;
              const merged = { ...q, ...partial };
              if (Array.isArray(merged.options) && Array.isArray(merged.correctOptionIds)) {
                const correctSet = new Set(merged.correctOptionIds);
                merged.options = merged.options.map((opt) => ({
                  ...opt,
                  isCorrect: correctSet.has(opt.id),
                }));
              }
              return merged;
            }),
          };
        }
        return s;
      }),
    };
    triggerAutosave(updated);
  };

  const handleDeleteQuestion = (sectionId: string, questionId: string) => {
    if (!assessment) return;
    const updated = {
      ...assessment,
      sections: assessment.sections.map((s) => {
        if (s.id === sectionId) {
          return { ...s, questions: s.questions.filter((q) => q.id !== questionId) };
        }
        return s;
      }),
    };
    triggerAutosave(updated);
    setSelection({ type: 'section', sectionId });
  };

  const handleDuplicateQuestion = (sectionId: string, question: Question) => {
    if (!assessment) return;
    const duplicateQ: Question = {
      ...JSON.parse(JSON.stringify(question)),
      id: `q_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      title: `${question.title} (Copy)`,
    };
    const updated = {
      ...assessment,
      sections: assessment.sections.map((s) => {
        if (s.id === sectionId) {
          return { ...s, questions: [...s.questions, duplicateQ] };
        }
        return s;
      }),
    };
    triggerAutosave(updated);
    setSelection({ type: 'question', sectionId, questionId: duplicateQ.id });
  };

  const handleMoveQuestionReorder = (
    sectionId: string,
    questionIndex: number,
    direction: 'up' | 'down'
  ) => {
    if (!assessment) return;
    const sec = assessment.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const targetIdx = direction === 'up' ? questionIndex - 1 : questionIndex + 1;
    if (targetIdx < 0 || targetIdx >= sec.questions.length) return;

    const questionsCopy = [...sec.questions];
    const temp = questionsCopy[questionIndex];
    questionsCopy[questionIndex] = questionsCopy[targetIdx];
    questionsCopy[targetIdx] = temp;

    const updated = {
      ...assessment,
      sections: assessment.sections.map((s) =>
        s.id === sectionId ? { ...s, questions: questionsCopy } : s
      ),
    };
    triggerAutosave(updated);
  };

  const handleMoveQuestionToSection = (
    fromSectionId: string,
    toSectionId: string,
    questionId: string
  ) => {
    if (!assessment || fromSectionId === toSectionId) return;
    const sourceSec = assessment.sections.find((s) => s.id === fromSectionId);
    const q = sourceSec?.questions.find((item) => item.id === questionId);
    if (!q) return;

    const updated = {
      ...assessment,
      sections: assessment.sections.map((s) => {
        if (s.id === fromSectionId) {
          return { ...s, questions: s.questions.filter((item) => item.id !== questionId) };
        }
        if (s.id === toSectionId) {
          return { ...s, questions: [...s.questions, { ...q, sectionId: toSectionId }] };
        }
        return s;
      }),
    };
    triggerAutosave(updated);
    setSelection({ type: 'question', sectionId: toSectionId, questionId });
  };

  // Batch Apply Defaults across all questions
  const handleApplyDefaultsToAll = () => {
    if (!assessment) return;
    const defPos = Number(assessment.defaultMarks) || 4;
    const defNeg = Number(assessment.defaultNegativeMarks) || 1;

    const updated = {
      ...assessment,
      sections: assessment.sections.map((s) => ({
        ...s,
        questions: s.questions.map((q) => ({
          ...q,
          marks: defPos,
          negativeMarks: defNeg,
        })),
      })),
    };
    triggerAutosave(updated);
    setApplyDefaultsToast(`Applied +${defPos} marks / -${defNeg} negative marks to all questions!`);
    setTimeout(() => setApplyDefaultsToast(null), 3000);
  };

  // Helper to find currently selected question
  const activeQuestionData = useMemo<{ section: AssessmentSection; question: Question } | null>(() => {
    if (!assessment || selection.type !== 'question') return null;
    const sec = assessment.sections.find((s) => s.id === selection.sectionId);
    if (!sec) return null;
    const q = sec.questions.find((item) => item.id === selection.questionId);
    if (!q) return null;
    return { section: sec, question: q };
  }, [assessment, selection]);

  // Helper to find currently selected section
  const activeSectionData = useMemo(() => {
    if (!assessment || selection.type !== 'section') return null;
    return assessment.sections.find((s) => s.id === selection.sectionId);
  }, [assessment, selection]);

  if (!assessment) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 text-center">
        <WaitingAnimation
          size="md"
          label="ATTLIC • Loading Assessment Editor"
          sublabel="Synchronizing questions and appearance studio"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-slate-950 text-slate-100 -m-4 sm:-m-8">
      {/* ========================================================= */}
      {/* TOP HEADER: Toolbar, Autosave, Publish & Preview */}
      {/* ========================================================= */}
      <header className="h-14 border-b border-slate-800 bg-slate-950 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('assessments')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">My Assessments</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Assessment Title & Code */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={assessment.title}
              onChange={(e) => triggerAutosave({ ...assessment, title: e.target.value })}
              placeholder="Enter assessment title..."
              className="text-sm font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1 py-0.5 max-w-[200px] sm:max-w-xs md:max-w-md truncate transition"
            />
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300 font-semibold select-all hidden md:inline">
              {assessment.code}
            </span>
          </div>
        </div>

        {/* Center Header: Mode Switcher (Questions & Rules vs Appearance Studio) */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 shadow-inner">
          <button
            type="button"
            onClick={() => setEditorMode('content')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              editorMode === 'content'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Questions & Rules</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('appearance')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              editorMode === 'appearance'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Appearance Studio</span>
            {assessment.appearance?.theme && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950/90 text-indigo-200 border border-indigo-400/30 uppercase font-mono hidden sm:inline">
                {assessment.appearance.theme}
              </span>
            )}
          </button>
        </div>

        {/* Right Header: Autosave Button, Save Button, Test Hall & Publish */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Existing Autosave Button & Live Status */}
          <button
            type="button"
            onClick={() => {
              const nextState = !autosaveEnabled;
              setAutosaveEnabled(nextState);
              if (nextState && assessment) {
                handleSaveImmediate();
              }
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition ${
              autosaveState === 'error'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                : autosaveEnabled
                ? 'bg-slate-900 border-slate-800 text-emerald-400 hover:border-slate-700'
                : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={
              autosaveEnabled
                ? lastSavedTime
                  ? `Autosave is ON • Last saved at ${lastSavedTime.toLocaleTimeString()} (Click to toggle)`
                  : 'Autosave is ON (Click to toggle)'
                : 'Autosave is OFF • Click to enable automatic saving'
            }
          >
            {autosaveState === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>Autosaving...</span>
              </>
            ) : autosaveState === 'error' ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Autosave Failed</span>
              </>
            ) : autosaveEnabled ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Autosave: On
                  {lastSavedTime
                    ? ` • ${lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Autosave: Off</span>
              </>
            )}
          </button>

          {/* Explicit Save Button */}
          <button
            type="button"
            onClick={handleSaveImmediate}
            disabled={autosaveState === 'saving'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white transition shadow-sm disabled:opacity-60"
            title="Save assessment changes immediately"
          >
            <Save className="w-3.5 h-3.5 text-indigo-400" />
            <span>{autosaveState === 'saving' ? 'Saving...' : 'Save'}</span>
          </button>

          {/* Conflict & Version Tracker */}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hidden lg:inline">
            v{assessment.version || 1}
          </span>

          {/* Test Hall Sandbox Preview */}
          <button
            onClick={() => onOpenCandidatePortalWithCode(assessment.code)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 hover:text-white transition shadow-sm"
            title="Preview in candidate test hall"
          >
            <Play className="w-3.5 h-3.5 text-indigo-400 fill-current" />
            <span className="hidden sm:inline">Preview Test</span>
          </button>

          {/* Publish / Unpublish Action */}
          <button
            onClick={handlePublishToggle}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm ${
              assessment.status === 'published'
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            {assessment.status === 'published' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Published (Click to Draft)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Publish Assessment</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Defaults Toast Notification */}
      {applyDefaultsToast && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-200 text-xs px-4 py-2 flex items-center justify-between animate-fadeIn z-30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{applyDefaultsToast}</span>
          </div>
          <button onClick={() => setApplyDefaultsToast(null)} className="text-emerald-400 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* THREE-PART WORKSPACE CONTAINER OR APPEARANCE STUDIO       */}
      {/* ========================================================= */}
      {editorMode === 'appearance' ? (
        <div className="flex-1 overflow-y-auto">
          <AppearanceStudio
            assessment={assessment}
            onUpdateAssessment={triggerAutosave}
            onOpenCandidatePortalWithCode={onOpenCandidatePortalWithCode}
          />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* ======================================================= */}
          {/* PART 1: LEFT SIDEBAR (Overview, Sections & Questions)   */}
          {/* ======================================================= */}
          <aside className="w-72 sm:w-80 border-r border-slate-800/80 bg-slate-950 flex flex-col shrink-0 overflow-hidden">
            {/* Top Navigator: Assessment Overview Link & Appearance Studio Quick Link */}
            <div className="p-3 border-b border-slate-800/80 space-y-2">
              <button
                onClick={() => setSelection({ type: 'overview' })}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition ${
                  selection.type === 'overview'
                    ? 'bg-indigo-600/15 border-indigo-500/50 text-white'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold">Assessment Overview & Rules</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400">
                  Setup
                </span>
              </button>

              <button
                type="button"
                onClick={() => setEditorMode('appearance')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-indigo-500/25 bg-gradient-to-r from-indigo-950/40 to-slate-900/80 hover:from-indigo-950/60 hover:to-indigo-900/30 text-indigo-200 hover:border-indigo-500/50 text-xs font-medium transition group shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 group-hover:scale-105 transition-transform">
                    <Palette className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold block text-slate-100">Appearance Studio</span>
                    <span className="text-[10px] text-indigo-300/80 block">Themes, Colors & Live View</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Section & Question Tree (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="flex items-center justify-between text-[11px] uppercase font-bold text-slate-400 tracking-wider px-1">
              <span>Sections & Questions</span>
              <span className="font-mono text-indigo-400">
                {metrics.totalQuestions} Qs • {metrics.totalMarks} Marks
              </span>
            </div>

            {assessment.sections.map((sec, sIdx) => {
              const isSectionSelected =
                selection.type === 'section' && selection.sectionId === sec.id;
              const isCodingSec = isSectionCoding(sec);

              return (
                <div
                  key={sec.id}
                  className={`rounded-xl border overflow-hidden ${
                    isCodingSec
                      ? 'border-emerald-500/40 bg-emerald-950/15'
                      : 'border-slate-800/80 bg-slate-900/40'
                  }`}
                >
                  {/* Section Title Bar */}
                  <div
                    className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                      isSectionSelected
                        ? isCodingSec
                          ? 'bg-emerald-950/50 border-b border-emerald-500/40 text-white'
                          : 'bg-indigo-950/40 border-b border-indigo-500/30 text-white'
                        : 'hover:bg-slate-900/80 text-slate-200'
                    }`}
                    onClick={() => setSelection({ type: 'section', sectionId: sec.id })}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                      {isCodingSec ? (
                        <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      )}
                      <span className="text-xs font-bold truncate">
                        {sec.title || `Section ${sIdx + 1}`}
                      </span>
                      {isCodingSec && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold uppercase shrink-0">
                          Coding
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                        {sec.questions.length} Q
                      </span>
                      <button
                        onClick={() =>
                          handleAddQuestion(
                            sec.id,
                            isCodingSec ? 'coding_problem' : 'single_choice'
                          )
                        }
                        title={
                          isCodingSec
                            ? 'Add new coding question to this coding section'
                            : 'Add question to this section'
                        }
                        className={`p-1 rounded transition ${
                          isCodingSec
                            ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50'
                            : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSection(sec.id);
                        }}
                        title="Delete section"
                        aria-label={`Delete ${sec.title || `Section ${sIdx + 1}`}`}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Questions within this Section */}
                  <div className="p-1.5 space-y-1">
                    {sec.questions.length === 0 ? (
                      <div className="p-3 text-center text-[11px] text-slate-500">
                        No {isCodingSec ? 'coding ' : ''}questions in this section.{' '}
                        <button
                          onClick={() =>
                            handleAddQuestion(
                              sec.id,
                              isCodingSec ? 'coding_problem' : 'single_choice'
                            )
                          }
                          className={`${
                            isCodingSec ? 'text-emerald-400' : 'text-indigo-400'
                          } hover:underline font-semibold`}
                        >
                          Add one
                        </button>
                      </div>
                    ) : (
                      sec.questions.map((q, qIdx) => {
                        const isQuestionSelected =
                          selection.type === 'question' &&
                          selection.questionId === q.id &&
                          selection.sectionId === sec.id;

                        // Check validation status of question
                        const hasNoTitle = !q.title.trim();
                        const hasNoCorrect =
                          (q.type === 'single_choice' || q.type === 'true_false')
                            ? !q.correctOptionIds || q.correctOptionIds.length === 0
                            : q.type === 'multiple_choice'
                            ? !q.correctOptionIds || q.correctOptionIds.length === 0
                            : false;
                        const isQuestionIncomplete = hasNoTitle || hasNoCorrect;

                        return (
                          <div
                            key={q.id}
                            onClick={() =>
                              setSelection({
                                type: 'question',
                                sectionId: sec.id,
                                questionId: q.id,
                              })
                            }
                            className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-2 transition group ${
                              isQuestionSelected
                                ? isCodingSec
                                  ? 'bg-emerald-600/20 border-emerald-500/60 text-white'
                                  : 'bg-indigo-600/20 border-indigo-500/60 text-white'
                                : 'bg-slate-950/60 border-slate-800/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-mono text-[10px] text-slate-400 font-bold shrink-0">
                                {qIdx + 1}.
                              </span>
                              <span className="truncate text-xs">
                                {q.title.trim() || <em className="text-slate-500">Untitled Question</em>}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isQuestionIncomplete && (
                                <span
                                  title="Incomplete: missing title or correct answer key"
                                  className="text-amber-400"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <span className="font-mono text-[10px] text-emerald-400/90 font-semibold">
                                +{q.marks}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Dedicated Add New Coding Question button inside Coding Section */}
                    {isCodingSec && (
                      <button
                        type="button"
                        onClick={() => handleAddQuestion(sec.id, 'coding_problem')}
                        className="w-full mt-1 py-1.5 px-2.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add New Coding Question</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Left Sidebar Bottom Bar: Add Section & Add Question */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAddQuestion(undefined, 'single_choice')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
              <button
                onClick={handleAddSection}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Add Section</span>
              </button>
            </div>
            {isCodingActive && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAddQuestion(undefined, 'coding_problem')}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Coding Question</span>
                </button>
                <button
                  onClick={handleAddCodingSection}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold transition"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Add Coding Section</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ======================================================= */}
        {/* PART 2: MAIN EDITOR (Center Workspace)                  */}
        {/* ======================================================= */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* VIEW A: ASSESSMENT OVERVIEW & GLOBAL SETTINGS */}
            {selection.type === 'overview' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                    Global Assessment Settings
                  </span>
                  <h2 className="text-xl font-bold text-white">Assessment Information & Rules</h2>
                  <p className="text-xs text-slate-400">
                    Configure high-level metadata, durations, passing percentage, instructions, and scoring defaults.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-5">
                  {/* Title & Code */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Assessment Title <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={assessment.title}
                        onChange={(e) => triggerAutosave({ ...assessment, title: e.target.value })}
                        placeholder="e.g. Campus Placement 2026 - Core Software Engineering"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Access Test Code</label>
                      <input
                        type="text"
                        value={assessment.code}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
                          })
                        }
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-indigo-300 font-mono font-bold focus:outline-none focus:border-indigo-500 uppercase"
                      />
                    </div>
                  </div>

                  {/* Company Name & Category */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Company / Organization Name</span>
                      </label>
                      <input
                        type="text"
                        value={assessment.companyName || assessment.organizationName || ''}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            companyName: e.target.value,
                            organizationName: e.target.value,
                          })
                        }
                        placeholder="e.g. Acme Tech Labs Placement Drive"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Assessment Category / Tags</span>
                      </label>
                      <input
                        type="text"
                        value={(assessment.tags || []).join(', ')}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                          })
                        }
                        placeholder="e.g. Campus 2026, Computer Science, Aptitude"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Assessment Description</label>
                    <textarea
                      rows={3}
                      value={assessment.description || ''}
                      onChange={(e) => triggerAutosave({ ...assessment, description: e.target.value })}
                      placeholder="Explain the scope, eligibility criteria, and syllabus of this examination..."
                      className="w-full p-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Timing & Passing Percentage */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Total Duration (Minutes)</span>
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={360}
                        value={assessment.durationMinutes || 45}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            durationMinutes: Math.max(5, Number(e.target.value) || 45),
                          })
                        }
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Passing Threshold (%)</span>
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={100}
                        value={assessment.passingPercentage || 40}
                        onChange={(e) => {
                          const pct = Math.min(100, Math.max(10, Number(e.target.value) || 40));
                          const calculatedPassingMarks = Math.round((metrics.totalMarks * pct) / 100);
                          triggerAutosave({
                            ...assessment,
                            passingPercentage: pct,
                            passingMarks: calculatedPassingMarks,
                          });
                        }}
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Passing Cutoff Marks</label>
                      <div className="px-3.5 py-2 text-xs bg-slate-950/70 border border-slate-800/80 rounded-lg text-indigo-300 font-mono font-bold">
                        {assessment.passingMarks} / {metrics.totalMarks} marks
                      </div>
                    </div>
                  </div>

                  {/* Publish Immediate Results Toggle inside Details Card */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <label className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-slate-950 border border-indigo-500/30 cursor-pointer text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-white font-semibold">
                            Publish Immediate Results to Candidate
                          </strong>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              assessment.showImmediateResults !== false
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {assessment.showImmediateResults !== false ? 'Immediate Scorecard' : 'Withhold Results'}
                          </span>
                        </div>
                        <span className="text-slate-400 text-[11px] block leading-relaxed">
                          Allow the candidate to immediately view their score, percentage, and pass/fail status upon submission, or uncheck to withhold results for manual evaluation.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={assessment.showImmediateResults !== false}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            showImmediateResults: e.target.checked,
                          })
                        }
                        className="mt-1 accent-indigo-500 w-4 h-4 rounded shrink-0"
                      />
                    </label>
                  </div>

                  {/* Exclusive Scratch-Only Toggle: Coding Questions with Test Environment */}
                  {canUseCodingEnvironment && (
                    <div className="pt-3 border-t border-slate-800/80">
                      <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
                        <label className="flex items-start justify-between gap-4 cursor-pointer text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Code2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <strong className="text-white font-semibold">
                                I want to add coding questions with test environment
                              </strong>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  assessment.enableCodingEnvironment
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {assessment.enableCodingEnvironment
                                  ? 'Coding IDE Active'
                                  : 'Disabled'}
                              </span>
                            </div>
                            <span className="text-slate-400 text-[11px] block leading-relaxed">
                              Enables in-built multi-language coding IDE (Python 3, C, C++, Java, JavaScript) with starter code templates, sample test cases, and hidden grading test cases.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(assessment.enableCodingEnvironment)}
                            onChange={(e) => {
                              const nextChecked = e.target.checked;
                              let nextSections = [...assessment.sections];
                              if (nextChecked && !nextSections.some((s) => isSectionCoding(s))) {
                                const newSecNum = nextSections.length + 1;
                                const newSecId = `sec_code_${Date.now()}`;
                                const newQId = `q_code_${Date.now()}`;
                                nextSections.push({
                                  id: newSecId,
                                  title: `Section ${newSecNum}: Hands-On Coding Challenges`,
                                  description:
                                    'Multi-language coding problems evaluated against sample and hidden test cases',
                                  order: newSecNum,
                                  isCodingSection: true,
                                  questions: [
                                    {
                                      id: newQId,
                                      sectionId: newSecId,
                                      type: 'coding_problem',
                                      title:
                                        'Sum of Array Elements: Given an integer N followed by N space-separated integers, compute and print the total sum of all N elements.',
                                      options: [],
                                      correctOptionIds: [],
                                      marks: 20,
                                      negativeMarks: 0,
                                      partialMarking: true,
                                      difficulty: 'medium',
                                      isRequired: true,
                                      explanation:
                                        'Read N and accumulate all N integers using 64-bit integer arithmetic.',
                                      codingConfig: getDefaultCodingConfig(),
                                    },
                                  ],
                                });
                              }
                              triggerAutosave({
                                ...assessment,
                                enableCodingEnvironment: nextChecked,
                                sections: nextSections,
                              });
                            }}
                            className="mt-1 accent-indigo-500 w-4 h-4 rounded shrink-0"
                          />
                        </label>
                        {assessment.enableCodingEnvironment && (
                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                            <span className="text-emerald-300 font-medium">
                              Dedicated Coding Section Active • Python 3, C, C++17, Java, Node.js
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddQuestion(undefined, 'coding_problem')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add New Coding Question</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Question & Option Randomization (General Tab) */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Shuffle className="w-4 h-4 text-indigo-400" />
                          <span>Question &amp; Option Randomization (Anti-Collusion)</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Deterministically shuffles question order within each section and/or MCQ option order per candidate while preserving answer keys.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/40 text-xs">
                          <div>
                            <strong className="text-white block font-semibold">
                              Shuffle Question Order per Candidate
                            </strong>
                            <span className="text-[10px] text-slate-400">
                              Each student receives a unique question sequence
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(assessment.shuffleQuestions)}
                            onChange={(e) =>
                              triggerAutosave({
                                ...assessment,
                                shuffleQuestions: e.target.checked,
                              })
                            }
                            className="accent-indigo-500 w-4 h-4 rounded shrink-0"
                          />
                        </label>

                        <label className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/40 text-xs">
                          <div>
                            <strong className="text-white block font-semibold">
                              Shuffle MCQ Options per Candidate
                            </strong>
                            <span className="text-[10px] text-slate-400">
                              Randomizes A/B/C/D options per candidate
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(assessment.shuffleOptions)}
                            onChange={(e) =>
                              triggerAutosave({
                                ...assessment,
                                shuffleOptions: e.target.checked,
                              })
                            }
                            className="accent-indigo-500 w-4 h-4 rounded shrink-0"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Exam Window & Email Whitelist (General Tab) */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-indigo-400" />
                          <span>Scheduled Exam Window &amp; Email Domain Whitelist (Optional)</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Enforce start/end launch timestamps and restrict test entry to authorized college email domains.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            Start Date &amp; Time
                          </label>
                          <input
                            type="datetime-local"
                            value={assessment.scheduledStartAt || ''}
                            onChange={(e) =>
                              triggerAutosave({
                                ...assessment,
                                scheduledStartAt: e.target.value || undefined,
                              })
                            }
                            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            End Date &amp; Time
                          </label>
                          <input
                            type="datetime-local"
                            value={assessment.scheduledEndAt || ''}
                            onChange={(e) =>
                              triggerAutosave({
                                ...assessment,
                                scheduledEndAt: e.target.value || undefined,
                              })
                            }
                            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            Allowed Email Domains
                          </label>
                          <input
                            type="text"
                            value={(assessment.allowedEmailDomains || []).join(', ')}
                            onChange={(e) => {
                              const domains = e.target.value
                                .split(',')
                                .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
                                .filter(Boolean);
                              triggerAutosave({
                                ...assessment,
                                allowedEmailDomains: domains.length > 0 ? domains : undefined,
                              });
                            }}
                            placeholder="e.g. iitd.ac.in, nit.edu"
                            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Candidate 1-Snapshot Verification & PDF Certificate Option */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <label className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-950 border border-indigo-500/30 cursor-pointer text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-indigo-400 shrink-0" />
                          <strong className="text-white font-semibold">
                            Capture 1 Candidate Verification Snapshot &amp; Attach to PDF Certificate
                          </strong>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              assessment.requireCandidateSnapshot
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {assessment.requireCandidateSnapshot ? 'Snapshot Enabled' : 'Optional (Off)'}
                          </span>
                        </div>
                        <span className="text-slate-400 text-[11px] block leading-relaxed">
                          Give candidates a 1-click snapshot capture during registration and automatically embed their photo inside the downloadable PDF Verification Certificate &amp; Scorecard.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(assessment.requireCandidateSnapshot)}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            requireCandidateSnapshot: e.target.checked,
                          })
                        }
                        className="mt-1 accent-indigo-500 w-4 h-4 rounded shrink-0"
                      />
                    </label>
                  </div>
                </div>

                {/* Batch Scoring Defaults */}
                <div className="rounded-2xl bg-indigo-950/20 border border-indigo-500/30 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span>Default Question Scores & Bulk Apply</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Set default scores for new questions or instantly apply across all existing questions.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyDefaultsToAll}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm"
                    >
                      Apply to All Questions
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Default Positive Marks</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={assessment.defaultMarks || 4}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            defaultMarks: Number(e.target.value) || 4,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Default Negative Marks</label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={assessment.defaultNegativeMarks || 1}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            defaultNegativeMarks: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Candidate Instructions Editor */}
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Examination Instructions
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Shown to candidates on the pre-exam launch screen.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextInst = [...(assessment.instructions || []), 'New test rule or requirement.'];
                        triggerAutosave({ ...assessment, instructions: nextInst });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Rule</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(assessment.instructions || []).map((inst, iIdx) => (
                      <div key={iIdx} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-indigo-400 font-bold">•</span>
                        <input
                          type="text"
                          value={inst}
                          onChange={(e) => {
                            const copy = [...assessment.instructions];
                            copy[iIdx] = e.target.value;
                            triggerAutosave({ ...assessment, instructions: copy });
                          }}
                          className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const copy = assessment.instructions.filter((_, idx) => idx !== iIdx);
                            triggerAutosave({ ...assessment, instructions: copy });
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Anti-Cheating & Proctoring Rules */}
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-indigo-400" />
                    <span>Anti-Cheating & Proctoring Protocol</span>
                  </h4>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={assessment.antiCheating?.forceFullscreen ?? true}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            antiCheating: {
                              ...assessment.antiCheating,
                              forceFullscreen: e.target.checked,
                              enforceFullscreen: e.target.checked,
                            },
                          })
                        }
                        className="mt-0.5 accent-indigo-500 w-4 h-4 rounded"
                      />
                      <div>
                        <strong className="text-white block font-medium">Force Fullscreen Mode (F11)</strong>
                        <span className="text-slate-400 text-[11px]">
                          Candidate must enter true fullscreen. Exiting fullscreen will lock their exam until they re-enter.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={assessment.antiCheating?.trackTabSwitches ?? true}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            antiCheating: {
                              ...assessment.antiCheating,
                              trackTabSwitches: e.target.checked,
                            },
                          })
                        }
                        className="mt-0.5 accent-indigo-500 w-4 h-4 rounded"
                      />
                      <div>
                        <strong className="text-white block font-medium">Track Window Blur & Tab Switching</strong>
                        <span className="text-slate-400 text-[11px]">
                          Flag and log when candidate switches browser tabs or minimizes the window.
                        </span>
                      </div>
                    </label>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-white block font-medium">
                          Violation Threshold (Max Tab Switches Allowed)
                        </strong>
                        <span className="text-slate-400 text-[11px]">
                          Number of tab-switch / focus-loss violations permitted before threshold penalty triggers.
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={assessment.antiCheating?.maxTabSwitches ?? 3}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            antiCheating: {
                              ...assessment.antiCheating,
                              maxTabSwitches: Math.max(1, Number(e.target.value) || 3),
                            },
                          })
                        }
                        className="w-16 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-center text-xs text-indigo-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-rose-500/30 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={assessment.antiCheating?.enableTwoMinuteViolationBlock ?? true}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            antiCheating: {
                              ...assessment.antiCheating,
                              enableTwoMinuteViolationBlock: e.target.checked,
                            },
                          })
                        }
                        className="mt-0.5 accent-indigo-500 w-4 h-4 rounded"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-white block font-medium">
                            2-Minute Block if More Than Threshold Violation Found
                          </strong>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            02:00 Penalty Lockout
                          </span>
                        </div>
                        <span className="text-slate-400 text-[11px] block mt-0.5 leading-relaxed">
                          Automatically locks the candidate's exam screen with a mandatory 2-minute (120s) penalty countdown timer if violations reach or exceed the allowed threshold ({assessment.antiCheating?.maxTabSwitches ?? 3} violations).
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={assessment.antiCheating?.blockCopyPaste ?? true}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            antiCheating: {
                              ...assessment.antiCheating,
                              blockCopyPaste: e.target.checked,
                            },
                          })
                        }
                        className="mt-0.5 accent-indigo-500 w-4 h-4 rounded"
                      />
                      <div>
                        <strong className="text-white block font-medium">Block Copy & Paste</strong>
                        <span className="text-slate-400 text-[11px]">
                          Disables context menu copy, paste, and text selection during the exam.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-indigo-500/30 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={assessment.showImmediateResults !== false}
                        onChange={(e) =>
                          triggerAutosave({
                            ...assessment,
                            showImmediateResults: e.target.checked,
                          })
                        }
                        className="mt-0.5 accent-indigo-500 w-4 h-4 rounded"
                      />
                      <div>
                        <strong className="text-white block font-medium">
                          Publish Immediate Results to Candidates on Submission
                        </strong>
                        <span className="text-slate-400 text-[11px]">
                          When enabled, candidates see their score, percentage, and pass/fail status immediately after submitting. Uncheck to withhold scores for manual recruiter evaluation.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW B: SECTION CONFIGURATION */}
            {selection.type === 'section' && activeSectionData && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                    Section Configuration
                  </span>
                  <h2 className="text-xl font-bold text-white">{activeSectionData.title}</h2>
                  <p className="text-xs text-slate-400">
                    Configure section title, description, and independent section duration.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Section Title</label>
                    <input
                      type="text"
                      value={activeSectionData.title}
                      onChange={(e) =>
                        handleUpdateSection(activeSectionData.id, { title: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-semibold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Section Description</label>
                    <textarea
                      rows={2}
                      value={activeSectionData.description || ''}
                      onChange={(e) =>
                        handleUpdateSection(activeSectionData.id, { description: e.target.value })
                      }
                      placeholder="Guidance or instructions specific to this section..."
                      className="w-full p-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Section Duration (Minutes, Optional)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={180}
                        value={activeSectionData.durationMinutes || ''}
                        onChange={(e) =>
                          handleUpdateSection(activeSectionData.id, {
                            durationMinutes: Number(e.target.value) || undefined,
                          })
                        }
                        placeholder="Leave blank for shared timer"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Section Summary</label>
                      <div className="px-3.5 py-2 text-xs bg-slate-950/70 border border-slate-800/80 rounded-lg text-slate-300 font-mono">
                        {activeSectionData.questions.length} questions •{' '}
                        {activeSectionData.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)}{' '}
                        total marks
                      </div>
                    </div>
                  </div>

                  {/* Section Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <button
                      onClick={() =>
                        handleAddQuestion(
                          activeSectionData.id,
                          isSectionCoding(activeSectionData) ? 'coding_problem' : 'single_choice'
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition ${
                        isSectionCoding(activeSectionData)
                          ? 'bg-emerald-600 hover:bg-emerald-500'
                          : 'bg-indigo-600 hover:bg-indigo-500'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {isSectionCoding(activeSectionData)
                          ? 'Add New Coding Question to this Coding Section'
                          : 'Add Question to this Section'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSection(activeSectionData.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Section</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW C: QUESTION EDITOR */}
            {selection.type === 'question' && activeQuestionData?.question && (
              <div className="space-y-5 animate-fadeIn">
                {/* Question Location & Type Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider ${
                          isSectionCoding(activeQuestionData.section)
                            ? 'text-emerald-400'
                            : 'text-indigo-400'
                        }`}
                      >
                        {activeQuestionData.section?.title}
                      </span>
                      {activeQuestionData.section && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(activeQuestionData.section!.id)}
                          title="Delete this entire section"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-[10px] font-semibold transition"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                          <span>Delete Section</span>
                        </button>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>
                        {activeQuestionData.question.type === 'coding_problem'
                          ? 'Editing Coding Question'
                          : 'Editing Question'}
                      </span>
                      <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                        +{activeQuestionData.question.marks} / -{activeQuestionData.question.negativeMarks}
                      </span>
                    </h2>
                  </div>

                  {/* Question Type Pills (Separate Coding Section vs Regular Section) */}
                  {isSectionCoding(activeQuestionData.section) ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Coding Challenge (IDE + Test Cases)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleAddQuestion(activeQuestionData.section!.id, 'coding_problem')
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Coding Question</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                      {(
                        [
                          { type: 'single_choice' as const, label: 'Single MCQ' },
                          { type: 'multiple_choice' as const, label: 'Multi MCQ' },
                          { type: 'true_false' as const, label: 'True / False' },
                          { type: 'short_text' as const, label: 'Short Text' },
                        ]
                      ).map((t) => {
                        const isCurrent = activeQuestionData.question.type === t.type;
                        return (
                          <button
                            key={t.type}
                            type="button"
                            onClick={() => {
                              let newOptions = activeQuestionData.question.options;
                              let newCorrect = activeQuestionData.question.correctOptionIds;

                              if (t.type === 'true_false') {
                                newOptions = [
                                  { id: 'opt_true', text: 'True' },
                                  { id: 'opt_false', text: 'False' },
                                ];
                                newCorrect = ['opt_true'];
                              } else if (t.type === 'short_text') {
                                newOptions = [];
                                newCorrect = [];
                              } else if (newOptions.length === 0) {
                                newOptions = [
                                  { id: 'opt_1', text: 'Option A' },
                                  { id: 'opt_2', text: 'Option B' },
                                  { id: 'opt_3', text: 'Option C' },
                                  { id: 'opt_4', text: 'Option D' },
                                ];
                                newCorrect = ['opt_1'];
                              }

                              handleUpdateQuestion(
                                activeQuestionData.section!.id,
                                activeQuestionData.question.id,
                                {
                                  type: t.type,
                                  options: newOptions,
                                  correctOptionIds: newCorrect,
                                  shortTextAcceptedAnswers:
                                    t.type === 'short_text'
                                      ? activeQuestionData.question.shortTextAcceptedAnswers || ['']
                                      : undefined,
                                }
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                              isCurrent
                                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Question Textarea */}
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Question Text</span>
                      {!activeQuestionData.question.title.trim() && (
                        <span className="text-[11px] text-amber-400 font-normal">
                          * Question text cannot be empty
                        </span>
                      )}
                    </label>
                    <textarea
                      rows={3}
                      value={activeQuestionData.question.title}
                      onChange={(e) =>
                        handleUpdateQuestion(
                          activeQuestionData.section!.id,
                          activeQuestionData.question.id,
                          { title: e.target.value }
                        )
                      }
                      placeholder="Type the examination problem statement, code challenge, or question..."
                      className="w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                    />
                  </div>

                  {/* Question Explanation */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Explanation / Solution Hint (Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={activeQuestionData.question.explanation || ''}
                      onChange={(e) =>
                        handleUpdateQuestion(
                          activeQuestionData.section!.id,
                          activeQuestionData.question.id,
                          { explanation: e.target.value }
                        )
                      }
                      placeholder="Provide reasoning or derivation shown to candidates during post-exam review..."
                      className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Options / Answer Configuration Area */}
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        {activeQuestionData.question.type === 'short_text'
                          ? 'Accepted Correct Answers'
                          : 'Answer Options & Correct Key'}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {activeQuestionData.question.type === 'single_choice' &&
                          'Select the radio button on the single correct answer.'}
                        {activeQuestionData.question.type === 'multiple_choice' &&
                          'Check the boxes for all correct answers. Partial marking is supported.'}
                        {activeQuestionData.question.type === 'true_false' &&
                          'Select whether True or False is the correct answer.'}
                        {activeQuestionData.question.type === 'short_text' &&
                          'Enter one or more acceptable answers (evaluated case-insensitively).'}
                      </p>
                    </div>

                    {/* Add Option button for MCQ */}
                    {(activeQuestionData.question.type === 'single_choice' ||
                      activeQuestionData.question.type === 'multiple_choice') && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOptId = `opt_${Date.now()}_${activeQuestionData.question.options.length + 1}`;
                          const newOpt: QuestionOption = {
                            id: newOptId,
                            text: `Option ${String.fromCharCode(65 + activeQuestionData.question.options.length)}`,
                          };
                          handleUpdateQuestion(
                            activeQuestionData.section!.id,
                            activeQuestionData.question.id,
                            {
                              options: [...activeQuestionData.question.options, newOpt],
                            }
                          );
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-semibold transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Option</span>
                      </button>
                    )}
                  </div>

                  {/* MCQ Options Rendering */}
                  {(activeQuestionData.question.type === 'single_choice' ||
                    activeQuestionData.question.type === 'multiple_choice') && (
                    <div className="space-y-2.5">
                      {activeQuestionData.question.options.map((opt, oIdx) => {
                        const isCorrect = (activeQuestionData.question.correctOptionIds || []).includes(
                          opt.id
                        );
                        const isMulti = activeQuestionData.question.type === 'multiple_choice';

                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                              isCorrect
                                ? 'bg-indigo-950/30 border-indigo-500/50'
                                : 'bg-slate-950/70 border-slate-800'
                            }`}
                          >
                            {/* Correct Key Selector (Radio for single, Checkbox for multi) */}
                            <button
                              type="button"
                              title={isCorrect ? 'Correct option' : 'Click to mark as correct'}
                              onClick={() => {
                                let nextCorrect: string[] = [];
                                if (isMulti) {
                                  nextCorrect = isCorrect
                                    ? activeQuestionData.question.correctOptionIds.filter((id) => id !== opt.id)
                                    : [...activeQuestionData.question.correctOptionIds, opt.id];
                                } else {
                                  nextCorrect = [opt.id];
                                }
                                handleUpdateQuestion(
                                  activeQuestionData.section!.id,
                                  activeQuestionData.question.id,
                                  { correctOptionIds: nextCorrect }
                                );
                              }}
                              className={`w-6 h-6 rounded-${isMulti ? 'md' : 'full'} border flex items-center justify-center shrink-0 transition ${
                                isCorrect
                                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-xs'
                                  : 'bg-slate-900 border-slate-700 text-transparent hover:border-slate-500'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>

                            <span className="font-mono text-xs font-bold text-slate-400 w-5">
                              {String.fromCharCode(65 + oIdx)}.
                            </span>

                            {/* Option Text Input */}
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => {
                                const newOpts = activeQuestionData.question.options.map((o) =>
                                  o.id === opt.id ? { ...o, text: e.target.value } : o
                                );
                                handleUpdateQuestion(
                                  activeQuestionData.section!.id,
                                  activeQuestionData.question.id,
                                  { options: newOpts }
                                );
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + oIdx)} text...`}
                              className="flex-1 bg-transparent border-0 text-xs text-white focus:outline-none placeholder-slate-600"
                            />

                            {/* Delete Option (minimum 2 options) */}
                            {activeQuestionData.question.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOpts = activeQuestionData.question.options.filter(
                                    (o) => o.id !== opt.id
                                  );
                                  const nextCorrect = activeQuestionData.question.correctOptionIds.filter(
                                    (id) => id !== opt.id
                                  );
                                  handleUpdateQuestion(
                                    activeQuestionData.section!.id,
                                    activeQuestionData.question.id,
                                    {
                                      options: newOpts,
                                      correctOptionIds: nextCorrect,
                                    }
                                  );
                                }}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* True / False Rendering */}
                  {activeQuestionData.question.type === 'true_false' && (
                    <div className="grid grid-cols-2 gap-4">
                      {['opt_true', 'opt_false'].map((key) => {
                        const label = key === 'opt_true' ? 'True' : 'False';
                        const isCorrect = (activeQuestionData.question.correctOptionIds || []).includes(key);

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              handleUpdateQuestion(
                                activeQuestionData.section!.id,
                                activeQuestionData.question.id,
                                {
                                  options: [
                                    { id: 'opt_true', text: 'True' },
                                    { id: 'opt_false', text: 'False' },
                                  ],
                                  correctOptionIds: [key],
                                }
                              );
                            }}
                            className={`p-4 rounded-xl border text-center transition flex flex-col items-center justify-center gap-2 ${
                              isCorrect
                                ? 'bg-emerald-950/30 border-emerald-500/60 text-white shadow-xs'
                                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span className="text-sm font-bold">{label}</span>
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                isCorrect
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'text-slate-500'
                              }`}
                            >
                              {isCorrect ? 'Correct Answer' : 'Incorrect'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Short-Text Accepted Answers Rendering */}
                  {activeQuestionData.question.type === 'short_text' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {(activeQuestionData.question.shortTextAcceptedAnswers || ['']).map(
                          (ans, aIdx) => (
                            <div key={aIdx} className="flex items-center gap-2">
                              <span className="font-mono text-xs text-indigo-400 font-bold">
                                {aIdx + 1}.
                              </span>
                              <input
                                type="text"
                                value={ans}
                                onChange={(e) => {
                                  const copy = [
                                    ...(activeQuestionData.question.shortTextAcceptedAnswers || ['']),
                                  ];
                                  copy[aIdx] = e.target.value;
                                  handleUpdateQuestion(
                                    activeQuestionData.section!.id,
                                    activeQuestionData.question.id,
                                    { shortTextAcceptedAnswers: copy }
                                  );
                                }}
                                placeholder="e.g. quicksort, O(n log n), binary search..."
                                className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                              />
                              {(activeQuestionData.question.shortTextAcceptedAnswers || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = (
                                      activeQuestionData.question.shortTextAcceptedAnswers || []
                                    ).filter((_, idx) => idx !== aIdx);
                                    handleUpdateQuestion(
                                      activeQuestionData.section!.id,
                                      activeQuestionData.question.id,
                                      { shortTextAcceptedAnswers: copy }
                                    );
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-rose-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )
                        )}
                      </div>

                       <button
                        type="button"
                        onClick={() => {
                          const copy = [
                            ...(activeQuestionData.question.shortTextAcceptedAnswers || []),
                            '',
                          ];
                          handleUpdateQuestion(
                            activeQuestionData.section!.id,
                            activeQuestionData.question.id,
                            { shortTextAcceptedAnswers: copy }
                          );
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Alternate Accepted Answer</span>
                      </button>
                    </div>
                  )}

                  {/* Simplified Coding Question Editor with Real Monaco IDE */}
                  {activeQuestionData.question.type === 'coding_problem' && isCodingActive && (() => {
                    const cfg: CodingProblemConfig =
                      activeQuestionData.question.codingConfig || getDefaultCodingConfig();
                    const updateCfg = (partialCfg: Partial<CodingProblemConfig>) => {
                      handleUpdateQuestion(
                        activeQuestionData.section!.id,
                        activeQuestionData.question.id,
                        {
                          codingConfig: {
                            ...cfg,
                            ...partialCfg,
                          },
                        }
                      );
                    };

                    return (
                      <div className="space-y-4 pt-2">
                        {/* 1. Compact Language Selector & Default Language */}
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Terminal className="w-4 h-4 text-emerald-400" />
                              <span className="text-xs font-bold text-white">
                                Coding Environment Setup
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] text-slate-400">Default IDE Language:</label>
                              <select
                                value={cfg.defaultLanguage}
                                onChange={(e) => {
                                  const nextDefault = e.target.value as CodingLanguage;
                                  updateCfg({ defaultLanguage: nextDefault });
                                  setActiveStarterLangTab(nextDefault);
                                }}
                                className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-emerald-300 font-semibold"
                              >
                                {SUPPORTED_CODING_LANGUAGES.filter((l) =>
                                  cfg.allowedLanguages.includes(l.id)
                                ).map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {SUPPORTED_CODING_LANGUAGES.map((lang) => {
                                const checked = cfg.allowedLanguages.includes(lang.id);
                                return (
                                  <label
                                    key={lang.id}
                                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer flex items-center gap-1.5 transition ${
                                      checked
                                        ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                                        : 'bg-slate-900 border-slate-800 text-slate-400'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const nextLangs = e.target.checked
                                          ? [...cfg.allowedLanguages, lang.id]
                                          : cfg.allowedLanguages.filter((l) => l !== lang.id);
                                        if (nextLangs.length === 0) return;
                                        updateCfg({
                                          allowedLanguages: nextLangs,
                                          defaultLanguage: nextLangs.includes(cfg.defaultLanguage)
                                            ? cfg.defaultLanguage
                                            : nextLangs[0],
                                        });
                                      }}
                                      className="accent-indigo-500"
                                    />
                                    <span>{lang.label}</span>
                                  </label>
                                );
                              })}
                            </div>

                            {/* Collapsible Optional Problem Specs (Input/Output/Constraints/Limits) */}
                            <details className="w-full pt-1">
                              <summary className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer select-none">
                                Optional: Input / Output Format, Constraints &amp; Time Limit ({cfg.timeLimitSeconds || 2}s)
                              </summary>
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2.5">
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400">Input Format</label>
                                  <input
                                    type="text"
                                    value={cfg.inputFormat || ''}
                                    onChange={(e) => updateCfg({ inputFormat: e.target.value })}
                                    placeholder="e.g. First line N, second line N integers"
                                    className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400">Output Format</label>
                                  <input
                                    type="text"
                                    value={cfg.outputFormat || ''}
                                    onChange={(e) => updateCfg({ outputFormat: e.target.value })}
                                    placeholder="e.g. Print the sum"
                                    className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400">Constraints</label>
                                  <input
                                    type="text"
                                    value={cfg.constraints || ''}
                                    onChange={(e) => updateCfg({ constraints: e.target.value })}
                                    placeholder="e.g. 1 <= N <= 10^5"
                                    className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400">Time Limit (s)</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={15}
                                    value={cfg.timeLimitSeconds || 2}
                                    onChange={(e) =>
                                      updateCfg({
                                        timeLimitSeconds: Math.max(1, Number(e.target.value) || 2),
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 font-mono font-bold"
                                  />
                                </div>
                              </div>
                            </details>
                          </div>
                        </div>

                        {/* 2. Starter Code Template inside Real Monaco Editor (Headers Always Pre-Included) */}
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h5 className="text-xs font-bold text-white flex items-center gap-2">
                                <span>Starter Code Template ({activeStarterLangTab.toUpperCase()})</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                                  Standard Headers Pre-Included
                                </span>
                              </h5>
                              <p className="text-[11px] text-slate-400">
                                Students automatically start with `#include &lt;stdio.h&gt;` / imports &amp; `main()` ready to code.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateCfg({
                                    starterCode: {
                                      ...(cfg.starterCode || getDefaultCodingConfig().starterCode),
                                      [activeStarterLangTab]: getCleanBoilerplateCode(activeStarterLangTab),
                                    },
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-semibold transition"
                              >
                                Reset to Clean Boilerplate (Headers Only)
                              </button>
                              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                                {SUPPORTED_CODING_LANGUAGES.map((lang) => (
                                  <button
                                    key={lang.id}
                                    type="button"
                                    onClick={() => setActiveStarterLangTab(lang.id)}
                                    className={`px-2 py-1 rounded text-[11px] font-mono transition ${
                                      activeStarterLangTab === lang.id
                                        ? 'bg-indigo-600 text-white font-bold'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    {lang.monacoId.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl overflow-hidden border border-slate-800">
                            <MonacoCodeEditor
                              language={activeStarterLangTab}
                              value={
                                cfg.starterCode?.[activeStarterLangTab] ??
                                getDefaultStarterCode(activeStarterLangTab)
                              }
                              onChange={(nextVal) =>
                                updateCfg({
                                  starterCode: {
                                    ...(cfg.starterCode || getDefaultCodingConfig().starterCode),
                                    [activeStarterLangTab]: nextVal,
                                  },
                                })
                              }
                              height="210px"
                              compact
                              showQuickSnippets={false}
                            />
                          </div>
                        </div>

                        {/* 3. Streamlined Automated Test Cases */}
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="text-xs font-bold text-white">
                                Evaluation Test Cases ({cfg.testCases.length})
                              </h5>
                              <p className="text-[11px] text-slate-400">
                                Input (`stdin`) passed to student code → Expected Output (`stdout`) compared automatically.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newTc: CodingTestCase = {
                                  id: `tc_${Date.now()}`,
                                  input: '3\n10 20 30',
                                  expectedOutput: '60',
                                  isSample: false,
                                  explanation: 'Custom test case',
                                };
                                updateCfg({ testCases: [...cfg.testCases, newTc] });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Test Case</span>
                            </button>
                          </div>

                          <div className="space-y-2.5">
                            {cfg.testCases.map((tc, tcIdx) => (
                              <div
                                key={tc.id}
                                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-indigo-400">
                                      Test Case #{tcIdx + 1}
                                    </span>
                                    <label className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 cursor-pointer text-[11px]">
                                      <input
                                        type="checkbox"
                                        checked={tc.isSample}
                                        onChange={(e) => {
                                          const nextTcs = cfg.testCases.map((item, idx) =>
                                            idx === tcIdx
                                              ? { ...item, isSample: e.target.checked }
                                              : item
                                          );
                                          updateCfg({ testCases: nextTcs });
                                        }}
                                        className="accent-indigo-500"
                                      />
                                      <span
                                        className={
                                          tc.isSample
                                            ? 'text-emerald-300 font-semibold'
                                            : 'text-amber-300 font-semibold'
                                        }
                                      >
                                        {tc.isSample ? 'Public Sample' : 'Hidden Grading'}
                                      </span>
                                    </label>
                                  </div>

                                  {cfg.testCases.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextTcs = cfg.testCases.filter(
                                          (_, idx) => idx !== tcIdx
                                        );
                                        updateCfg({ testCases: nextTcs });
                                      }}
                                      className="text-slate-500 hover:text-rose-400 p-1"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                      Input (stdin)
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={tc.input}
                                      onChange={(e) => {
                                        const nextTcs = cfg.testCases.map((item, idx) =>
                                          idx === tcIdx ? { ...item, input: e.target.value } : item
                                        );
                                        updateCfg({ testCases: nextTcs });
                                      }}
                                      placeholder="e.g. 5\n1 2 3 4 5"
                                      className="w-full p-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                      Expected Output (stdout) *
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={tc.expectedOutput}
                                      onChange={(e) => {
                                        const nextTcs = cfg.testCases.map((item, idx) =>
                                          idx === tcIdx
                                            ? { ...item, expectedOutput: e.target.value }
                                            : item
                                        );
                                        updateCfg({ testCases: nextTcs });
                                      }}
                                      placeholder="e.g. 15"
                                      className="w-full p-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-emerald-300"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Question Action Bar: Reorder, Move Section, Duplicate, Delete */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    {/* Move to another section */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium text-[11px]">Move to Section:</span>
                      <select
                        value={activeQuestionData.section?.id}
                        onChange={(e) =>
                          handleMoveQuestionToSection(
                            activeQuestionData.section!.id,
                            e.target.value,
                            activeQuestionData.question.id
                          )
                        }
                        className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
                      >
                        {assessment.sections.map((s, idx) => (
                          <option key={s.id} value={s.id}>
                            {s.title || `Section ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Reorder Up / Down */}
                    <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          const qIdx = activeQuestionData.section!.questions.findIndex(
                            (item) => item.id === activeQuestionData.question.id
                          );
                          handleMoveQuestionReorder(activeQuestionData.section!.id, qIdx, 'up');
                        }}
                        title="Move question up"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const qIdx = activeQuestionData.section!.questions.findIndex(
                            (item) => item.id === activeQuestionData.question.id
                          );
                          handleMoveQuestionReorder(activeQuestionData.section!.id, qIdx, 'down');
                        }}
                        title="Move question down"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSectionCoding(activeQuestionData.section) && (
                      <button
                        type="button"
                        onClick={() =>
                          handleAddQuestion(activeQuestionData.section!.id, 'coding_problem')
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Coding Question</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        handleDuplicateQuestion(
                          activeQuestionData.section!.id,
                          activeQuestionData.question
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteQuestion(
                          activeQuestionData.section!.id,
                          activeQuestionData.question.id
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 font-semibold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ======================================================= */}
        {/* PART 3: RIGHT SIDEBAR (Contextual Settings & Scores)    */}
        {/* ======================================================= */}
        <aside className="w-72 sm:w-80 border-l border-slate-800/80 bg-slate-950 flex flex-col shrink-0 overflow-y-auto p-4 space-y-6">
          {/* CONTEXTUAL ITEM INSPECTOR */}
          {selection.type === 'question' && activeQuestionData?.question ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  Question Settings
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-900 text-indigo-400 border border-slate-800">
                  {activeQuestionData.question.type.replace('_', ' ')}
                </span>
              </div>

              {/* Scoring: Positive & Negative Marks */}
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Scoring Configuration</span>
                </h5>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Positive Marks</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={activeQuestionData.question.marks}
                      onChange={(e) =>
                        handleUpdateQuestion(
                          activeQuestionData.section!.id,
                          activeQuestionData.question.id,
                          { marks: Math.max(1, Number(e.target.value) || 1) }
                        )
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Negative Marks</label>
                    <input
                      type="number"
                      min={0}
                      max={activeQuestionData.question.marks}
                      value={activeQuestionData.question.negativeMarks}
                      onChange={(e) =>
                        handleUpdateQuestion(
                          activeQuestionData.section!.id,
                          activeQuestionData.question.id,
                          { negativeMarks: Math.max(0, Number(e.target.value) || 0) }
                        )
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-rose-400 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Unanswered question:</span>
                  <span className="font-mono font-bold text-slate-300">0 marks (No penalty)</span>
                </div>
              </div>

              {/* Toggles: Required & Partial Marking */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300 font-medium">Mark as Required</span>
                  <input
                    type="checkbox"
                    checked={activeQuestionData.question.isRequired || false}
                    onChange={(e) =>
                      handleUpdateQuestion(
                        activeQuestionData.section!.id,
                        activeQuestionData.question.id,
                        { isRequired: e.target.checked }
                      )
                    }
                    className="accent-indigo-500 w-4 h-4 rounded"
                  />
                </label>

                {(activeQuestionData.question.type === 'multiple_choice' ||
                  activeQuestionData.question.type === 'coding_problem') && (
                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-300 font-medium block">Partial Marking</span>
                      <span className="text-[10px] text-slate-400">
                        {activeQuestionData.question.type === 'coding_problem'
                          ? 'Award marks proportional to passed test cases'
                          : 'Proportional score for correct choices'}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={activeQuestionData.question.partialMarking !== false}
                      onChange={(e) =>
                        handleUpdateQuestion(
                          activeQuestionData.section!.id,
                          activeQuestionData.question.id,
                          { partialMarking: e.target.checked }
                        )
                      }
                      className="accent-indigo-500 w-4 h-4 rounded"
                    />
                  </label>
                )}

                {/* Difficulty Selector */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 block">Difficulty</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['easy', 'medium', 'hard'] as const).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() =>
                          handleUpdateQuestion(
                            activeQuestionData.section!.id,
                            activeQuestionData.question.id,
                            { difficulty: diff }
                          )
                        }
                        className={`py-1 text-[11px] font-medium capitalize rounded-md transition ${
                          activeQuestionData.question.difficulty === diff
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
                Context Inspector
              </span>
              <p className="text-slate-400 text-xs">
                Select a question from the left sidebar to configure its marks, negative penalty, and question type.
              </p>
            </div>
          )}

          {/* ASSESSMENT SCORE BREAKDOWN & METRICS (Always visible) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Scoring Summary</span>
              <span className="text-indigo-400 font-mono font-extrabold text-sm">
                {metrics.totalMarks} Marks
              </span>
            </h5>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Total Questions:</span>
                <span className="font-mono font-bold text-white">{metrics.totalQuestions}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Passing Cutoff:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {assessment.passingMarks} marks ({assessment.passingPercentage || 40}%)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Total Duration:</span>
                <span className="font-mono font-bold text-indigo-300">
                  {assessment.durationMinutes} mins
                </span>
              </div>
            </div>

            {/* Section Breakdown List */}
            {metrics.sectionBreakdown.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Section-wise Marks
                </span>
                {metrics.sectionBreakdown.map((sec) => (
                  <div
                    key={sec.id}
                    className="flex items-center justify-between text-[11px] text-slate-300"
                  >
                    <span className="truncate max-w-[150px]">{sec.title}</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {sec.questionCount} Q • {sec.marks} M
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PUBLISH READINESS CHECKLIST */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              Publish Readiness
            </h5>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                {assessment.title.trim() ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <X className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span className={assessment.title.trim() ? 'text-slate-300' : 'text-rose-400'}>
                  Assessment Title Set
                </span>
              </div>

              <div className="flex items-center gap-2">
                {metrics.totalQuestions > 0 ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <X className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span className={metrics.totalQuestions > 0 ? 'text-slate-300' : 'text-rose-400'}>
                  At least 1 question added
                </span>
              </div>

              <div className="flex items-center gap-2">
                {validateAssessment(assessment).filter((e) => e.type === 'missing_answer_key').length === 0 ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span className="text-slate-300">All questions have valid answer keys</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
      )}

      {/* ========================================================= */}
      {/* VALIDATION BLOCK MODAL (Shown when publishing fails)      */}
      {/* ========================================================= */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-rose-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Cannot Publish Assessment</span>
              </div>
              <button
                onClick={() => setShowValidationModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Before an assessment can be published and accessed by campus candidates, the following issues must be resolved:
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              {validationErrors.map((err, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (err.sectionId && err.questionId) {
                      setSelection({
                        type: 'question',
                        sectionId: err.sectionId,
                        questionId: err.questionId,
                      });
                      setShowValidationModal(false);
                    } else if (err.sectionId) {
                      setSelection({ type: 'section', sectionId: err.sectionId });
                      setShowValidationModal(false);
                    } else {
                      setSelection({ type: 'overview' });
                      setShowValidationModal(false);
                    }
                  }}
                  className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20 text-rose-200 cursor-pointer hover:bg-rose-950/30 transition flex items-start gap-2"
                >
                  <span className="font-mono text-rose-400 font-bold shrink-0">•</span>
                  <div className="flex-1">
                    <span>{err.message}</span>
                    {err.questionId && (
                      <span className="block text-[10px] text-indigo-400 mt-0.5 hover:underline font-semibold">
                        Click to jump to this question →
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
              >
                Dismiss & Fix Issues
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
