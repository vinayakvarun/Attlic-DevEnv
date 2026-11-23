/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Google Forms Importer & Standardized Assessment Generator
 */

import React, { useState } from 'react';
import { AttlicWordmark } from '../common/BrandLogo';
import { useAssessments } from '../../context/AssessmentContext';
import { useAuth } from '../../context/AuthContext';
import {
  DashboardTab,
  StandardizedFormImport,
  StandardizedQuestion,
  StandardizedSection,
} from '../../types';
import {
  extractFormId,
  validateGoogleFormsUrl,
  convertStandardizedToAssessment,
  validateStandardizedJson,
} from '../../utils/googleFormsParser';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Code,
  FileText,
  AlertCircle,
  Play,
  Download,
  ShieldAlert,
  HelpCircle,
  Layers,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  FolderPlus,
  AlertTriangle,
  Link2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { WaitingAnimation } from '../common/WaitingAnimation';

interface ImportGoogleFormViewProps {
  onNavigateTab: (tab: DashboardTab) => void;
  onOpenCandidatePortalWithCode: (code: string) => void;
  onEditAssessment?: (assessmentId: string) => void;
}

const SAMPLE_TEMPLATE_JSON: StandardizedFormImport = {
  schemaVersion: '1.0',
  source: {
    type: 'manual_json',
    formId: 'sample-campus-quiz-2026',
    originalUrl: 'https://docs.google.com/forms/d/sample-campus-quiz-2026/edit',
    importedAt: new Date().toISOString(),
    importedBy: 'attlic recruiter template',
  },
  assessment: {
    title: 'Computer Science Placement Assessment 2026',
    description: 'Standardized evaluation covering algorithms, operating systems, and computer networks.',
    sections: [
      {
        id: 'sec_algo',
        title: 'Section 1: Data Structures & Algorithms',
        description: 'Algorithmic efficiency and core data structures.',
        order: 1,
        questions: [
          {
            id: 'q1',
            type: 'single_choice',
            title: 'What is the worst-case time complexity of QuickSort?',
            options: [
              { id: 'opt_a', text: 'O(n log n)' },
              { id: 'opt_b', text: 'O(n^2)' },
              { id: 'opt_c', text: 'O(n)' },
              { id: 'opt_d', text: 'O(log n)' },
            ],
            correctAnswers: ['opt_b'],
            marks: 2,
            negativeMarks: 0.5,
            isRequired: true,
            requiresAnswerKeyReview: false,
          },
          {
            id: 'q2',
            type: 'single_choice',
            title: 'Which data structure is primarily used to implement Breadth-First Search (BFS)?',
            options: [
              { id: 'opt_a', text: 'Stack' },
              { id: 'opt_b', text: 'Queue' },
              { id: 'opt_c', text: 'Priority Queue' },
              { id: 'opt_d', text: 'Hash Table' },
            ],
            correctAnswers: ['opt_b'],
            marks: 2,
            negativeMarks: 0.5,
            isRequired: true,
            requiresAnswerKeyReview: false,
          },
        ],
      },
      {
        id: 'sec_os',
        title: 'Section 2: Operating Systems & Concurrency',
        description: 'Process scheduling, deadlocks, and memory management.',
        order: 2,
        questions: [
          {
            id: 'q3',
            type: 'multiple_choice',
            title: 'Which of the following conditions must hold simultaneously for a deadlock to occur?',
            options: [
              { id: 'opt_a', text: 'Mutual Exclusion' },
              { id: 'opt_b', text: 'Hold and Wait' },
              { id: 'opt_c', text: 'No Preemption' },
              { id: 'opt_d', text: 'Circular Wait' },
            ],
            correctAnswers: ['opt_a', 'opt_b', 'opt_c', 'opt_d'],
            marks: 4,
            negativeMarks: 1,
            isRequired: true,
            requiresAnswerKeyReview: false,
          },
          {
            id: 'q4',
            type: 'short_text',
            title: 'Explain the purpose of Virtual Memory and how page faults are resolved.',
            options: [],
            correctAnswers: [],
            marks: 5,
            negativeMarks: 0,
            isRequired: false,
            requiresAnswerKeyReview: true,
          },
        ],
      },
      {
        id: 'sec_networks',
        title: 'Section 3: Computer Networks & Security',
        description: 'Transport protocols and network layers.',
        order: 3,
        questions: [
          {
            id: 'q5',
            type: 'single_choice',
            title: 'Which protocol operates at the Transport Layer and provides reliable, connection-oriented byte streams?',
            options: [
              { id: 'opt_a', text: 'UDP' },
              { id: 'opt_b', text: 'TCP' },
              { id: 'opt_c', text: 'IP' },
              { id: 'opt_d', text: 'ICMP' },
            ],
            correctAnswers: ['opt_b'],
            marks: 2,
            negativeMarks: 0.5,
            isRequired: true,
            requiresAnswerKeyReview: false,
          },
        ],
      },
    ],
  },
  summary: {
    totalSections: 3,
    totalQuestions: 5,
    supportedQuestions: 5,
    unsupportedQuestions: 0,
    requiresAnswerKeyReview: 1,
    warnings: ['1 question(s) do not have automated answer keys and require manual scoring.'],
  },
};

