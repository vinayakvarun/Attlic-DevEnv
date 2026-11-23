/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Create Assessment Builder View
 */

import React, { useState } from 'react';
import { AttlicWordmark } from '../common/BrandLogo';
import { useAssessments } from '../../context/AssessmentContext';
import { useAuth } from '../../context/AuthContext';
import {
  Assessment,
  AssessmentSection,
  Question,
  QuestionType,
  DashboardTab,
  CodingLanguage,
  CodingProblemConfig,
  CodingTestCase,
} from '../../types';
import {
  Plus,
  Trash2,
  Code2,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers,
  HelpCircle,
  FileCheck,
  Shuffle,
  Calendar,
  Camera,
} from 'lucide-react';
import {
  SUPPORTED_CODING_LANGUAGES,
  getDefaultCodingConfig,
  getDefaultStarterCode,
  getCleanBoilerplateCode,
} from '../../utils/codeExecutionEngine';
import MonacoCodeEditor from '../common/MonacoCodeEditor';

interface CreateAssessmentViewProps {
  onNavigateTab: (tab: DashboardTab) => void;
  onOpenCandidatePortalWithCode: (code: string) => void;
  onEditAssessment?: (assessmentId: string) => void;
  onCreateFromScratch?: (enableCodingEnvironment?: boolean) => void;
}

