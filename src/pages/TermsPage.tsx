/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Terms and Conditions
 */

import React from 'react';
import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { NavigationPage } from '../types';
import { AttlicWordmark } from '../components/common/BrandLogo';
import { FileText, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface TermsPageProps {
  onNavigate: (page: NavigationPage) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar currentPage="terms" onNavigate={onNavigate} />

      <main className="max-w-4xl mx-auto px-4 py-16 space-y-8">
        <div className="space-y-2">
          <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
            Institutional Policy
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            <AttlicWordmark /> Examination Terms & Conditions
          </h1>
          <p className="text-xs text-slate-400">
            Rules of fair conduct, honor code obligations, and organization administration rights.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              1. Candidate Code of Academic Honesty
            </h2>
            <p>
              By accessing any examination through an <AttlicWordmark /> test code, candidates certify that all
              submitted work is entirely their own. Unauthorized collaboration, automated scripts,
              browser extensions that intercept test content, or secondary device usage constitutes a direct
              violation of placement drive guidelines.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              2. Disqualification & Automated Submission
            </h2>
            <p>
              Recruiters configure specific anti-cheating thresholds (such as allowed tab switches).
              If a candidate exceeds the allowable limit, <AttlicWordmark /> reserves the right to automatically
              submit the examination and flag the candidate's scorecard with an audit log for review.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              3. Recruiter Authority & Final Evaluation
            </h2>
            <p>
              The recruiting organization retains sole authority regarding candidate shortlisting, cutoffs,
              interview invitations, and final selection. <AttlicWordmark /> acts strictly as an objective evaluation
              platform and proctoring infrastructure provider.
            </p>
          </section>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
