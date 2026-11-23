/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Recruiter Dashboard Overview (Dark Theme)
 */

import React, { useState } from 'react';
import { useAssessments } from '../../context/AssessmentContext';
import { useAuth } from '../../context/AuthContext';
import { DashboardTab } from '../../types';
import {
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Plus,
  ArrowRight,
  FileUp,
  Edit3,
  ExternalLink,
  AlertCircle,
  FileCheck2,
  Users,
  Award,
  Sparkles,
} from 'lucide-react';

interface OverviewViewProps {
  onNavigateTab: (tab: DashboardTab) => void;
  onSelectAssessment: (assessmentId: string) => void;
  onOpenCandidatePortalWithCode: (code: string) => void;
  onEditAssessment?: (assessmentId: string) => void;
  onCreateFromScratch?: (enableCodingEnvironment?: boolean) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigateTab,
  onSelectAssessment,
  onOpenCandidatePortalWithCode,
  onEditAssessment,
  onCreateFromScratch,
}) => {
  const { assessments, attempts } = useAssessments();
  const { currentUser } = useAuth();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const totalAssessments = assessments.length;
  const activeAssessments = assessments.filter((a) => a.status === 'published').length;
  const totalCandidates = attempts.length;
  const completedAssessments = attempts.filter((a) => a.status === 'submitted').length;
  const qualifiedCandidates = attempts.filter((a) => a.passed).length;
  const passRate =
    completedAssessments > 0
      ? Math.round((qualifiedCandidates / completedAssessments) * 100)
      : 0;

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const recentAttemptEvents = [...attempts]
    .sort(
      (a, b) =>
        new Date(b.submittedAt || b.startedAt).getTime() -
        new Date(a.submittedAt || a.startedAt).getTime()
    )
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome back, {currentUser?.displayName || 'Recruiter'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {currentUser?.organizationName || 'Organization'} assessment activity, active test codes, and candidate participation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('import')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-200 hover:text-white font-medium text-xs transition-colors"
          >
            <FileUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Import Google Form</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (onCreateFromScratch) {
                onCreateFromScratch(false);
              } else {
                onNavigateTab('create');
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Assessments</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {totalAssessments.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">
              {assessments.filter((a) => a.status === 'draft').length} draft
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Drives</span>
            <div className="p-2 rounded-lg bg-white/10 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {activeAssessments.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-indigo-400">Published</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Candidates</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {totalCandidates.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">Registered</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Qualification Rate</span>
            <div className="p-2 rounded-lg bg-white/10 text-white">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {passRate}%
            </span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {qualifiedCandidates.toLocaleString()} / {completedAssessments.toLocaleString()} passed
            </span>
          </div>
        </div>
      </div>

      {/* Main Workspace Grid: Recent Assessments & Recent Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Recent Assessments (2 Columns) */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Recent Assessments</h2>
              <p className="text-xs text-slate-400">
                Active and draft assessments in your workspace
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('assessments')}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {assessments.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-white">No assessments created yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create a new assessment from scratch or import an existing questionnaire from Google Forms.
              </p>
              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onCreateFromScratch) onCreateFromScratch(false);
                    else onNavigateTab('create');
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  Create Assessment
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('import')}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-colors"
                >
                  Import Google Form
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Assessment</th>
                    <th className="py-3 px-3">Created</th>
                    <th className="py-3 px-3 text-right">Questions</th>
                    <th className="py-3 px-3 text-right">Candidates</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {assessments.slice(0, 6).map((assess) => {
                    const attemptCount = attempts.filter(
                      (a) => a.assessmentId === assess.id || a.assessmentCode === assess.code
                    ).length;
                    const questionCount = assess.sections.reduce(
                      (c, s) => c + s.questions.length,
                      0
                    );
                    const createdDate = assess.createdAt
                      ? new Date(assess.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—';

                    return (
                      <tr
                        key={assess.id}
                        onClick={() => {
                          if (onEditAssessment) onEditAssessment(assess.id);
                          else onSelectAssessment(assess.id);
                        }}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-100 line-clamp-1">
                            {assess.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleCopyCode(assess.code, e)}
                              title="Copy candidate access code"
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-400 hover:underline"
                            >
                              <span>{assess.code}</span>
                              {copiedCode === assess.code ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-500" />
                              )}
                            </button>
                            <span className="text-[11px] text-slate-500">
                              · {assess.durationMinutes} min
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                          {createdDate}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-xs text-slate-200 tabular-nums">
                          {questionCount}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-xs text-slate-200 tabular-nums">
                          {attemptCount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {assess.status === 'published' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-400">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>Published</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs font-medium text-amber-400">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="capitalize">{assess.status}</span>
                            </span>
                          )}
                        </td>
                        <td
                          className="py-3.5 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            {onEditAssessment && (
                              <button
                                type="button"
                                onClick={() => onEditAssessment(assess.id)}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-colors inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3 text-slate-400" />
                                <span>Edit</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenCandidatePortalWithCode(assess.code)}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition-colors inline-flex items-center gap-1"
                            >
                              <span>Launch</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Recent Submissions */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Recent Submissions</h2>
              <p className="text-xs text-slate-400">Latest candidate evaluation records</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('candidates')}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              All candidates
            </button>
          </div>

          {recentAttemptEvents.length === 0 ? (
            <div className="p-8 text-center space-y-1.5">
              <p className="text-xs font-semibold text-slate-200">No submissions recorded yet</p>
              <p className="text-xs text-slate-400">
                Candidate submissions and scores will appear here as soon as tests are completed.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {recentAttemptEvents.map((att) => (
                <div
                  key={att.id}
                  onClick={() => onNavigateTab('candidates')}
                  className="px-5 py-3.5 hover:bg-slate-800/40 cursor-pointer transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {att.candidate?.name || 'Candidate'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      <span className="font-mono text-indigo-400">{att.assessmentCode}</span>
                      {' · '}
                      <span>{att.candidate?.college || att.candidate?.email}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold text-white tabular-nums">
                      {att.score}/{att.totalMarks} ({att.percentage}%)
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      {att.passed ? (
                        <span className="text-[11px] font-medium text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Qualified
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-rose-400 inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Below cutoff
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