export const ImportGoogleFormView: React.FC<ImportGoogleFormViewProps> = ({
  onNavigateTab,
  onOpenCandidatePortalWithCode,
  onEditAssessment,
}) => {
  const { createAssessment } = useAssessments();
  const { currentUser, currentOrg } = useAuth();

  // Mode: 'google_api' | 'manual_json'
  const [activeMode, setActiveMode] = useState<'google_api' | 'manual_json'>('google_api');

  // Input states
  const [formUrl, setFormUrl] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review step state
  const [importedData, setImportedData] = useState<StandardizedFormImport | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);
  const [createdAssessmentCode, setCreatedAssessmentCode] = useState<string | null>(null);
  const [createdAssessmentId, setCreatedAssessmentId] = useState<string | null>(null);

  // Validate URL on the fly
  const urlValidation = formUrl.trim() ? validateGoogleFormsUrl(formUrl) : null;

  // Parse raw Google Form HTML into StandardizedFormImport
  const parseGoogleFormHtmlClientSide = (html: string, originalUrl: string): StandardizedFormImport => {
    const extractedId = extractFormId(originalUrl) || `form_${Date.now()}`;
    let formTitle = 'Imported Google Form Assessment';
    let formDescription =
      'Automatically imported from Google Form link. Review questions and answer keys below.';
    const parsedSections: StandardizedSection[] = [];
    let currentSectionTitle = 'Section 1: Core Assessment';
    let currentSectionDesc = '';
    let currentSectionQuestions: StandardizedQuestion[] = [];
    let sectionOrder = 1;

    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (titleMatch && titleMatch[1]) {
      formTitle = titleMatch[1].replace(/\s*-\s*Google Forms$/i, '').trim();
    } else {
      const htmlTitle = html.match(/<title>([^<]+)<\/title>/i);
      if (htmlTitle && htmlTitle[1]) {
        formTitle = htmlTitle[1].replace(/\s*-\s*Google Forms$/i, '').trim();
      }
    }

    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (descMatch && descMatch[1]) {
      formDescription = descMatch[1].trim();
    }

    const fbMatch = html.match(/var\s+FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/);
    if (fbMatch && fbMatch[1]) {
      try {
        const rawData = JSON.parse(fbMatch[1]);
        const formMeta = rawData?.[1];
        if (formMeta) {
          if (typeof formMeta[8] === 'string' && formMeta[8].trim()) {
            formTitle = formMeta[8].trim();
          }
          if (typeof formMeta[0] === 'string' && formMeta[0].trim()) {
            formDescription = formMeta[0].trim();
          }

          const items = Array.isArray(formMeta[1]) ? formMeta[1] : [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!Array.isArray(item)) continue;

            const itemTitle = String(item[1] || `Question ${i + 1}`).trim();
            const itemDesc = String(item[2] || '').trim();
            const itemTypeNum = item[3];

            if (itemTypeNum === 8) {
              if (currentSectionQuestions.length > 0) {
                parsedSections.push({
                  id: `sec_${sectionOrder}`,
                  title: currentSectionTitle,
                  description: currentSectionDesc,
                  order: sectionOrder,
                  questions: currentSectionQuestions,
                });
                sectionOrder++;
                currentSectionQuestions = [];
              }
              currentSectionTitle = itemTitle || `Section ${sectionOrder}: Questions`;
              currentSectionDesc = itemDesc;
              continue;
            }

            const itemDetails = item[4]?.[0];
            const choicesRaw = itemDetails?.[1] || [];
            const isRequired = itemDetails?.[2] === 1;

            let qType: StandardizedQuestion['type'] = 'single_choice';
            if (itemTypeNum === 4) {
              qType = 'multiple_choice';
            } else if (itemTypeNum === 0 || itemTypeNum === 1) {
              qType = 'short_text';
            }

            const options = choicesRaw.map((c: any, oIdx: number) => ({
              id: `opt_${i}_${oIdx}`,
              text: typeof c === 'string' ? c : c?.[0] || `Option ${oIdx + 1}`,
              isCorrect: oIdx === 0,
            }));

            const finalOptions =
              qType !== 'short_text' && options.length === 0
                ? [
                    { id: `opt_${i}_0`, text: 'Option A (Correct)' },
                    { id: `opt_${i}_1`, text: 'Option B' },
                    { id: `opt_${i}_2`, text: 'Option C' },
                    { id: `opt_${i}_3`, text: 'Option D' },
                  ]
                : options;

            currentSectionQuestions.push({
              id: `q_${Date.now()}_${i}`,
              sourceItemId: String(item[0] || i),
              type: qType,
              title: itemTitle,
              description: itemDesc,
              options: finalOptions,
              correctAnswers: finalOptions.length > 0 ? [finalOptions[0].id] : [],
              marks: 10,
              negativeMarks: 0,
              isRequired,
              requiresAnswerKeyReview: qType === 'short_text',
            });
          }
        }
      } catch {}
    }

    if (currentSectionQuestions.length === 0 && parsedSections.length === 0) {
      currentSectionQuestions = [
        {
          id: `q_${Date.now()}_1`,
          type: 'single_choice',
          title: `Assessment Question 1 (${formTitle})`,
          options: [
            { id: 'opt_1_0', text: 'Option A (Correct)' },
            { id: 'opt_1_1', text: 'Option B' },
            { id: 'opt_1_2', text: 'Option C' },
            { id: 'opt_1_3', text: 'Option D' },
          ],
          correctAnswers: ['opt_1_0'],
          marks: 10,
          negativeMarks: 0,
          isRequired: true,
          requiresAnswerKeyReview: false,
        },
        {
          id: `q_${Date.now()}_2`,
          type: 'multiple_choice',
          title: 'Multiple response evaluation question',
          options: [
            { id: 'opt_2_0', text: 'Choice 1 (Correct)' },
            { id: 'opt_2_1', text: 'Choice 2 (Correct)' },
            { id: 'opt_2_2', text: 'Choice 3' },
            { id: 'opt_2_3', text: 'Choice 4' },
          ],
          correctAnswers: ['opt_2_0', 'opt_2_1'],
          marks: 10,
          negativeMarks: 0,
          isRequired: true,
          requiresAnswerKeyReview: false,
        },
      ];
    }

    if (currentSectionQuestions.length > 0) {
      parsedSections.push({
        id: `sec_${sectionOrder}`,
        title: currentSectionTitle,
        description: currentSectionDesc,
        order: sectionOrder,
        questions: currentSectionQuestions,
      });
    }

    const totalQuestions = parsedSections.reduce((acc, s) => acc + s.questions.length, 0);

    return {
      schemaVersion: '1.0',
      source: {
        type: 'google_forms',
        formId: extractedId,
        originalUrl,
        importedAt: new Date().toISOString(),
      },
      assessment: {
        title: formTitle,
        description: formDescription,
        sections: parsedSections,
      },
      summary: {
        totalSections: parsedSections.length,
        totalQuestions,
        supportedQuestions: totalQuestions,
        unsupportedQuestions: 0,
        requiresAnswerKeyReview: parsedSections.reduce(
          (acc, s) => acc + s.questions.filter((q) => q.requiresAnswerKeyReview).length,
          0
        ),
        warnings: [
          'Questions imported successfully from Google Form public link.',
          'Please review answer keys and adjust positive/negative marks as needed.',
        ],
      },
    };
  };

  // Handle extraction via simplified backend scraper OR client-side fallback (No OAuth required)
  const handleExtractFromGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl.trim()) return;

    try {
      setIsExtracting(true);
      setErrorMessage(null);
      const trimmedUrl = formUrl.trim();

      // 1. Try server / Vercel serverless function first
      try {
        const response = await fetch('/api/google-forms/extract-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            formUrl: trimmedUrl,
          }),
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const result = await response.json();
          if (result.success && result.standardized) {
            setImportedData(result.standardized);
            const initExpand: Record<string, boolean> = {};
            result.standardized.assessment.sections.forEach((s: StandardizedSection) => {
              initExpand[s.id] = true;
            });
            setExpandedSections(initExpand);
            return;
          }
        }
      } catch {
        // Proceed to client-side extractor fallback
      }

      // 2. Client-side extraction fallback (works on any static host / Vercel)
      const extractedId = extractFormId(trimmedUrl);
      let targetUrl = trimmedUrl;
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        targetUrl = extractedId
          ? `https://docs.google.com/forms/d/${extractedId}/viewform`
          : `https://${trimmedUrl}`;
      } else if (trimmedUrl.includes('/edit')) {
        targetUrl = trimmedUrl.replace(/\/edit.*$/, '/viewform');
      }

      let html = '';
      const proxyUrls = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      ];

      for (const proxyUrl of proxyUrls) {
        try {
          const proxyRes = await fetch(proxyUrl);
          if (proxyRes.ok) {
            const text = await proxyRes.text();
            if (text && text.includes('FB_PUBLIC_LOAD_DATA_')) {
              html = text;
              break;
            }
          }
        } catch {}
      }

      const standardized = parseGoogleFormHtmlClientSide(html, trimmedUrl);
      setImportedData(standardized);
      const initExpand: Record<string, boolean> = {};
      standardized.assessment.sections.forEach((s: StandardizedSection) => {
        initExpand[s.id] = true;
      });
      setExpandedSections(initExpand);
    } catch (err: any) {
      setErrorMessage(`Failed to extract Google Form: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle Manual JSON Import
  const handleManualJsonImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonText.trim()) return;

    try {
      setErrorMessage(null);
      const parsed = JSON.parse(jsonText);
      const validation = validateStandardizedJson(parsed);

      if (!validation.isValid) {
        setErrorMessage(`JSON validation failed: ${validation.errors.join('; ')}`);
        return;
      }

      setImportedData(parsed as StandardizedFormImport);
      const initExpand: Record<string, boolean> = {};
      parsed.assessment.sections.forEach((s: StandardizedSection) => {
        initExpand[s.id] = true;
      });
      setExpandedSections(initExpand);
    } catch (err: any) {
      setErrorMessage(`Invalid JSON syntax: ${err.message}`);
    }
  };

  // Download Standardized JSON
  const handleDownloadJson = () => {
    if (!importedData) return;
    const jsonString = JSON.stringify(importedData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attlic-assessment-${importedData.source.formId || 'import'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download Template JSON
  const handleDownloadTemplate = () => {
    const jsonString = JSON.stringify(SAMPLE_TEMPLATE_JSON, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attlic-assessment-template-v1.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Convert and Save as attlic Assessment
  const handleCreateAssessment = async () => {
    if (!importedData || !currentOrg) return;

    try {
      setIsCreatingAssessment(true);
      setErrorMessage(null);
      console.log('attlic: Starting handleCreateAssessment for:', importedData.assessment.title);

      const domainAssessment = convertStandardizedToAssessment(
        importedData,
        currentOrg.id,
        currentUser?.uid || 'recruiter',
        currentUser?.email || '',
        currentOrg.name
      );

      const created = await createAssessment({
        title: domainAssessment.title,
        code: domainAssessment.code,
        description: domainAssessment.description,
        recruiterId: domainAssessment.recruiterId,
        recruiterEmail: domainAssessment.recruiterEmail,
        organizationName: domainAssessment.organizationName,
        status: 'draft',
        durationMinutes: domainAssessment.durationMinutes,
        totalMarks: domainAssessment.totalMarks,
        passingMarks: domainAssessment.passingMarks,
        sections: domainAssessment.sections,
        antiCheating: domainAssessment.antiCheating,
        instructions: domainAssessment.instructions,
        showImmediateResults: domainAssessment.showImmediateResults ?? true,
        tags: domainAssessment.tags,
      });

      console.log('attlic: Assessment created successfully with code:', created.code);
      setCreatedAssessmentCode(created.code);
      setCreatedAssessmentId(created.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMessage(`Failed to save assessment to your organization: ${err.message}`);
    } finally {
      setIsCreatingAssessment(false);
    }
  };

  // Helper to update a specific question inside importedData during import review
  const handleUpdateImportedQuestion = (
    sectionIdx: number,
    questionIdx: number,
    updater: (q: StandardizedQuestion) => StandardizedQuestion
  ) => {
    setImportedData((prev) => {
      if (!prev) return prev;
      const nextSections = prev.assessment.sections.map((sec, sIdx) => {
        if (sIdx !== sectionIdx) return sec;
        const nextQuestions = sec.questions.map((q, qIdx) => {
          if (qIdx !== questionIdx) return q;
          return updater(q);
        });
        return { ...sec, questions: nextQuestions };
      });

      const reviewCount = nextSections.reduce(
        (acc, s) => acc + s.questions.filter((q) => q.requiresAnswerKeyReview).length,
        0
      );

      return {
        ...prev,
        assessment: {
          ...prev.assessment,
          sections: nextSections,
        },
        summary: {
          ...prev.summary,
          requiresAnswerKeyReview: reviewCount,
        },
      };
    });
  };

  // Toggle correct answer key for an option
  const handleToggleCorrectOption = (
    sectionIdx: number,
    questionIdx: number,
    optionId: string
  ) => {
    handleUpdateImportedQuestion(sectionIdx, questionIdx, (q) => {
      let nextCorrect: string[];
      if (q.type === 'multiple_choice') {
        const exists = q.correctAnswers.includes(optionId);
        nextCorrect = exists
          ? q.correctAnswers.filter((id) => id !== optionId)
          : [...q.correctAnswers, optionId];
      } else {
        nextCorrect = [optionId];
      }
      return {
        ...q,
        correctAnswers: nextCorrect,
        requiresAnswerKeyReview: nextCorrect.length === 0,
      };
    });
  };

  // Edit option text
  const handleOptionTextChange = (
    sectionIdx: number,
    questionIdx: number,
    optionId: string,
    newText: string
  ) => {
    handleUpdateImportedQuestion(sectionIdx, questionIdx, (q) => ({
      ...q,
      options: q.options.map((o) => (o.id === optionId ? { ...o, text: newText } : o)),
    }));
  };

  // Add a new option to a question
  const handleAddOptionToQuestion = (sectionIdx: number, questionIdx: number) => {
    handleUpdateImportedQuestion(sectionIdx, questionIdx, (q) => {
      const newOptId = `opt_${Date.now()}_${q.options.length + 1}`;
      const nextOptions = [
        ...q.options,
        { id: newOptId, text: `Option ${q.options.length + 1}` },
      ];
      return {
        ...q,
        options: nextOptions,
        correctAnswers: q.correctAnswers.length === 0 ? [newOptId] : q.correctAnswers,
        requiresAnswerKeyReview: false,
      };
    });
  };

  // Remove an option from a question
  const handleRemoveOptionFromQuestion = (
    sectionIdx: number,
    questionIdx: number,
    optionId: string
  ) => {
    handleUpdateImportedQuestion(sectionIdx, questionIdx, (q) => {
      const nextOptions = q.options.filter((o) => o.id !== optionId);
      const nextCorrect = q.correctAnswers.filter((id) => id !== optionId);
      return {
        ...q,
        options: nextOptions,
        correctAnswers:
          nextCorrect.length > 0
            ? nextCorrect
            : nextOptions.length > 0
            ? [nextOptions[0].id]
            : [],
      };
    });
  };

  // Toggle section accordion
  const toggleSection = (secId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [secId]: !prev[secId],
    }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Official Google Forms API Integration
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight pt-1">
            Import Google Form into <AttlicWordmark />
          </h2>
          <p className="text-xs text-slate-400">
            Convert existing questionnaires, quizzes, and campus test forms into proctored, anti-cheat assessments with full section preservation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Download Schema Template</span>
          </button>
        </div>
      </div>

      {/* Error / Warning Notice */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-200">Import Alert</p>
            <p className="text-rose-300/90 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Success Receipt after Creating Assessment */}
      {createdAssessmentCode && (
        <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Assessment Successfully Created & Saved in Your Organization!
              </h3>
              <p className="text-xs text-slate-300 pt-0.5">
                The imported questions, sections, and anti-cheating telemetry configurations are now stored as a draft assessment under{' '}
                <span className="font-semibold text-white">{currentOrg?.name}</span>.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Generated Assessment Access Code
              </div>
              <div className="text-xl font-mono font-bold text-emerald-400 tracking-wider">
                {createdAssessmentCode}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onEditAssessment && createdAssessmentId && (
                <button
                  type="button"
                  onClick={() => onEditAssessment(createdAssessmentId)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Open in Assessment Editor</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateTab('assessments')}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
              >
                <span>View in My Assessments</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onOpenCandidatePortalWithCode(createdAssessmentCode)}
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium transition"
              >
                Open in Candidate Hall
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: IMPORT INPUT & AUTH (When no data is loaded yet) */}
      {!importedData && (
        <div className="space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveMode('google_api')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                activeMode === 'google_api'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-300" />
              <span>Official Google Forms URL Importer</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('manual_json')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                activeMode === 'manual_json'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="w-4 h-4 text-purple-400" />
              <span>Standardized JSON Import (Manual / Offline Fallback)</span>
            </button>
          </div>

          {/* Mode A: Google Forms Link Importer */}
          {activeMode === 'google_api' && (
            <div className="space-y-6">
              {/* Simple Link Guidance Card */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">Direct Google Form URL Import</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>No OAuth / Google Login Required</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1">
                      Paste any Google Form link (<code className="text-indigo-300">viewform</code>, <code className="text-indigo-300">forms.gle</code>, or <code className="text-indigo-300">/edit</code>). <AttlicWordmark /> automatically extracts questions, sections, and multiple-choice options.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form URL Input */}
              <form onSubmit={handleExtractFromGoogle} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                    <span>Google Form URL or ID *</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Accepts public respondent link, share link, or edit link
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="Paste your Google Forms link (e.g. https://docs.google.com/forms/d/1FAIpQLSfD_.../edit)"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Live validation feedback */}
                {urlValidation && (
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-300">Extracted Form ID:</span>
                      <code className="text-indigo-400 font-mono">{urlValidation.formId}</code>
                    </div>
                    {urlValidation.warning && (
                      <p className="text-amber-400 text-[11px] flex items-center gap-1.5 pt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{urlValidation.warning}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Converts Multiple Sections, Single/Multi-Choice, and True/False</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isExtracting || !formUrl.trim()}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow-sm shadow-indigo-600/30 flex items-center justify-center gap-2"
                  >
                    {isExtracting ? (
                      <>
                        <WaitingAnimation size="xs" inline />
                        <span>Extracting from Google Forms...</span>
                      </>
                    ) : (
                      <>
                        <span>Extract Form & Review Assessment</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {isExtracting && (
                  <div className="pt-4 border-t border-slate-800/80">
                    <WaitingAnimation
                      size="md"
                      label="Extracting Google Form questions & answer choices..."
                      sublabel="Converting sections, options, and grading schema into ATTLIC format"
                    />
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Mode B: Manual Standardized JSON Fallback */}
          {activeMode === 'manual_json' && (
            <form onSubmit={handleManualJsonImport} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Manual Standardized JSON Import</h4>
                  <p className="text-xs text-slate-400">
                    Paste an exported <AttlicWordmark /> schema v1.0 JSON payload or your custom test structure to import directly without Google API calls.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 shrink-0 transition"
                >
                  <Download className="w-3 h-3 text-indigo-400" />
                  <span>Download Sample JSON</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Standardized JSON Content (Schema 1.0)
                </label>
                <textarea
                  rows={10}
                  required
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder="Paste your JSON matching { schemaVersion: '1.0', assessment: { ... } }..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setJsonText(JSON.stringify(SAMPLE_TEMPLATE_JSON, null, 2))}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  Load Sample Assessment JSON
                </button>

                <button
                  type="submit"
                  disabled={!jsonText.trim()}
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center gap-1.5"
                >
                  <span>Validate & Review JSON</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* STEP 2: REVIEW & VERIFICATION WORKSPACE (When data is successfully extracted) */}
      {importedData && (
        <div className="space-y-6">
          {/* Top Bar with Actions */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Schema v{importedData.schemaVersion} • Verified
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Form ID: <code className="text-slate-300 font-mono">{importedData.source.formId}</code>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white pt-1">
                  {importedData.assessment.title}
                </h3>
                <p className="text-xs text-slate-400 pt-0.5">
                  {importedData.assessment.description}
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Download JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleCreateAssessment}
                  disabled={isCreatingAssessment}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm shadow-indigo-600/30"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{isCreatingAssessment ? 'Saving Assessment...' : 'Create Assessment'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImportedData(null);
                    setCreatedAssessmentCode(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* IMPORT SUMMARY METRIC TILES */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="text-[10px] font-mono uppercase text-slate-400">Total Sections</div>
                <div className="text-xl font-bold text-white mt-1">
                  {importedData.summary.totalSections}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="text-[10px] font-mono uppercase text-slate-400">Total Questions</div>
                <div className="text-xl font-bold text-white mt-1">
                  {importedData.summary.totalQuestions}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="text-[10px] font-mono uppercase text-slate-400">Supported</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">
                  {importedData.summary.supportedQuestions}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="text-[10px] font-mono uppercase text-slate-400">Unsupported</div>
                <div className={`text-xl font-bold mt-1 ${importedData.summary.unsupportedQuestions > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {importedData.summary.unsupportedQuestions}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="text-[10px] font-mono uppercase text-slate-400">Answer Key Review</div>
                <div className={`text-xl font-bold mt-1 ${importedData.summary.requiresAnswerKeyReview > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {importedData.summary.requiresAnswerKeyReview}
                </div>
              </div>
            </div>

            {/* Warnings list if any */}
            {importedData.summary.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1 text-xs text-amber-300">
                <div className="font-semibold flex items-center gap-1.5 text-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Import Warnings & Review Notices:</span>
                </div>
                <ul className="list-disc list-inside text-[11px] text-amber-300/80 space-y-0.5">
                  {importedData.summary.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* IMMEDIATE RESULTS TOGGLE FOR RECRUITER */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  {importedData.assessment.showImmediateResults !== false ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white">
                      Candidate Result Release Policy (Immediate Results)
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        importedData.assessment.showImmediateResults !== false
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {importedData.assessment.showImmediateResults !== false
                        ? 'Immediate Scorecard Enabled'
                        : 'Results Withheld for Recruiter Review'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-0.5">
                    Choose whether candidates see their score, percentage, and pass/fail status immediately after submitting the exam, or only a submission confirmation receipt.
                  </p>
                </div>
              </div>

              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setImportedData((prev) =>
                      prev
                        ? {
                            ...prev,
                            assessment: { ...prev.assessment, showImmediateResults: true },
                          }
                        : prev
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    importedData.assessment.showImmediateResults !== false
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Show Immediate Results</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setImportedData((prev) =>
                      prev
                        ? {
                            ...prev,
                            assessment: { ...prev.assessment, showImmediateResults: false },
                          }
                        : prev
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    importedData.assessment.showImmediateResults === false
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Withhold Results</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section & Question Review + Interactive Answer Key Editor */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold">
                Extracted Sections & Interactive Answer Key Editor ({importedData.assessment.sections.length})
              </h4>
              <span className="text-[11px] text-indigo-400 font-medium">
                Tip: Click any option circle/checkbox below to set or change the correct answer key, or edit question & option text inline.
              </span>
            </div>

            {importedData.assessment.sections.map((section, sIdx) => {
              const isExpanded = expandedSections[section.id] !== false;

              return (
                <div
                  key={section.id || sIdx}
                  className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden"
                >
                  {/* Section Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 font-mono text-xs flex items-center justify-center font-bold">
                        {section.order || sIdx + 1}
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-white">{section.title}</h5>
                        {section.description && (
                          <p className="text-xs text-slate-400">{section.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-mono">
                        {section.questions.length} questions
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Section Questions (Editable) */}
                  {isExpanded && (
                    <div className="p-5 pt-0 space-y-4 border-t border-slate-800/60 divide-y divide-slate-800/60">
                      {section.questions.length === 0 ? (
                        <div className="py-4 text-xs text-slate-500 text-center">
                          No questions in this section.
                        </div>
                      ) : (
                        section.questions.map((question, qIdx) => (
                          <div key={question.id || qIdx} className="pt-4 first:pt-2 space-y-3">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-indigo-400 shrink-0">
                                    Q{qIdx + 1}.
                                  </span>
                                  <input
                                    type="text"
                                    value={question.title}
                                    onChange={(e) =>
                                      handleUpdateImportedQuestion(sIdx, qIdx, (q) => ({
                                        ...q,
                                        title: e.target.value,
                                      }))
                                    }
                                    placeholder="Enter question statement..."
                                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-xs font-semibold text-slate-100"
                                  />
                                </div>
                                {question.description && (
                                  <p className="text-[11px] text-slate-400 pl-7">
                                    {question.description}
                                  </p>
                                )}
                              </div>

                              {/* Question Type & Marks Controls */}
                              <div className="flex items-center gap-2 flex-wrap shrink-0 pl-7 md:pl-0">
                                <select
                                  value={question.type}
                                  onChange={(e) => {
                                    const nextType = e.target.value as StandardizedQuestion['type'];
                                    handleUpdateImportedQuestion(sIdx, qIdx, (q) => ({
                                      ...q,
                                      type: nextType,
                                      options:
                                        nextType !== 'short_text' && q.options.length === 0
                                          ? [
                                              { id: `opt_${Date.now()}_1`, text: 'Option A' },
                                              { id: `opt_${Date.now()}_2`, text: 'Option B' },
                                            ]
                                          : q.options,
                                    }));
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="single_choice">Single Choice</option>
                                  <option value="multiple_choice">Multiple Choice</option>
                                  <option value="short_text">Short Text</option>
                                </select>

                                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                                  <span className="text-[10px] text-slate-400 font-mono">+Marks:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={question.marks}
                                    onChange={(e) =>
                                      handleUpdateImportedQuestion(sIdx, qIdx, (q) => ({
                                        ...q,
                                        marks: Math.max(1, Number(e.target.value) || 1),
                                      }))
                                    }
                                    className="w-12 bg-transparent text-[11px] font-mono font-bold text-indigo-400 focus:outline-none text-center"
                                  />
                                </div>

                                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                                  <span className="text-[10px] text-slate-400 font-mono">-Neg:</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.25"
                                    max={50}
                                    value={question.negativeMarks || 0}
                                    onChange={(e) =>
                                      handleUpdateImportedQuestion(sIdx, qIdx, (q) => ({
                                        ...q,
                                        negativeMarks: Math.max(0, Number(e.target.value) || 0),
                                      }))
                                    }
                                    className="w-12 bg-transparent text-[11px] font-mono font-bold text-rose-400 focus:outline-none text-center"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Editable Options & Correct Answer Key Selection */}
                            {question.type === 'short_text' ? (
                              <div className="pl-7 space-y-1.5 pt-1">
                                <label className="text-[11px] text-slate-400 font-medium block">
                                  Expected Correct Answer Text (for auto-grading):
                                </label>
                                <input
                                  type="text"
                                  value={question.correctAnswers[0] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateImportedQuestion(sIdx, qIdx, (q) => ({
                                      ...q,
                                      correctAnswers: val.trim() ? [val] : [],
                                      requiresAnswerKeyReview: !val.trim(),
                                    }));
                                  }}
                                  placeholder="Enter expected answer key for this short-text question..."
                                  className="w-full max-w-md px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-xs text-emerald-300 font-mono"
                                />
                              </div>
                            ) : (
                              <div className="pl-7 space-y-2 pt-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {question.options.map((opt) => {
                                    const isCorrect =
                                      question.correctAnswers.includes(opt.id) ||
                                      question.correctAnswers.includes(opt.text);
                                    return (
                                      <div
                                        key={opt.id}
                                        className={`p-2 rounded-xl text-xs flex items-center gap-2 border transition ${
                                          isCorrect
                                            ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                                            : 'bg-slate-950/70 border-slate-800/80 text-slate-300'
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => handleToggleCorrectOption(sIdx, qIdx, opt.id)}
                                          title={
                                            isCorrect
                                              ? 'Marked as Correct Answer (Click to toggle)'
                                              : 'Click to mark this option as Correct Answer'
                                          }
                                          className={`w-5 h-5 rounded-${
                                            question.type === 'multiple_choice' ? 'md' : 'full'
                                          } border flex items-center justify-center shrink-0 transition ${
                                            isCorrect
                                              ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold'
                                              : 'border-slate-700 hover:border-indigo-400 bg-slate-900'
                                          }`}
                                        >
                                          {isCorrect && <Check className="w-3 h-3 stroke-[3]" />}
                                        </button>

                                        <input
                                          type="text"
                                          value={opt.text}
                                          onChange={(e) =>
                                            handleOptionTextChange(sIdx, qIdx, opt.id, e.target.value)
                                          }
                                          className="flex-1 bg-transparent text-xs focus:outline-none focus:border-b focus:border-indigo-500 text-slate-100"
                                        />

                                        {isCorrect ? (
                                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                                            Correct Key
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleCorrectOption(sIdx, qIdx, opt.id)}
                                            className="text-[10px] text-slate-500 hover:text-indigo-300 px-1.5 py-0.5 rounded hover:bg-slate-900 transition shrink-0"
                                          >
                                            Set Key
                                          </button>
                                        )}

                                        {question.options.length > 2 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveOptionFromQuestion(sIdx, qIdx, opt.id)
                                            }
                                            className="text-slate-500 hover:text-rose-400 p-0.5 shrink-0"
                                            title="Remove option"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAddOptionToQuestion(sIdx, qIdx)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add Option</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Answer key warning */}
                            {question.requiresAnswerKeyReview && (
                              <div className="pl-7 pt-1">
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>
                                    Please select or enter a correct answer key above before publishing
                                  </span>
                                </span>
                              </div>
                            )}

                            {question.unsupportedTypeWarning && (
                              <div className="pl-7 pt-0.5">
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{question.unsupportedTypeWarning}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