export const CreateAssessmentView: React.FC<CreateAssessmentViewProps> = ({
  onNavigateTab,
  onOpenCandidatePortalWithCode,
  onEditAssessment,
  onCreateFromScratch,
}) => {
  const { createAssessment, createDraftAssessment, refreshData } = useAssessments();
  const { currentUser } = useAuth();

  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Step 1: Metadata
  const [title, setTitle] = useState('');
  const [code, setCode] = useState(
    () => `CAMPUS-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [passingMarks, setPassingMarks] = useState(50);
  const [tagInput, setTagInput] = useState('Campus 2026, Computer Science, Engineering');

  // Scoring Defaults & Batch Configuration
  const [defaultMarks, setDefaultMarks] = useState<number>(10);
  const [defaultNegativeMarks, setDefaultNegativeMarks] = useState<number>(2);
  const [showImmediateResults, setShowImmediateResults] = useState<boolean>(true);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(false);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(false);
  const [scheduledStartAt, setScheduledStartAt] = useState<string>('');
  const [scheduledEndAt, setScheduledEndAt] = useState<string>('');
  const [allowedDomainsInput, setAllowedDomainsInput] = useState<string>('');
  const [requireCandidateSnapshot, setRequireCandidateSnapshot] = useState<boolean>(false);
  const [scratchCodingEnabled, setScratchCodingEnabled] = useState<boolean>(false);
  const [activeWizardStarterLang, setActiveWizardStarterLang] = useState<CodingLanguage>('python');
  const [applyScoreToast, setApplyScoreToast] = useState<string | null>(null);

  // Candidate Registration Form Configuration (Editable by Recruiter)
  const [candidateDetailsConfig, setCandidateDetailsConfig] = useState({
    collectFullName: true,
    collectEmail: true,
    collectRollNumber: true,
    collectCollege: true,
    collectBranch: true,
    collectGraduationYear: false,
    collectPhone: true,
    collectCgpa: false,
    customFields: [] as Array<{
      id: string;
      label: string;
      required: boolean;
      type: 'text' | 'number';
      placeholder?: string;
    }>,
  });

  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomType, setNewCustomType] = useState<'text' | 'number'>('text');
  const [newCustomRequired, setNewCustomRequired] = useState(false);

  // Step 2: Sections and Questions
  const [sections, setSections] = useState<AssessmentSection[]>([
    {
      id: 'sec-1',
      title: 'Section 1: Technical & Problem Solving',
      order: 1,
      questions: [
        {
          id: 'q-custom-1',
          type: 'single_choice',
          title: 'What is the average time complexity of quicksort algorithm with random pivot selection?',
          options: [
            { id: 'opt-1', text: 'O(log n)' },
            { id: 'opt-2', text: 'O(n log n)', isCorrect: true },
            { id: 'opt-3', text: 'O(n^2)' },
            { id: 'opt-4', text: 'O(n)' },
          ],
          correctOptionIds: ['opt-2'],
          marks: 10,
          negativeMarks: 2,
          difficulty: 'medium',
          explanation: 'Average case recurrence relation T(n) = 2T(n/2) + O(n) yields O(n log n).',
        },
      ],
    },
  ]);

  // Step 3: Anti-Cheating
  const [antiCheating, setAntiCheating] = useState({
    trackTabSwitches: true,
    maxTabSwitches: 3,
    enableTwoMinuteViolationBlock: true,
    enforceFullscreen: true,
    forceFullscreen: true, // strict F11 / chrome fullscreen enforcement
    blockCopyPaste: true,
    webcamMonitoringNotice: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAssessment, setCreatedAssessment] = useState<Assessment | null>(null);

  // Apply default scoring to all questions across all sections
  const handleApplyScoreToAllQuestions = (marksToApply = defaultMarks, negToApply = defaultNegativeMarks) => {
    const updated = sections.map((sec) => ({
      ...sec,
      questions: sec.questions.map((q) => ({
        ...q,
        marks: marksToApply,
        negativeMarks: negToApply,
      })),
    }));
    setSections(updated);
    const count = updated.reduce((c, s) => c + s.questions.length, 0);
    setApplyScoreToast(`Applied +${marksToApply} / -${negToApply} marks to all ${count} questions!`);
    setTimeout(() => setApplyScoreToast(null), 3000);
  };

  const handleApplyScorePreset = (pos: number, neg: number) => {
    setDefaultMarks(pos);
    setDefaultNegativeMarks(neg);
    handleApplyScoreToAllQuestions(pos, neg);
  };

  // Calculations
  const totalMarks = sections.reduce(
    (total, sec) => total + sec.questions.reduce((qSum, q) => qSum + q.marks, 0),
    0
  );

  const handleAddQuestion = (sectionIndex: number) => {
    const updated = [...sections];
    const newQId = `q-${Date.now()}`;
    const newQuestion: Question = {
      id: newQId,
      type: 'single_choice',
      title: 'New multiple choice question title',
      options: [
        { id: `opt-${Date.now()}-1`, text: 'Option A (Correct)', isCorrect: true },
        { id: `opt-${Date.now()}-2`, text: 'Option B' },
        { id: `opt-${Date.now()}-3`, text: 'Option C' },
        { id: `opt-${Date.now()}-4`, text: 'Option D' },
      ],
      correctOptionIds: [`opt-${Date.now()}-1`],
      marks: defaultMarks,
      negativeMarks: defaultNegativeMarks,
      difficulty: 'medium',
    };
    updated[sectionIndex].questions.push(newQuestion);
    setSections(updated);
  };

  const handleUpdateQuestion = (
    sectionIndex: number,
    questionIndex: number,
    partial: Partial<Question>
  ) => {
    const updated = [...sections];
    updated[sectionIndex].questions[questionIndex] = {
      ...updated[sectionIndex].questions[questionIndex],
      ...partial,
    };
    setSections(updated);
  };

  const handleDeleteQuestion = (sectionIndex: number, questionIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex].questions.splice(questionIndex, 1);
    setSections(updated);
  };

  const handleAddSection = () => {
    const newSec: AssessmentSection = {
      id: `sec-${Date.now()}`,
      title: `Section ${sections.length + 1}: General Aptitude`,
      isCodingSection: false,
      order: sections.length + 1,
      questions: [],
    };
    setSections([...sections, newSec]);
  };

  const createDefaultCodingQuestion = (indexNum = 1): Question => ({
    id: `q-coding-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    type: 'coding_problem',
    title:
      indexNum === 1
        ? 'Sum of Array Elements: Given an integer N followed by N space-separated integers, compute and print the total sum of all N elements.'
        : `Coding Challenge #${indexNum}: Write a program that reads input from stdin and prints the required output to stdout.`,
    options: [],
    correctOptionIds: [],
    marks: 20,
    negativeMarks: 0,
    partialMarking: true,
    difficulty: 'medium',
    isRequired: true,
    explanation: 'Read N and process the elements using optimal time and space complexity.',
    codingConfig: getDefaultCodingConfig(),
  });

  const handleToggleScratchCoding = (enabled: boolean) => {
    setScratchCodingEnabled(enabled);
    if (enabled) {
      setSections((prev) => {
        const hasCodingSec = prev.some(
          (s) => s.isCodingSection || s.questions.some((q) => q.type === 'coding_problem')
        );
        if (hasCodingSec) return prev;
        const codingSec: AssessmentSection = {
          id: `sec-coding-${Date.now()}`,
          title: `Section ${prev.length + 1}: Hands-On Coding Challenges`,
          description:
            'Write, compile, and run code in Python 3, C, C++, Java, or JavaScript against automated test cases.',
          isCodingSection: true,
          order: prev.length + 1,
          questions: [createDefaultCodingQuestion(1)],
        };
        return [...prev, codingSec];
      });
    } else {
      setSections((prev) =>
        prev
          .filter((s) => !s.isCodingSection)
          .map((s, idx) => ({ ...s, order: idx + 1 }))
      );
    }
  };

  const handleAddCodingQuestion = (sectionIndex: number) => {
    const updated = [...sections];
    const nextNum = updated[sectionIndex].questions.length + 1;
    updated[sectionIndex].questions.push(createDefaultCodingQuestion(nextNum));
    setSections(updated);
  };

  const handleAddCodingSection = () => {
    const newCodingSec: AssessmentSection = {
      id: `sec-coding-${Date.now()}`,
      title: `Section ${sections.length + 1}: Hands-On Coding Challenges`,
      description:
        'Write, compile, and run code in Python 3, C, C++, Java, or JavaScript against automated test cases.',
      isCodingSection: true,
      order: sections.length + 1,
      questions: [createDefaultCodingQuestion(1)],
    };
    setSections([...sections, newCodingSec]);
  };

  const handleAddCustomField = () => {
    if (!newCustomLabel.trim()) return;
    const newField = {
      id: `custom_${Date.now()}`,
      label: newCustomLabel.trim(),
      type: newCustomType,
      required: newCustomRequired,
      placeholder: `Enter ${newCustomLabel.trim()}`,
    };
    setCandidateDetailsConfig({
      ...candidateDetailsConfig,
      customFields: [...candidateDetailsConfig.customFields, newField],
    });
    setNewCustomLabel('');
    setNewCustomRequired(false);
  };

  const handleRemoveCustomField = (id: string) => {
    setCandidateDetailsConfig({
      ...candidateDetailsConfig,
      customFields: candidateDetailsConfig.customFields.filter((f) => f.id !== id),
    });
  };

  const handleDeleteSection = (sectionIndex: number) => {
    const targetSec = sections[sectionIndex];
    const secTitle = targetSec?.title || `Section ${sectionIndex + 1}`;
    if (sections.length <= 1) {
      setSections([
        {
          id: `sec-${Date.now()}`,
          title: 'Section 1: Technical & Problem Solving',
          isCodingSection: false,
          order: 1,
          questions: [],
        },
      ]);
      setScratchCodingEnabled(false);
      setApplyScoreToast(`Cleared "${secTitle}" (at least 1 section is required).`);
      setTimeout(() => setApplyScoreToast(null), 3500);
      return;
    }

    const nextSections = sections
      .filter((_, idx) => idx !== sectionIndex)
      .map((s, idx) => ({ ...s, order: idx + 1 }));
    setSections(nextSections);

    const stillHasCoding = nextSections.some(
      (s) => s.isCodingSection || s.questions.some((q) => q.type === 'coding_problem')
    );
    if (!stillHasCoding && targetSec?.isCodingSection) {
      setScratchCodingEnabled(false);
    }
    setApplyScoreToast(`Deleted "${secTitle}".`);
    setTimeout(() => setApplyScoreToast(null), 3500);
  };

  const handleSaveAssessment = async (status: 'draft' | 'published') => {
    if (!title.trim()) {
      setApplyScoreToast('Please provide an assessment title in Step 1.');
      setActiveStep(1);
      return;
    }

    try {
      setIsSubmitting(true);
      const tags = tagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const allowedEmailDomains = allowedDomainsInput
        .split(',')
        .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean);

      const newRecord = await createAssessment({
        title: title.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || 'Online assessment administered through ATTLIC.',
        recruiterId: currentUser?.uid || 'recruiter-demo',
        recruiterEmail: currentUser?.email || 'recruiter@attlic.internal',
        organizationName: currentUser?.organizationName || 'ATTLIC Campus Placement Partner',
        status,
        durationMinutes: Number(durationMinutes) || 45,
        totalMarks: totalMarks > 0 ? totalMarks : 100,
        passingMarks: Number(passingMarks) || 50,
        defaultMarks,
        defaultNegativeMarks,
        showImmediateResults,
        shuffleQuestions,
        shuffleOptions,
        scheduledStartAt: scheduledStartAt || undefined,
        scheduledEndAt: scheduledEndAt || undefined,
        allowedEmailDomains: allowedEmailDomains.length > 0 ? allowedEmailDomains : undefined,
        requireCandidateSnapshot,
        creationSource: 'scratch',
        enableCodingEnvironment: scratchCodingEnabled,
        candidateDetailsConfig,
        tags,
        sections,
        antiCheating,
        instructions: [
          'All answers must be verified before clicking final submit.',
          'Tab switching is actively tracked. Avoid opening secondary tabs or applications.',
          ...(antiCheating.enableTwoMinuteViolationBlock
            ? [
                `Exceeding the violation threshold (${antiCheating.maxTabSwitches} tab switches) triggers a mandatory 2-minute screen block.`,
              ]
            : []),
          'True Fullscreen Mode is strictly enforced. Exiting fullscreen locks the exam.',
          'Responses are auto-saved in real-time.',
        ],
      });

      setCreatedAssessment(newRecord);
    } catch {
      // Handled by local persistence
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdAssessment) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl bg-slate-900 border border-indigo-500/30 p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Assessment Created Successfully!</h2>
          <p className="text-xs text-slate-400">
            "{createdAssessment.title}" is ready. Share the candidate access code below.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 max-w-sm mx-auto">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Candidate Test Code
          </span>
          <span className="text-2xl font-mono font-extrabold text-indigo-400 select-all block mt-1">
            {createdAssessment.code}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          {onEditAssessment && (
            <button
              onClick={() => onEditAssessment(createdAssessment.id)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm shadow-indigo-600/30 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Open in Assessment Editor</span>
            </button>
          )}
          <button
            onClick={async () => {
              await refreshData();
              setCreatedAssessment(null);
              onNavigateTab('assessments');
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 transition"
          >
            Back to Assessments
          </button>
          <button
            onClick={() => onOpenCandidatePortalWithCode(createdAssessment.code)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 transition flex items-center gap-1.5"
          >
            <span>Open in Candidate Hall</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-sans tracking-tight">
            Create Placement Assessment
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Design sections, configure negative marking, and enforce proctoring rules.
          </p>
        </div>
      </div>

      {/* Creation Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={async () => {
            if (onCreateFromScratch) {
              onCreateFromScratch(scratchCodingEnabled);
            } else {
              const draft = await createDraftAssessment({
                creationSource: 'scratch',
                enableCodingEnvironment: scratchCodingEnabled,
              });
              if (onEditAssessment) onEditAssessment(draft.id);
            }
          }}
          className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-indigo-950/30 border border-indigo-500/40 hover:border-indigo-400/80 transition cursor-pointer group shadow-sm flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center group-hover:scale-105 transition">
                <Sparkles className="w-5 h-5" />
              </div>
              {scratchCodingEnabled && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Code2 className="w-3 h-3" />
                  <span>Coding IDE Enabled</span>
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
              1. Create Assessment from Scratch
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automatically generates a new draft assessment and opens the professional three-part Assessment Editor with live autosave, section management, and scoring validation.
            </p>

            {/* Exclusive Toggle for Coding Questions with Test Environment */}
            <div
              onClick={(e) => e.stopPropagation()}
              className={`p-3 rounded-xl border transition ${
                scratchCodingEnabled
                  ? 'bg-emerald-950/30 border-emerald-500/40'
                  : 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/40'
              }`}
            >
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-100">
                      I want to add coding questions with test environment
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Enables in-built multi-language coding IDE (Python, C, C++, Java, JS) with automated sample &amp; hidden test case evaluation.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={scratchCodingEnabled}
                  onChange={(e) => handleToggleScratchCoding(e.target.checked)}
                  className="mt-0.5 accent-indigo-500 w-4 h-4 rounded shrink-0"
                />
              </label>
            </div>
          </div>
          <div className="pt-1 flex items-center justify-between text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
            <span>
              {scratchCodingEnabled
                ? 'Open Assessment Editor (with Coding Environment)'
                : 'Open Assessment Editor'}
            </span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('import')}
          className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition cursor-pointer group shadow-sm flex flex-col justify-between space-y-4"
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center group-hover:scale-105 transition">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
              2. Import from Google Forms
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Paste any public or shared Google Forms link to extract sections, multiple-choice questions, and answer options directly into editable <AttlicWordmark /> format.
            </p>
          </div>
          <div className="pt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300 group-hover:text-white">
            <span>Import Google Form</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Or Use Quick Setup Wizard Below
          </h4>
          <p className="text-[11px] text-slate-400">
            Configure step-by-step or proceed to questions immediately.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl text-xs font-medium">
          <button
            onClick={() => setActiveStep(1)}
            className={`px-3 py-1 rounded-lg transition ${
              activeStep === 1 ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Details
          </button>
          <button
            onClick={() => setActiveStep(2)}
            className={`px-3 py-1 rounded-lg transition ${
              activeStep === 2 ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Questions ({totalMarks} marks)
          </button>
          <button
            onClick={() => setActiveStep(3)}
            className={`px-3 py-1 rounded-lg transition ${
              activeStep === 3 ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Anti-Cheating & Publish
          </button>
        </div>
      </div>

      {/* Step 1: Basic Information */}
      {activeStep === 1 && (
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 space-y-5">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            General Drive Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">
                Assessment Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Campus Placement Drive 2026: Software Engineering Test"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Candidate Access Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CAMPUS-2026-CS"
                className="w-full px-3.5 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-indigo-400 font-bold focus:outline-none focus:border-indigo-500 uppercase"
              />
              <p className="text-[10px] text-slate-400">
                Candidates enter this exact alphanumeric code in the <AttlicWordmark /> Test Hall.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Duration (Minutes) *
              </label>
              <input
                type="number"
                min="10"
                max="240"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Passing Marks Threshold
              </label>
              <input
                type="number"
                min="1"
                value={passingMarks}
                onChange={(e) => setPassingMarks(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Tags (Comma-separated)
              </label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Algorithms, DSA, Aptitude"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">
                Description & Instructions
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly state syllabus, target batch, and evaluation criteria..."
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Scoring Defaults Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Default Question Scoring Configuration</h4>
                <p className="text-[11px] text-slate-400">
                  New questions inherit these marks. You can also mass-apply these marks to all questions in Step 2.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { pos: 1, neg: 0 },
                  { pos: 2, neg: 0.5 },
                  { pos: 4, neg: 1 },
                  { pos: 5, neg: 1 },
                  { pos: 10, neg: 2 },
                ].map((preset) => (
                  <button
                    key={`${preset.pos}_${preset.neg}`}
                    type="button"
                    onClick={() => {
                      setDefaultMarks(preset.pos);
                      setDefaultNegativeMarks(preset.neg);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                      defaultMarks === preset.pos && defaultNegativeMarks === preset.neg
                        ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    +{preset.pos} / -{preset.neg}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Default Positive Marks (+)</label>
                <input
                  type="number"
                  min="1"
                  value={defaultMarks}
                  onChange={(e) => setDefaultMarks(Number(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Default Negative Marks (-)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={defaultNegativeMarks}
                  onChange={(e) => setDefaultNegativeMarks(Number(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-rose-400 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Publish Immediate Results Configuration (Details Tab) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-3">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-100">
                    Publish Immediate Results to Candidate
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      showImmediateResults
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {showImmediateResults ? 'Immediate Scorecard Active' : 'Results Withheld'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {showImmediateResults
                    ? 'Enabled: Candidates immediately see their total score, percentage, and pass/fail qualification status right after submitting the test.'
                    : 'Withheld: Candidates only receive an official submission confirmation receipt. Scores are hidden from candidates for recruiter review.'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={showImmediateResults}
                onChange={(e) => setShowImmediateResults(e.target.checked)}
                className="mt-1 accent-indigo-500 w-4 h-4 shrink-0"
              />
            </label>
          </div>

          {/* Coding Questions with Test Environment Toggle (Scratch Mode Only) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-100">
                    I want to add coding questions with test environment
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      scratchCodingEnabled
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {scratchCodingEnabled ? 'Coding IDE Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Unlocks the multi-language Coding Problem type (Python 3, C, C++, Java, JavaScript) with starter code templates, sample test cases, and hidden grading test cases.
                </p>
              </div>
              <input
                type="checkbox"
                checked={scratchCodingEnabled}
                onChange={(e) => handleToggleScratchCoding(e.target.checked)}
                className="mt-1 accent-indigo-500 w-4 h-4 shrink-0"
              />
            </label>
          </div>

          {/* 1. Question & Option Randomization (General Tab) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <Shuffle className="w-4 h-4 text-indigo-400" />
                  <span>Question &amp; Option Randomization (Anti-Collusion)</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Deterministically randomizes question order and/or MCQ option order per candidate so adjacent students see different sequences.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/40">
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">
                    Shuffle Question Order per Candidate
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Randomizes question sequence inside each section
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="accent-indigo-500 w-4 h-4 shrink-0"
                />
              </label>

              <label className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/40">
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">
                    Shuffle MCQ Options per Candidate
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Randomizes A/B/C/D choices while keeping grading intact
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="accent-indigo-500 w-4 h-4 shrink-0"
                />
              </label>
            </div>
          </div>

          {/* 2. Scheduled Exam Window & Email Domain Whitelist (General Tab) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Scheduled Exam Window &amp; Candidate Email Whitelist (Optional)</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Restrict when candidates can launch the assessment and optionally whitelist specific college email domains.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Window Opens At (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledStartAt}
                  onChange={(e) => setScheduledStartAt(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Window Closes At (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledEndAt}
                  onChange={(e) => setScheduledEndAt(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Allowed Email Domains (Comma-sep)</label>
                <input
                  type="text"
                  value={allowedDomainsInput}
                  onChange={(e) => setAllowedDomainsInput(e.target.value)}
                  placeholder="e.g. iitd.ac.in, nit.edu"
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* 3 & 5. Candidate 1-Snapshot Verification & PDF Certificate Option (General Tab) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-3">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-slate-100">
                    Capture 1 Candidate Snapshot &amp; Attach to PDF Certificate
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      requireCandidateSnapshot
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {requireCandidateSnapshot ? 'Snapshot + PDF Active' : 'Optional (Off)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  When enabled, takes one verification snapshot of the candidate during registration and embeds it directly into the downloadable PDF Verification Certificate &amp; Scorecard.
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireCandidateSnapshot}
                onChange={(e) => setRequireCandidateSnapshot(e.target.checked)}
                className="mt-1 accent-indigo-500 w-4 h-4 shrink-0"
              />
            </label>
          </div>

          {/* Candidate Registration Form Configuration */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-indigo-400" />
                <span>Candidate Personal Details Form (Editable by Recruiter)</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Choose which personal identity and academic fields are collected and required before candidates begin the examination.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">Full Name</span>
                  <span className="text-[10px] text-slate-400">Official student identity</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Required (Locked)
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">College Email Address</span>
                  <span className="text-[10px] text-slate-400">Official score delivery</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Required (Locked)
                </span>
              </div>

              <label className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700">
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">Roll Number / Student ID</span>
                  <span className="text-[10px] text-slate-400">University hall ticket ID</span>
                </div>
                <input
                  type="checkbox"
                  checked={candidateDetailsConfig.collectRollNumber}
                  onChange={(e) =>
                    setCandidateDetailsConfig({ ...candidateDetailsConfig, collectRollNumber: e.target.checked })
                  }
                  className="accent-indigo-500 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700">
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">University / College Name</span>
                  <span className="text-[10px] text-slate-400">Campus affiliation</span>
                </div>
                <input
                  type="checkbox"
                  checked={candidateDetailsConfig.collectCollege}
                  onChange={(e) =>
                    setCandidateDetailsConfig({ ...candidateDetailsConfig, collectCollege: e.target.checked })
                  }
                  className="accent-indigo-500 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700">
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">Academic Branch / Department</span>
                  <span className="text-[10px] text-slate-400">e.g. CS, IT, ECE, Mechanical</span>
                </div>
                <input
                  type="checkbox"
                  checked={candidateDetailsConfig.collectBranch}
                  onChange={(e) =>
                    setCandidateDetailsConfig({ ...candidateDetailsConfig, collectBranch: e.target.checked })
                  }
                  className="accent-indigo-500 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700">
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">Phone Number / WhatsApp</span>
                  <span className="text-[10px] text-slate-400">Shortlisting contact</span>
                </div>
                <input
                  type="checkbox"
                  checked={candidateDetailsConfig.collectPhone}
                  onChange={(e) =>
                    setCandidateDetailsConfig({ ...candidateDetailsConfig, collectPhone: e.target.checked })
                  }
                  className="accent-indigo-500 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700">
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">Current CGPA / Percentage</span>
                  <span className="text-[10px] text-slate-400">Academic cutoff verification</span>
                </div>
                <input
                  type="checkbox"
                  checked={candidateDetailsConfig.collectCgpa}
                  onChange={(e) =>
                    setCandidateDetailsConfig({ ...candidateDetailsConfig, collectCgpa: e.target.checked })
                  }
                  className="accent-indigo-500 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700">
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">Graduation Batch / Year</span>
                  <span className="text-[10px] text-slate-400">e.g. 2026 Batch</span>
                </div>
                <input
                  type="checkbox"
                  checked={candidateDetailsConfig.collectGraduationYear}
                  onChange={(e) =>
                    setCandidateDetailsConfig({ ...candidateDetailsConfig, collectGraduationYear: e.target.checked })
                  }
                  className="accent-indigo-500 w-4 h-4"
                />
              </label>
            </div>

            {/* Custom Field Adder */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Additional Custom Fields:
              </span>

              {candidateDetailsConfig.customFields.map((field) => (
                <div
                  key={field.id}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200">{field.label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {field.type}
                    </span>
                    {field.required && (
                      <span className="text-[10px] text-indigo-400 font-bold">Required</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomField(field.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newCustomLabel}
                  onChange={(e) => setNewCustomLabel(e.target.value)}
                  placeholder="e.g. Section / Class Batch or Portfolio Link"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={newCustomType}
                  onChange={(e) => setNewCustomType(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
                >
                  <option value="text">Text Field</option>
                  <option value="number">Numeric Field</option>
                </select>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCustomRequired}
                    onChange={(e) => setNewCustomRequired(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  <span>Mandatory</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddCustomField}
                  disabled={!newCustomLabel.trim()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Field</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              onClick={() => setActiveStep(2)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
            >
              <span>Next: Add Questions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Sections & Questions Builder */}
      {activeStep === 2 && (
        <div className="space-y-6">
          {/* Default Scoring Controls & Apply to All Toolbar */}
          <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Question Scoring Defaults & Mass Apply
                </h4>
              </div>
              <p className="text-[11px] text-slate-400">
                Configure default marks once. Click "Apply to All" to instantly update every question across all sections.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Preset buttons */}
              <div className="flex items-center gap-1">
                {[
                  { pos: 1, neg: 0 },
                  { pos: 2, neg: 0.5 },
                  { pos: 4, neg: 1 },
                  { pos: 5, neg: 1 },
                  { pos: 10, neg: 2 },
                ].map((preset) => (
                  <button
                    key={`${preset.pos}_${preset.neg}`}
                    type="button"
                    onClick={() => handleApplyScorePreset(preset.pos, preset.neg)}
                    title={`Set default to +${preset.pos} / -${preset.neg} and apply to all questions`}
                    className={`px-2 py-1 rounded text-[10px] font-mono border transition ${
                      defaultMarks === preset.pos && defaultNegativeMarks === preset.neg
                        ? 'bg-indigo-600 text-white border-indigo-500 font-bold'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    +{preset.pos}/-{preset.neg}
                  </button>
                ))}
              </div>

              {/* Custom numeric inputs */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400">Marks:</span>
                  <input
                    type="number"
                    min="1"
                    value={defaultMarks}
                    onChange={(e) => setDefaultMarks(Number(e.target.value) || 1)}
                    className="w-10 bg-transparent text-center text-xs font-bold text-emerald-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400">Neg:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={defaultNegativeMarks}
                    onChange={(e) => setDefaultNegativeMarks(Number(e.target.value) || 0)}
                    className="w-10 bg-transparent text-center text-xs font-bold text-rose-400 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyScoreToAllQuestions()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply to All ({sections.reduce((c, s) => c + s.questions.length, 0)}) Questions</span>
                </button>
              </div>
            </div>
          </div>

          {applyScoreToast && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{applyScoreToast}</span>
            </div>
          )}
          {sections.map((section, sIdx) => {
            const isCodingSection = Boolean(
              section.isCodingSection ||
                section.questions.some((q) => q.type === 'coding_problem')
            );

            return (
              <div
                key={section.id}
                className={`rounded-xl p-5 space-y-4 border ${
                  isCodingSection
                    ? 'bg-emerald-950/10 border-emerald-500/40'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                    {isCodingSection && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                        <Code2 className="w-3 h-3" />
                        <span>Coding Section</span>
                      </span>
                    )}
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => {
                        const updated = [...sections];
                        updated[sIdx].title = e.target.value;
                        setSections(updated);
                      }}
                      className="text-sm font-bold text-white bg-transparent border-b border-dashed border-slate-700 pb-0.5 focus:outline-none focus:border-indigo-400 flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-400 font-mono">
                      {section.questions.length}{' '}
                      {isCodingSection ? 'Coding Questions' : 'Questions'}
                    </span>
                    {isCodingSection && (
                      <button
                        type="button"
                        onClick={() => handleAddCodingQuestion(sIdx)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Coding Question</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(sIdx)}
                      title="Delete this section"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Section</span>
                    </button>
                  </div>
                </div>

                {/* Questions in Section */}
                <div className="space-y-4">
                  {section.questions.map((q, qIdx) => {
                    const isCodingQ = isCodingSection || q.type === 'coding_problem';
                    const cfg: CodingProblemConfig =
                      q.codingConfig || getDefaultCodingConfig();
                    const updateQuestionCfg = (
                      partialCfg: Partial<CodingProblemConfig>
                    ) => {
                      handleUpdateQuestion(sIdx, qIdx, {
                        type: 'coding_problem',
                        codingConfig: {
                          ...cfg,
                          ...partialCfg,
                        },
                      });
                    };

                    return (
                      <div
                        key={q.id}
                        className={`p-4 rounded-xl bg-slate-950 border space-y-4 ${
                          isCodingQ
                            ? 'border-emerald-500/30'
                            : 'border-slate-800'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded text-[11px] font-bold flex items-center justify-center ${
                                isCodingQ
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-800 text-indigo-400'
                              }`}
                            >
                              {qIdx + 1}
                            </span>
                            {isCodingQ ? (
                              <span className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5">
                                <Code2 className="w-3.5 h-3.5" />
                                <span>Coding Problem (IDE + Automated Test Cases)</span>
                              </span>
                            ) : (
                              <select
                                value={q.type}
                                onChange={(e) => {
                                  const nextType = e.target.value as QuestionType;
                                  handleUpdateQuestion(sIdx, qIdx, {
                                    type: nextType,
                                  });
                                }}
                                className="px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none"
                              >
                                <option value="single_choice">Single Choice (Radio)</option>
                                <option value="multiple_choice">
                                  Multiple Choice (Checkboxes)
                                </option>
                                <option value="short_text">Short Text Answer</option>
                              </select>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 text-[11px]">Marks:</span>
                              <input
                                type="number"
                                min="1"
                                value={q.marks}
                                onChange={(e) =>
                                  handleUpdateQuestion(sIdx, qIdx, {
                                    marks: Number(e.target.value),
                                  })
                                }
                                className="w-12 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs text-emerald-400 font-bold"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 text-[11px]">Negative:</span>
                              <input
                                type="number"
                                min="0"
                                value={q.negativeMarks}
                                onChange={(e) =>
                                  handleUpdateQuestion(sIdx, qIdx, {
                                    negativeMarks: Number(e.target.value),
                                  })
                                }
                                className="w-12 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs text-rose-400 font-bold"
                              />
                            </div>
                            <select
                              value={q.difficulty || 'medium'}
                              onChange={(e) =>
                                handleUpdateQuestion(sIdx, qIdx, {
                                  difficulty: e.target.value as 'easy' | 'medium' | 'hard',
                                })
                              }
                              className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 capitalize"
                            >
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                            {isCodingQ && (
                              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={q.partialMarking !== false}
                                  onChange={(e) =>
                                    handleUpdateQuestion(sIdx, qIdx, {
                                      partialMarking: e.target.checked,
                                    })
                                  }
                                  className="accent-indigo-500"
                                />
                                <span>Partial Marks</span>
                              </label>
                            )}
                            <button
                              onClick={() => handleDeleteQuestion(sIdx, qIdx)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Delete Question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold text-slate-300 block">
                            {isCodingQ ? 'Coding Problem Statement *' : 'Question Statement *'}
                          </label>
                          <textarea
                            rows={2}
                            value={q.title}
                            onChange={(e) =>
                              handleUpdateQuestion(sIdx, qIdx, { title: e.target.value })
                            }
                            placeholder={
                              isCodingQ
                                ? 'Describe the coding challenge, algorithm task, and example walkthrough...'
                                : 'Enter question statement...'
                            }
                            className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        {/* Regular MCQ Options */}
                        {!isCodingQ && q.type !== 'short_text' && (
                          <div className="space-y-1.5 pl-2 border-l-2 border-indigo-500/20">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              Options (Select the correct answer
                              {q.type === 'multiple_choice' ? 's' : ''}):
                            </span>
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = q.correctOptionIds.includes(opt.id);
                              return (
                                <div key={opt.id} className="flex items-center gap-2">
                                  <input
                                    type={q.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                                    name={`correct-${q.id}`}
                                    checked={isCorrect}
                                    onChange={() => {
                                      if (q.type === 'single_choice') {
                                        handleUpdateQuestion(sIdx, qIdx, {
                                          correctOptionIds: [opt.id],
                                        });
                                      } else {
                                        const next = isCorrect
                                          ? q.correctOptionIds.filter((id) => id !== opt.id)
                                          : [...q.correctOptionIds, opt.id];
                                        handleUpdateQuestion(sIdx, qIdx, {
                                          correctOptionIds: next,
                                        });
                                      }
                                    }}
                                    className="accent-indigo-500"
                                  />
                                  <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => {
                                      const updatedOpts = [...q.options];
                                      updatedOpts[oIdx] = { ...opt, text: e.target.value };
                                      handleUpdateQuestion(sIdx, qIdx, {
                                        options: updatedOpts,
                                      });
                                    }}
                                    placeholder={`Option ${oIdx + 1}`}
                                    className="flex-1 px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-slate-200 focus:outline-none"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Simplified Editable Coding Problem Configuration with Real Monaco Editor */}
                        {isCodingQ && (
                          <div className="space-y-3.5 pt-2 border-t border-slate-800/80">
                            {/* 1. Compact Allowed Languages & Optional Specs */}
                            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                                  <Terminal className="w-3.5 h-3.5" />
                                  <span>Allowed Languages</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-400">Default IDE:</span>
                                  <select
                                    value={cfg.defaultLanguage}
                                    onChange={(e) => {
                                      const nextDefault = e.target.value as CodingLanguage;
                                      updateQuestionCfg({
                                        defaultLanguage: nextDefault,
                                      });
                                      setActiveWizardStarterLang(nextDefault);
                                    }}
                                    className="px-2 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-emerald-300 font-semibold"
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

                              <div className="flex flex-wrap items-center gap-1.5">
                                {SUPPORTED_CODING_LANGUAGES.map((lang) => {
                                  const checked = cfg.allowedLanguages.includes(lang.id);
                                  return (
                                    <label
                                      key={lang.id}
                                      className={`px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer flex items-center gap-1.5 transition ${
                                        checked
                                          ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                                          : 'bg-slate-950 border-slate-800 text-slate-400'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          const nextLangs = e.target.checked
                                            ? [...cfg.allowedLanguages, lang.id]
                                            : cfg.allowedLanguages.filter(
                                                (l) => l !== lang.id
                                              );
                                          if (nextLangs.length === 0) return;
                                          updateQuestionCfg({
                                            allowedLanguages: nextLangs,
                                            defaultLanguage: nextLangs.includes(
                                              cfg.defaultLanguage
                                            )
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

                              <details className="pt-1">
                                <summary className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer select-none">
                                  Optional: Input / Output Format, Constraints &amp; Time Limit ({cfg.timeLimitSeconds || 2}s)
                                </summary>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                      Input Format
                                    </label>
                                    <input
                                      type="text"
                                      value={cfg.inputFormat || ''}
                                      onChange={(e) =>
                                        updateQuestionCfg({ inputFormat: e.target.value })
                                      }
                                      placeholder="First line N..."
                                      className="w-full px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                      Output Format
                                    </label>
                                    <input
                                      type="text"
                                      value={cfg.outputFormat || ''}
                                      onChange={(e) =>
                                        updateQuestionCfg({ outputFormat: e.target.value })
                                      }
                                      placeholder="Print sum..."
                                      className="w-full px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                      Constraints
                                    </label>
                                    <input
                                      type="text"
                                      value={cfg.constraints || ''}
                                      onChange={(e) =>
                                        updateQuestionCfg({ constraints: e.target.value })
                                      }
                                      placeholder="1 <= N <= 10^5"
                                      className="w-full px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                      Time Limit (s)
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={15}
                                      value={cfg.timeLimitSeconds || 2}
                                      onChange={(e) =>
                                        updateQuestionCfg({
                                          timeLimitSeconds: Math.max(
                                            1,
                                            Number(e.target.value) || 2
                                          ),
                                        })
                                      }
                                      className="w-full px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-mono font-bold"
                                    />
                                  </div>
                                </div>
                              </details>
                            </div>

                            {/* 2. Editable Starter Code Template in Monaco Editor */}
                            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">
                                    Starter Code ({activeWizardStarterLang.toUpperCase()})
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                                    Standard Headers Pre-Included
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateQuestionCfg({
                                        starterCode: {
                                          ...(cfg.starterCode ||
                                            getDefaultCodingConfig().starterCode),
                                          [activeWizardStarterLang]:
                                            getCleanBoilerplateCode(activeWizardStarterLang),
                                        },
                                      })
                                    }
                                    className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold transition"
                                  >
                                    Use Clean Boilerplate (Headers Only)
                                  </button>
                                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                                    {SUPPORTED_CODING_LANGUAGES.map((lang) => (
                                      <button
                                        key={lang.id}
                                        type="button"
                                        onClick={() => setActiveWizardStarterLang(lang.id)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                                          activeWizardStarterLang === lang.id
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
                              <div className="rounded-lg overflow-hidden border border-slate-800">
                                <MonacoCodeEditor
                                  language={activeWizardStarterLang}
                                  value={
                                    cfg.starterCode?.[activeWizardStarterLang] ??
                                    getDefaultStarterCode(activeWizardStarterLang)
                                  }
                                  onChange={(nextVal) =>
                                    updateQuestionCfg({
                                      starterCode: {
                                        ...(cfg.starterCode ||
                                          getDefaultCodingConfig().starterCode),
                                        [activeWizardStarterLang]: nextVal,
                                      },
                                    })
                                  }
                                  height="190px"
                                  compact
                                  showQuickSnippets={false}
                                />
                              </div>
                            </div>

                            {/* 3. Editable Test Cases (Sample + Hidden) */}
                            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white">
                                  Test Cases ({cfg.testCases.length}) — Public Sample &amp; Hidden Grading
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newTc: CodingTestCase = {
                                      id: `tc_${Date.now()}`,
                                      input: '3\n10 20 30',
                                      expectedOutput: '60',
                                      isSample: false,
                                    };
                                    updateQuestionCfg({
                                      testCases: [...cfg.testCases, newTc],
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add Test Case</span>
                                </button>
                              </div>

                              <div className="space-y-2.5">
                                {cfg.testCases.map((tc, tcIdx) => (
                                  <div
                                    key={tc.id}
                                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-indigo-400">
                                          Test Case #{tcIdx + 1}
                                        </span>
                                        <label className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 cursor-pointer text-[11px]">
                                          <input
                                            type="checkbox"
                                            checked={tc.isSample}
                                            onChange={(e) => {
                                              const nextTcs = cfg.testCases.map((item, idx) =>
                                                idx === tcIdx
                                                  ? { ...item, isSample: e.target.checked }
                                                  : item
                                              );
                                              updateQuestionCfg({ testCases: nextTcs });
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
                                            {tc.isSample
                                              ? 'Public Sample Case'
                                              : 'Hidden Grading Case'}
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
                                            updateQuestionCfg({ testCases: nextTcs });
                                          }}
                                          className="text-slate-500 hover:text-rose-400 p-1"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                          Input (stdin)
                                        </label>
                                        <textarea
                                          rows={2}
                                          value={tc.input}
                                          onChange={(e) => {
                                            const nextTcs = cfg.testCases.map((item, idx) =>
                                              idx === tcIdx
                                                ? { ...item, input: e.target.value }
                                                : item
                                            );
                                            updateQuestionCfg({ testCases: nextTcs });
                                          }}
                                          className="w-full p-2 text-xs font-mono bg-slate-900 border border-slate-800 rounded text-slate-200"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
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
                                            updateQuestionCfg({ testCases: nextTcs });
                                          }}
                                          className="w-full p-2 text-xs font-mono bg-slate-900 border border-slate-800 rounded text-emerald-300"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isCodingSection ? (
                  <button
                    type="button"
                    onClick={() => handleAddCodingQuestion(sIdx)}
                    className="w-full py-2.5 border border-dashed border-emerald-500/50 hover:border-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/30 rounded-lg text-xs font-semibold text-emerald-300 transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Coding Question to this Coding Section</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddQuestion(sIdx)}
                    className="w-full py-2 border border-dashed border-slate-700 hover:border-indigo-500/60 rounded-lg text-xs font-medium text-slate-300 hover:text-indigo-300 transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question to this Section</span>
                  </button>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAddSection}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Section</span>
              </button>
              {scratchCodingEnabled && (
                <button
                  type="button"
                  onClick={handleAddCodingSection}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 transition flex items-center gap-1.5"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Add Coding Section</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStep(1)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Back
              </button>
              <button
                onClick={() => setActiveStep(3)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
              >
                <span>Next: Integrity Rules</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Anti-Cheating & Final Confirmation */}
      {activeStep === 3 && (
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Anti-Cheating & Exam Security Policy
            </h3>
            <p className="text-xs text-slate-400">
              <AttlicWordmark /> embeds integrity and anti-cheating enforcement into every candidate exam viewport.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={antiCheating.trackTabSwitches}
                onChange={(e) =>
                  setAntiCheating({ ...antiCheating, trackTabSwitches: e.target.checked })
                }
                className="mt-0.5 accent-indigo-500"
              />
              <div className="space-y-0.5 text-xs">
                <span className="font-semibold text-slate-200 block">
                  Track Tab Switching & Focus Loss
                </span>
                <span className="text-slate-400 block text-[11px]">
                  Alerts candidate and logs telemetry if browser window loses focus during test.
                </span>
              </div>
            </label>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-200 font-semibold block">
                  Violation Threshold (Max Tab Switches Allowed)
                </span>
                <span className="text-[11px] text-slate-400">
                  Number of tab-switch / focus-loss incidents before threshold action is triggered.
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="10"
                value={antiCheating.maxTabSwitches}
                onChange={(e) =>
                  setAntiCheating({
                    ...antiCheating,
                    maxTabSwitches: Math.max(1, Number(e.target.value) || 3),
                  })
                }
                className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-indigo-300 font-bold font-mono"
              />
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-rose-500/30 cursor-pointer hover:border-rose-500/50 transition">
              <input
                type="checkbox"
                checked={antiCheating.enableTwoMinuteViolationBlock}
                onChange={(e) =>
                  setAntiCheating({
                    ...antiCheating,
                    enableTwoMinuteViolationBlock: e.target.checked,
                  })
                }
                className="mt-0.5 accent-indigo-500 w-4 h-4"
              />
              <div className="space-y-0.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200 block">
                    2-Minute Block if More Than Threshold Violation Found
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    02:00 Penalty Lockout
                  </span>
                </div>
                <span className="text-slate-400 block text-[11px] leading-relaxed">
                  When enabled, if a candidate reaches or exceeds the violation threshold ({antiCheating.maxTabSwitches} violations), their examination screen is automatically locked for 2 minutes (120 seconds) before they can resume answering.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={antiCheating.forceFullscreen}
                onChange={(e) =>
                  setAntiCheating({
                    ...antiCheating,
                    forceFullscreen: e.target.checked,
                    enforceFullscreen: e.target.checked,
                  })
                }
                className="mt-0.5 accent-indigo-500 w-4 h-4"
              />
              <div className="space-y-0.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200 block">
                    Force Full Screen Mode (Chrome F11 / Fullscreen API)
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Strict Proctoring
                  </span>
                </div>
                <span className="text-slate-400 block text-[11px] leading-relaxed">
                  Strict enforcement: Candidate cannot proceed to take the test unless browser is in true Fullscreen mode. If candidate exits fullscreen (e.g. by pressing Esc or resizing), the test is immediately locked and paused until fullscreen is re-entered.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={antiCheating.blockCopyPaste}
                onChange={(e) =>
                  setAntiCheating({ ...antiCheating, blockCopyPaste: e.target.checked })
                }
                className="mt-0.5 accent-indigo-500"
              />
              <div className="space-y-0.5 text-xs">
                <span className="font-semibold text-slate-200 block">
                  Disable Copy / Paste Shortcuts
                </span>
                <span className="text-slate-400 block text-[11px]">
                  Prevents copying question prompts to external tools.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-indigo-500/30 cursor-pointer hover:border-indigo-500/50 transition">
              <input
                type="checkbox"
                checked={showImmediateResults}
                onChange={(e) => setShowImmediateResults(e.target.checked)}
                className="mt-0.5 accent-indigo-500 w-4 h-4"
              />
              <div className="space-y-0.5 text-xs">
                <span className="font-semibold text-slate-200 block">
                  Publish Immediate Results to Candidate
                </span>
                <span className="text-slate-400 block text-[11px]">
                  Let the candidate immediately see their score and qualification status upon submission, or uncheck to withhold results for manual release.
                </span>
              </div>
            </label>
          </div>

          {/* Assessment Summary Snapshot */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 text-xs space-y-2">
            <span className="font-bold text-indigo-300 block">Assessment Configuration Summary</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block">Title</span>
                <span className="font-medium text-slate-200">{title || 'Untitled'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Code</span>
                <span className="font-mono font-bold text-indigo-300">{code}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Questions</span>
                <span className="font-bold text-slate-200">
                  {sections.reduce((c, s) => c + s.questions.length, 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Marks</span>
                <span className="font-bold text-emerald-400">{totalMarks}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Immediate Result</span>
                <span className={`font-bold ${showImmediateResults ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {showImmediateResults ? 'Published' : 'Withheld'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">2-Min Violation Block</span>
                <span className={`font-bold ${antiCheating.enableTwoMinuteViolationBlock ? 'text-rose-400' : 'text-slate-400'}`}>
                  {antiCheating.enableTwoMinuteViolationBlock
                    ? `Enabled (>${antiCheating.maxTabSwitches} threshold)`
                    : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setActiveStep(2)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Back to Questions
            </button>

            <div className="flex items-center gap-3">
              <button
                disabled={isSubmitting}
                onClick={() => handleSaveAssessment('draft')}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              >
                Save as Draft
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => handleSaveAssessment('published')}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm shadow-indigo-600/30 flex items-center gap-1.5"
              >
                <span>Publish Assessment</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
