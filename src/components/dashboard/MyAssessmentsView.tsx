/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Recruiter Assessments Management View (Dark Theme)
 */

import React, { useState } from 'react';
import { useAssessments } from '../../context/AssessmentContext';
import { Assessment, AssessmentStatus, DashboardTab } from '../../types';
import {
  Plus,
  Search,
  Copy,
  Check,
  Clock,
  FileText,
  Play,
  Trash2,
  Copy as DuplicateIcon,
  CheckCircle2,
  Edit3,
  FileUp,
  Users,
  Layers,
} from 'lucide-react';

interface MyAssessmentsViewProps {
  onNavigateTab: (tab: DashboardTab) => void;
  onOpenCandidatePortalWithCode: (code: string) => void;
  onEditAssessment?: (assessmentId: string) => void;
  onCreateFromScratch?: (enableCodingEnvironment?: boolean) => void;
}

export const MyAssessmentsView: React.FC<MyAssessmentsViewProps> = ({
  onNavigateTab,
  onOpenCandidatePortalWithCode,
  onEditAssessment,
  onCreateFromScratch,
}) => {
  const {
    assessments,
    publishAssessment,
    deleteAssessment,
    createAssessment,
    createDraftAssessment,
    attempts,
  } = useAssessments();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AssessmentStatus | 'all'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filtered = assessments.filter((item) => {
    const matchesSearch =
      (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDuplicate = async (original: Assessment) => {
    const duplicateData: Omit<Assessment, 'id' | 'createdAt' | 'updatedAt' | 'version'> = {
      ...original,
      title: `${original.title} (Copy)`,
      code: `COPY-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'draft',
    };
    await createAssessment(duplicateData);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My Assessments</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage assessment configurations, candidate access codes, question sets, and publication status.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('import')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-indigo-500/40 transition-colors"
          >
            <FileUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Import Form / JSON</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (onCreateFromScratch) {
                onCreateFromScratch();
              } else {
                const draft = await createDraftAssessment();
                if (onEditAssessment) onEditAssessment(draft.id);
                else onNavigateTab('create');
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by assessment title, access code, or tag..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Status Filter Segmented Controls */}
        <div className="flex items-center gap-1 self-start sm:self-auto bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(['all', 'published', 'draft', 'archived'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`px-3 py-1 text-xs rounded-lg capitalize font-medium transition-colors ${
                selectedStatus === status
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Assessments Grid */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mx-auto">
            <FileText className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">No matching assessments</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Adjust your search filter or create a new assessment for your upcoming recruitment drive.
            </p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onNavigateTab('create')}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            >
              Create Assessment
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((item) => {
            const attemptCount = attempts.filter(
              (a) => a.assessmentId === item.id || a.assessmentCode === item.code
            ).length;
            const questionCount = item.sections.reduce(
              (sum, s) => sum + s.questions.length,
              0
            );

            return (
              <div
                key={item.id}
                onClick={() => onEditAssessment && onEditAssessment(item.id)}
                className="group rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/40 p-5 flex flex-col justify-between gap-4 transition-all cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
                    </div>
                    {item.status === 'published' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-semibold text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Published</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-400 shrink-0 capitalize">
                        <Clock className="w-3 h-3" />
                        <span>{item.status}</span>
                      </span>
                    )}
                  </div>

                  {/* Metadata Chips */}
                  <div
                    className="flex flex-wrap items-center gap-2 pt-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleCopyCode(item.code)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 font-mono font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                      title="Copy candidate access code"
                    >
                      <span>Code: {item.code}</span>
                      {copiedCode === item.code ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-indigo-400" />
                      )}
                    </button>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {item.durationMinutes}m
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                      <Layers className="w-3 h-3 text-slate-500" />
                      {questionCount} Qs ({item.totalMarks} pts)
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                      <Users className="w-3 h-3 text-slate-500" />
                      {attemptCount.toLocaleString()} Attempts
                    </span>
                  </div>
                </div>

                {/* Action Bar */}
                <div
                  className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    {onEditAssessment && (
                      <button
                        type="button"
                        onClick={() => onEditAssessment(item.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Edit</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => publishAssessment(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        item.status === 'published'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                      }`}
                    >
                      {item.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenCandidatePortalWithCode(item.code)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Launch</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(item)}
                      title="Duplicate assessment"
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <DuplicateIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAssessment(item.id)}
                      title="Delete assessment"
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
