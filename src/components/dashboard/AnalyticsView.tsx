/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Recruiter Results & Analytics View (Dark Theme)
 */

import React from 'react';
import { useAssessments } from '../../context/AssessmentContext';
import { Award, BarChart3, Building2, Trophy } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { attempts } = useAssessments();

  const totalCount = attempts.length;
  const divisor = totalCount || 1;
  const passed = attempts.filter((a) => a.passed).length;
  const passPercentage = totalCount > 0 ? Math.round((passed / divisor) * 100) : 0;
  const avgScore =
    totalCount > 0
      ? Math.round(attempts.reduce((acc, a) => acc + (a.percentage || 0), 0) / divisor)
      : 0;

  const buckets = [
    { label: '0–39%', count: attempts.filter((a) => a.percentage < 40).length },
    {
      label: '40–59%',
      count: attempts.filter((a) => a.percentage >= 40 && a.percentage < 60).length,
    },
    {
      label: '60–79%',
      count: attempts.filter((a) => a.percentage >= 60 && a.percentage < 80).length,
    },
    { label: '80–100%', count: attempts.filter((a) => a.percentage >= 80).length },
  ];
  const maxBucketCount = Math.max(...buckets.map((b) => b.count), 1);

  const collegeMap: Record<string, { count: number; totalScore: number; passed: number }> = {};
  attempts.forEach((a) => {
    const col = a.candidate.college || 'Unspecified Institution';
    if (!collegeMap[col]) collegeMap[col] = { count: 0, totalScore: 0, passed: 0 };
    collegeMap[col].count++;
    collegeMap[col].totalScore += a.percentage || 0;
    if (a.passed) collegeMap[col].passed++;
  });

  const collegeStats = Object.entries(collegeMap)
    .map(([name, data]) => ({
      name,
      count: data.count,
      avgPercentage: Math.round(data.totalScore / data.count),
      passRate: Math.round((data.passed / data.count) * 100),
    }))
    .sort((a, b) => b.avgPercentage - a.avgPercentage);

  const topRankers = [...attempts]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-5 border-b border-slate-800/80">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Results &amp; Analytics
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Score distributions, institutional benchmarks, and top-performing candidates across completed assessments.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Overall Qualification Rate</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
              {passPercentage}%
            </span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {passed.toLocaleString()} / {totalCount.toLocaleString()} candidates
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Mean Score Percentage</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {avgScore}%
            </span>
            <span className="text-xs text-slate-500">Normalized average</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Participating Institutions</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {Object.keys(collegeMap).length.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">Colleges &amp; universities</span>
          </div>
        </div>
      </div>

      {/* Score Distribution & Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Score Distribution</h2>
              <p className="text-xs text-slate-400">Candidate count by score bracket</p>
            </div>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              n = {totalCount.toLocaleString()}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {buckets.map((b) => {
              const widthPct = Math.round((b.count / maxBucketCount) * 100);
              const sharePct = totalCount > 0 ? Math.round((b.count / totalCount) * 100) : 0;
              return (
                <div key={b.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium text-slate-200">{b.label}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {b.count.toLocaleString()} ({sharePct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                      style={{ width: `${Math.max(widthPct, b.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performers Table */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Top Performers</span>
              </h2>
              <p className="text-xs text-slate-400">Highest scoring submissions</p>
            </div>
          </div>

          {topRankers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No completed attempts available yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {topRankers.map((ranker, idx) => (
                <div
                  key={ranker.id}
                  className="px-5 py-3 flex items-center justify-between text-xs hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center font-mono font-bold text-[11px] text-indigo-300 shrink-0 tabular-nums">
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <span className="font-semibold text-slate-100 block truncate">
                        {ranker.candidate.name}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate block">
                        {ranker.candidate.college} · {ranker.assessmentCode}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono shrink-0 tabular-nums">
                    <span className="font-bold text-emerald-400 text-xs block">
                      {ranker.score}/{ranker.totalMarks}
                    </span>
                    <span className="text-[11px] text-slate-400">{ranker.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Institutional Comparison Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white">
            Institutional Performance Breakdown
          </h2>
          <p className="text-xs text-slate-400">
            Aggregated metrics by university or college
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400 tracking-wider">
                <th className="py-3 px-4">Institution</th>
                <th className="py-3 px-4 text-right">Candidates</th>
                <th className="py-3 px-4">Average Score</th>
                <th className="py-3 px-4 text-right">Qualification Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {collegeStats.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 px-4 text-center text-xs text-slate-400">
                    No institutional data recorded yet.
                  </td>
                </tr>
              ) : (
                collegeStats.map((col) => (
                  <tr key={col.name} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-medium text-slate-200">{col.name}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-200 tabular-nums">
                      {col.count.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-28 h-1.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${col.avgPercentage}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-200 tabular-nums">
                          {col.avgPercentage}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-emerald-400 tabular-nums">
                      {col.passRate}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
