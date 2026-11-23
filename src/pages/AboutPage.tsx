/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - About attlic
 */

import React from 'react';
import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { BrandLogo, AttlicWordmark } from '../components/common/BrandLogo';
import { NavigationPage } from '../types';
import {
  ShieldCheck,
  Award,
  Zap,
  Target,
  Users,
  CheckCircle2,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface AboutPageProps {
  onNavigate: (page: NavigationPage) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar currentPage="about" onNavigate={onNavigate} />

      <main className="max-w-4xl mx-auto px-4 py-16 space-y-12">
        {/* Intro */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <BrandLogo size="lg" showTagline={true} className="mx-auto justify-center" />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight pt-2">
            The Standard for University Placement Examinations
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            <AttlicWordmark /> was built from first principles to solve the widespread integrity and logistical
            bottlenecks in college campus recruitment drives.
          </p>
        </div>

        {/* Mission Statement */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            Our Mission: Assess. Evaluate. Select.
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Every hiring season, recruiters assess thousands of engineering applicants across hundreds
            of campuses. Traditional online tests are plagued by proxy test-takers, tab-switching,
            and fragmented scoring spreadsheets. <AttlicWordmark /> provides a tamper-resistant, real-time
            examination ecosystem where merit is proven with transparency.
          </p>
        </div>

        {/* Core Architectural Tenets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 w-fit">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Passive Integrity Shield</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We monitor focus loss and tab switches without requiring candidates to install invasive
              rootkit proctoring software.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="p-2 rounded-lg bg-white/10 text-white w-fit">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Millisecond Auto-Evaluation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Complex multi-select, negative-marking, and short-text logic are auto-evaluated the moment
              a test concludes.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 w-fit">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Normalized Campus Percentiles</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standardized scoring allows hiring managers to equitably compare top performers across
              different universities.
            </p>
          </div>
        </div>

        {/* Call to action */}
        <div className="p-8 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Ready to streamline your next hiring drive?</h3>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => onNavigate('recruiter_login')}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
            >
              Sign In as Recruiter
            </button>
            <button
              onClick={() => onNavigate('candidate_portal')}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:text-white"
            >
              Try Candidate Experience
            </button>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
