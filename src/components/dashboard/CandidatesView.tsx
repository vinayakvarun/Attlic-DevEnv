/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Recruiter Candidates Directory & Evaluation Reports (Dark Theme)
 */

import React, { useState, useMemo } from 'react';
import { useAssessments } from '../../context/AssessmentContext';
import { CandidateAttempt, CandidatePipelineStatus } from '../../types';
import {
  triggerCandidateCSVDownload,
  partitionAttemptsForCleanup,
  CANDIDATE_EXPORT_HEADERS,
  extractCandidateExportRows,
} from '../../utils/candidateDataExport';
import { downloadCandidatePdfCertificate } from '../../utils/examFeatures';
import {
  Users,
  Search,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  X,
  FileText,
  Camera,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 50;

export const CandidatesView: React.FC = () => {
  const { attempts, assessments, clearCandidateData } = useAssessments();
  const [search, setSearch] = useState('');
  const [filterResult, setFilterResult] = useState<'all' | 'passed' | 'failed'>('all');
  const [minPercentageFilter, setMinPercentageFilter] = useState<number>(0);
  const [maxViolationsFilter, setMaxViolationsFilter] = useState<string>('any');
  const [pipelineFilter, setPipelineFilter] = useState<'all' | CandidatePipelineStatus>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pipelineOverrides, setPipelineOverrides] = useState<
    Record<string, CandidatePipelineStatus>
  >(() => {
    try {
      const saved = localStorage.getItem('attlic_pipeline_status_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectedAttempt, setSelectedAttempt] = useState<CandidateAttempt | null>(null);

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearScopeAssessmentId, setClearScopeAssessmentId] = useState<string>('all');
  const [hasDownloadedBackupInModal, setHasDownloadedBackupInModal] = useState(false);
  const [lastBackupFilename, setLastBackupFilename] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);
  const [showCsvPreviewModal, setShowCsvPreviewModal] = useState(false);

  const getAttemptPipelineStatus = (attempt: CandidateAttempt): CandidatePipelineStatus => {
    return pipelineOverrides[attempt.id] || attempt.pipelineStatus || 'pending';
  };

  const handleSetPipelineStatus = (attemptId: string, status: CandidatePipelineStatus) => {
    setPipelineOverrides((prev) => {
      const next = { ...prev, [attemptId]: status };
      try {
        localStorage.setItem('attlic_pipeline_status_map', JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return attempts.filter((a) => {
      const matchSearch =
        (a.candidate.name || '').toLowerCase().includes(term) ||
        (a.candidate.email || '').toLowerCase().includes(term) ||
        (a.candidate.college || '').toLowerCase().includes(term) ||
        (a.candidate.rollNumber || '').toLowerCase().includes(term) ||
        (a.assessmentCode || '').toLowerCase().includes(term);

      const matchFilter =
        filterResult === 'all' ||
        (filterResult === 'passed' && a.passed) ||
        (filterResult === 'failed' && !a.passed);

      const matchMinPct = (a.percentage || 0) >= minPercentageFilter;
      const matchViolations =
        maxViolationsFilter === 'any' ||
        (a.tabSwitchCount || 0) <= Number(maxViolationsFilter);

      const status = pipelineOverrides[a.id] || a.pipelineStatus || 'pending';
      const matchPipeline = pipelineFilter === 'all' || status === pipelineFilter;

      return matchSearch && matchFilter && matchMinPct && matchViolations && matchPipeline;
    });
  }, [
    attempts,
    search,
    filterResult,
    minPercentageFilter,
    maxViolationsFilter,
    pipelineFilter,
    pipelineOverrides,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const targetedForCleanup = useMemo(() => {
    return partitionAttemptsForCleanup(attempts, clearScopeAssessmentId).toClear;
  }, [attempts, clearScopeAssessmentId]);

  const exportCSV = (format: 'styled' | 'raw_csv' = 'styled') => {
    const targetList = filtered.length > 0 ? filtered : attempts;
    const filename = triggerCandidateCSVDownload(targetList, 'attlic_candidates_report', format);
    setCleanupNotice(
      format === 'styled'
        ? `Downloaded formatted spreadsheet (${filename}) with bold headings and alternating pastel-orange & white rows.`
        : `Downloaded raw CSV (${filename}).`
    );
    setTimeout(() => setCleanupNotice(null), 5000);
  };

  const handleDownloadCertificateForAttempt = (attempt: CandidateAttempt) => {
    const matchedAssessment = assessments.find(
      (a) => a.id === attempt.assessmentId || a.code === attempt.assessmentCode
    );
    const filename = downloadCandidatePdfCertificate(attempt, matchedAssessment);
    setCleanupNotice(
      `Generated PDF Certificate & Scorecard (${filename}) for ${attempt.candidate.name}.`
    );
    setTimeout(() => setCleanupNotice(null), 5000);
  };

  const handleOpenClearModal = () => {
    setClearScopeAssessmentId('all');
    setHasDownloadedBackupInModal(false);
    setLastBackupFilename(null);
    setShowClearModal(true);
  };

  const handleDownloadBackupOnly = () => {
    if (targetedForCleanup.length === 0) return;
    const scopeSuffix =
      clearScopeAssessmentId === 'all'
        ? 'all_drives'
        : assessments.find((a) => a.id === clearScopeAssessmentId)?.code || 'drive';
    const filename = triggerCandidateCSVDownload(
      targetedForCleanup,
      `attlic_candidates_archive_${scopeSuffix.toLowerCase()}`
    );
    setHasDownloadedBackupInModal(true);
    setLastBackupFilename(filename);
  };

  const handleForceDownloadAndClear = async () => {
    if (targetedForCleanup.length === 0 || isClearing) return;
    setIsClearing(true);

    try {
      let archiveName = lastBackupFilename;
      if (!hasDownloadedBackupInModal || !archiveName) {
        const scopeSuffix =
          clearScopeAssessmentId === 'all'
            ? 'all_drives'
            : assessments.find((a) => a.id === clearScopeAssessmentId)?.code || 'drive';
        archiveName = triggerCandidateCSVDownload(
          targetedForCleanup,
          `attlic_candidates_archive_${scopeSuffix.toLowerCase()}`
        );
        setHasDownloadedBackupInModal(true);
        setLastBackupFilename(archiveName);
      }

      const { clearedCount } = await clearCandidateData({
        assessmentId: clearScopeAssessmentId === 'all' ? undefined : clearScopeAssessmentId,
      });

      setShowClearModal(false);
      setCleanupNotice(
        `Downloaded backup (${archiveName}) and cleared ${clearedCount} candidate record${
          clearedCount === 1 ? '' : 's'
        } successfully.`
      );
      setTimeout(() => setCleanupNotice(null), 7000);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Candidates</h1>
          <p className="text-xs text-slate-400 mt-1">
            Evaluation records, proctoring logs, pipeline shortlisting, and downloadable score certificates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCsvPreviewModal(true)}
            disabled={attempts.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-indigo-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Preview Styled Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => exportCSV('styled')}
            disabled={attempts.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Downloads formatted spreadsheet with bold headings and alternating pastel-orange & white rows"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Export CSV ({filtered.length.toLocaleString()})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenClearModal}
            disabled={attempts.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Archive &amp; Clear Data</span>
          </button>
        </div>
      </div>

      {/* Confirmation Notice */}
      {cleanupNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs text-emerald-400">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{cleanupNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setCleanupNotice(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Shortlisting Filter Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by candidate name, email, college, roll number, or code..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['all', 'passed', 'failed'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setFilterResult(r);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-xs rounded-lg capitalize font-medium transition-colors ${
                  filterResult === r
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Shortlisting Filters */}
        <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-medium">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Shortlisting Criteria:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-400">Min Score:</label>
              <select
                value={minPercentageFilter}
                onChange={(e) => {
                  setMinPercentageFilter(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={0}>Any (0%+)</option>
                <option value={50}>50% &amp; above</option>
                <option value={60}>60% &amp; above</option>
                <option value={75}>75% &amp; above</option>
                <option value={85}>85% &amp; above</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-400">Max Tab Switches:</label>
              <select
                value={maxViolationsFilter}
                onChange={(e) => {
                  setMaxViolationsFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="any">Any</option>
                <option value="0">0 (Clean Session)</option>
                <option value="1">≤ 1 Switch</option>
                <option value="2">≤ 2 Switches</option>
                <option value="3">≤ 3 Switches</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-400">Stage:</label>
              <select
                value={pipelineFilter}
                onChange={(e) => {
                  setPipelineFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Stages</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending Review</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400 tracking-wider">
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Institution &amp; ID</th>
                <th className="py-3 px-3">Assessment</th>
                <th className="py-3 px-3 text-right">Score</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Integrity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-6 h-6 text-slate-500" />
                      <p className="text-xs font-semibold text-slate-200">
                        {attempts.length === 0
                          ? 'No candidate attempts recorded yet'
                          : 'No candidates match the selected filters'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {attempts.length === 0
                          ? 'Completed candidate submissions and evaluation metrics will appear here.'
                          : 'Adjust your search query or shortlisting criteria.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((attempt) => {
                  const stage = getAttemptPipelineStatus(attempt);
                  return (
                    <tr
                      key={attempt.id}
                      onClick={() => setSelectedAttempt(attempt)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {attempt.candidate.snapshotDataUrl && (
                            <img
                              src={attempt.candidate.snapshotDataUrl}
                              alt={attempt.candidate.name}
                              className="w-8 h-6 object-cover rounded border border-slate-700 shrink-0"
                            />
                          )}
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{attempt.candidate.name}</span>
                              {attempt.candidate.snapshotDataUrl && (
                                <span
                                  title="Verification Snapshot Attached"
                                  className="text-indigo-400"
                                >
                                  <Camera className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{attempt.candidate.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-200 text-xs font-medium">
                          {attempt.candidate.college || '—'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {attempt.candidate.rollNumber} · {attempt.candidate.branch}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-indigo-400 font-mono text-xs font-semibold">
                          {attempt.assessmentCode}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 max-w-[180px]">
                          {attempt.assessmentTitle}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-bold text-white text-xs">
                          {attempt.score} / {attempt.totalMarks}
                        </div>
                        <div className="text-[11px] text-slate-400">{attempt.percentage}%</div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {attempt.passed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Qualified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-400">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Below cutoff</span>
                          </span>
                        )}
                        {stage !== 'pending' && (
                          <div className="text-[11px] font-medium text-indigo-400 capitalize mt-0.5">
                            {stage}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {attempt.tabSwitchCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 tabular-nums">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {attempt.tabSwitchCount} switch{attempt.tabSwitchCount > 1 ? 'es' : ''}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Clean</span>
                        )}
                      </td>

                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadCertificateForAttempt(attempt)}
                            title="Download Candidate PDF Certificate"
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-colors inline-flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3 text-slate-400" />
                            <span>PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedAttempt(attempt)}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition-colors"
                          >
                            Inspect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filtered.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
            <div className="tabular-nums">
              Showing{' '}
              <span className="font-semibold text-slate-200">
                {((safePage - 1) * PAGE_SIZE + 1).toLocaleString()}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-200">
                {Math.min(safePage * PAGE_SIZE, filtered.length).toLocaleString()}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-200">
                {filtered.length.toLocaleString()}
              </span>{' '}
              candidates
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="px-2 font-mono tabular-nums text-slate-200">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white disabled:opacity-40 transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Styled Orange-White CSV / Spreadsheet Preview & Download Modal */}
      {showCsvPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="relative w-full max-w-6xl max-h-[88vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-modal-enter">
            <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950">
              <div>
                <h3 className="text-base font-bold text-white">
                  Formatted Candidate Report Preview (Bold Headings &amp; Alternating Orange–White Rows)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {(filtered.length > 0 ? filtered : attempts).length.toLocaleString()} candidate records formatted with bold headings and alternating pastel-orange (#FFF0E5) &amp; white (#FFFFFF) rows.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportCSV('raw_csv')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Plain .CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportCSV('styled')}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Styled Sheet (.XLSX)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCsvPreviewModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5 bg-slate-950">
              <div className="rounded-xl overflow-hidden border border-[#D9722B]/50 shadow-xl">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr style={{ backgroundColor: '#F08A43', color: '#FFFFFF' }}>
                      {CANDIDATE_EXPORT_HEADERS.map((header) => (
                        <th
                          key={header}
                          className="px-3.5 py-2.5 font-bold uppercase tracking-wider whitespace-nowrap border border-[#D9722B]"
                          style={{ fontWeight: 700 }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extractCandidateExportRows(
                      (filtered.length > 0 ? filtered : attempts).slice(0, 100)
                    ).map((row, rIdx) => {
                      const isOrangeRow = rIdx % 2 === 1;
                      const bgHex = isOrangeRow ? '#FFF0E5' : '#FFFFFF';
                      return (
                        <tr key={rIdx} style={{ backgroundColor: bgHex, color: '#141417' }}>
                          {row.map((cell, cIdx) => {
                            const isBoldCell = cIdx === 1 || cIdx === 8 || cIdx === 13;
                            const isNumeric =
                              cIdx === 10 || cIdx === 11 || cIdx === 12 || cIdx === 14 || cIdx === 15;
                            return (
                              <td
                                key={cIdx}
                                className={`px-3.5 py-2 whitespace-nowrap border border-[#F2D3B8] ${
                                  isBoldCell ? 'font-bold' : 'font-normal'
                                } ${isNumeric ? 'text-right font-mono tabular-nums' : 'text-left'}`}
                                style={{
                                  color:
                                    cIdx === 13
                                      ? cell === 'QUALIFIED'
                                        ? '#15803D'
                                        : '#B91C1C'
                                      : '#141417',
                                }}
                              >
                                {String(cell)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Download & Clear Candidate Data Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-modal-enter">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Archive &amp; Clear Candidate Data
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Clearing candidate records automatically downloads a complete CSV archive beforehand to preserve audit compliance.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Select Cleanup Scope
              </label>
              <select
                value={clearScopeAssessmentId}
                onChange={(e) => {
                  setClearScopeAssessmentId(e.target.value);
                  setHasDownloadedBackupInModal(false);
                  setLastBackupFilename(null);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">
                  All Candidate Data Across All Drives ({attempts.length.toLocaleString()} total records)
                </option>
                {assessments.map((assess) => {
                  const count = attempts.filter((a) => a.assessmentId === assess.id).length;
                  return (
                    <option key={assess.id} value={assess.id}>
                      Drive {assess.code}: {assess.title} ({count.toLocaleString()} candidate
                      {count === 1 ? '' : 's'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Records Selected:</span>
                <span className="font-mono font-semibold text-white tabular-nums">
                  {targetedForCleanup.length.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Qualified Candidates in Scope:</span>
                <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                  {targetedForCleanup.filter((a) => a.passed).length.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Archive Format:</span>
                <span className="font-mono text-slate-200">CSV (Scores &amp; Proctoring Logs)</span>
              </div>
            </div>

            {hasDownloadedBackupInModal && lastBackupFilename ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Backup downloaded: <strong className="font-mono">{lastBackupFilename}</strong>
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-300">
                <Download className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Confirming below will download the CSV archive to your computer before removing{' '}
                  {targetedForCleanup.length.toLocaleString()} record
                  {targetedForCleanup.length === 1 ? '' : 's'}.
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleDownloadBackupOnly}
                disabled={targetedForCleanup.length === 0 || isClearing}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Download CSV Only</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  disabled={isClearing}
                  className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleForceDownloadAndClear}
                  disabled={targetedForCleanup.length === 0 || isClearing}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {isClearing
                      ? 'Archiving & Clearing...'
                      : `Download & Clear (${targetedForCleanup.length.toLocaleString()})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Evaluation Report Modal */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 gap-4">
              <div className="flex items-start gap-4">
                {selectedAttempt.candidate.snapshotDataUrl && (
                  <div className="shrink-0">
                    <img
                      src={selectedAttempt.candidate.snapshotDataUrl}
                      alt={selectedAttempt.candidate.name}
                      className="w-20 h-16 object-cover rounded-lg border border-slate-700"
                    />
                  </div>
                )}
                <div className="space-y-0.5">
                  <span className="text-[11px] uppercase font-semibold text-indigo-400 tracking-wider">
                    Candidate Evaluation Report
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    {selectedAttempt.candidate.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedAttempt.candidate.college} · {selectedAttempt.candidate.rollNumber}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAttempt(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scorecard Summary */}
            <div className="grid grid-cols-3 divide-x divide-slate-800 border border-slate-800 rounded-xl bg-slate-950 text-center">
              <div className="p-3">
                <span className="text-[11px] text-slate-400 block">Score</span>
                <span className="text-lg font-bold font-mono text-white tabular-nums">
                  {selectedAttempt.score} / {selectedAttempt.totalMarks}
                </span>
              </div>
              <div className="p-3">
                <span className="text-[11px] text-slate-400 block">Percentage</span>
                <span className="text-lg font-bold font-mono text-white tabular-nums">
                  {selectedAttempt.percentage}%
                </span>
              </div>
              <div className="p-3">
                <span className="text-[11px] text-slate-400 block">Qualification</span>
                <span
                  className={`text-sm font-bold block mt-0.5 ${
                    selectedAttempt.passed ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selectedAttempt.passed ? 'Qualified' : 'Below Cutoff'}
                </span>
              </div>
            </div>

            {/* Pipeline Stage */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-medium text-slate-200">Recruitment Pipeline Stage:</span>
              <div className="flex items-center gap-1.5">
                {(['pending', 'shortlisted', 'waitlisted', 'rejected'] as const).map((st) => {
                  const active = getAttemptPipelineStatus(selectedAttempt) === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleSetPipelineStatus(selectedAttempt.id, st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize border transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Candidate Metadata */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <h4 className="font-semibold text-white">Candidate Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
                <div>
                  Email: <span className="text-slate-200">{selectedAttempt.candidate.email}</span>
                </div>
                <div>
                  Branch: <span className="text-slate-200">{selectedAttempt.candidate.branch}</span>
                </div>
                <div>
                  Assessment Code:{' '}
                  <span className="text-indigo-400 font-mono">{selectedAttempt.assessmentCode}</span>
                </div>
                <div>
                  Submitted:{' '}
                  <span className="text-slate-200 tabular-nums">
                    {new Date(
                      selectedAttempt.submittedAt || selectedAttempt.startedAt
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Coding Submissions */}
            {Object.values(selectedAttempt.answers || {}).some(
              (ans) => ans.codeAnswer && ans.codeAnswer.trim().length > 0
            ) && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-3">
                <h4 className="font-semibold text-white flex items-center justify-between">
                  <span>Coding Submissions &amp; Test Cases</span>
                  <span className="font-mono text-[11px] text-slate-400">Automated Evaluation</span>
                </h4>
                <div className="space-y-3">
                  {Object.values(selectedAttempt.answers || {})
                    .filter((ans) => ans.codeAnswer && ans.codeAnswer.trim().length > 0)
                    .map((ans, idx) => (
                      <div
                        key={ans.questionId || idx}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-slate-200 uppercase">
                            Language: {ans.codingLanguage || 'python'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-semibold text-[11px]">
                            {ans.passedTestCases ?? 0} / {ans.totalTestCases ?? 0} Passed
                          </span>
                        </div>
                        <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-48">
                          {ans.codeAnswer}
                        </pre>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Proctoring Audit Log */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <h4 className="font-semibold text-white flex items-center justify-between">
                <span>Session Integrity Log</span>
                <span className="text-amber-400 font-mono font-semibold tabular-nums">
                  {selectedAttempt.tabSwitchCount} Tab Switch
                  {selectedAttempt.tabSwitchCount === 1 ? '' : 'es'}
                </span>
              </h4>
              {selectedAttempt.violationLogs.length > 0 ? (
                <ul className="space-y-1.5 text-slate-400">
                  {selectedAttempt.violationLogs.map((log, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-slate-500 font-mono tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-slate-200">{log.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-emerald-400 text-xs">
                  No proctoring violations recorded during this session.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleDownloadCertificateForAttempt(selectedAttempt)}
                className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Download PDF Certificate</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAttempt(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
