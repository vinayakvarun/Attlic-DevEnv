/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Modern Landing Page (Linear / Stripe / Vercel Aesthetic)
 */

import React, { useState } from 'react';
import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { BrandLogo, AttlicWordmark } from '../components/common/BrandLogo';
import { NavigationPage } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Zap,
  Layers,
  BarChart3,
  Users,
  Building2,
  Lock,
  Code2,
  FileSpreadsheet,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (page: NavigationPage) => void;
  onLaunchTestWithCode: (code: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  onLaunchTestWithCode,
}) => {
  const { currentUser } = useAuth();
  const [quickCode, setQuickCode] = useState('');

  const handleQuickLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickCode.trim()) {
      onLaunchTestWithCode(quickCode.trim().toUpperCase());
    } else {
      onNavigate('candidate_portal');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar currentPage="landing" onNavigate={onNavigate} />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24 border-b border-slate-900">
        {/* Subtle dark-grey grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#22222635_1px,transparent_1px),linear-gradient(to_bottom,#22222635_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Next-Generation Campus Placement Assessments</span>
          </div>

          {/* Headline */}
          <div className="max-w-4xl mx-auto space-y-4">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white font-sans">
              Conduct high-integrity campus drives with{' '}
              <AttlicWordmark className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-200 to-white" />
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
              The end-to-end examination management platform for engineering talent, university
              placements, and verified technical evaluations.
            </p>
          </div>

          {/* Interactive Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            {currentUser ? (
              <button
                onClick={() => onNavigate('recruiter_dashboard')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <span>Go to Recruiter Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('recruiter_register')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <span>Get Started as Recruiter</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => onNavigate('candidate_portal')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-sm transition flex items-center justify-center gap-2"
            >
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>Take a Test (Enter Code)</span>
            </button>
          </div>

          {/* Quick Test Code Input */}
          <form
            onSubmit={handleQuickLaunch}
            className="max-w-md mx-auto pt-2 flex items-center gap-2 bg-slate-900/80 p-2 rounded-xl border border-slate-800 shadow-inner"
          >
            <input
              type="text"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
              placeholder="Enter assessment code (e.g. CAMPUS-2026-CS)"
              className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 uppercase font-mono focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shrink-0"
            >
              Start Exam
            </button>
          </form>

          {/* Social Proof Badges */}
          <div className="pt-6 border-t border-slate-900/80 flex flex-wrap items-center justify-center gap-8 text-xs text-slate-300 font-medium">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Real-time Anti-Cheating Telemetry
            </span>
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-white" />
              Instant Automated Grading
            </span>
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              1-Click Google Form Import
            </span>
          </div>
        </div>
      </section>

      {/* Product Purpose & Key Capabilities Section */}
      <section className="py-20 border-b border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
              Product Architecture
            </span>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Designed for companies, recruiters, and placement officers
            </h2>
            <p className="text-sm text-slate-400">
              <AttlicWordmark /> eliminates the chaos of manual campus tests, insecure Google Forms, and disjointed
              spreadsheets with a unified, verified assessment engine.
            </p>
          </div>

          {/* 3 Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-6 space-y-4 hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Code2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                1. Multi-Section & Code Assessments
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Create structured multi-sectional examinations spanning algorithmic coding, system
                design, quantitative aptitude, and CS core subjects with custom weightage and negative marking.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-6 space-y-4 hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                2. Anti-Cheating & Fullscreen Enforcement
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mandatory full screen lock (Chrome F11), copy-paste prevention, and real-time tab switch tracking. Comprehensive violation audit logs are recorded and attached to candidate attempts.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-6 space-y-4 hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                3. Campus Benchmark Analytics
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Instant candidate leaderboards, percentile curves, and comparative university performance
                metrics with 1-click export to CSV for recruitment committees.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 border-b border-slate-900 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
              Workflow
            </span>
            <h2 className="text-3xl font-bold text-white tracking-tight">How <AttlicWordmark /> Works</h2>
            <p className="text-sm text-slate-400">
              A seamless, frictionless experience for both recruitment teams and student candidates.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* For Recruiters */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">For Recruiters</h3>
                  <p className="text-xs text-slate-400">3 simple steps to launch your campus drive</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="font-semibold text-slate-200">Create or Import Assessment</h4>
                    <p className="text-slate-400 mt-0.5">
                      Build custom sections or paste your existing Google Form questions to generate a test in 60 seconds.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="font-semibold text-slate-200">Share Code & Whitelist Campuses</h4>
                    <p className="text-slate-400 mt-0.5">
                      Distribute the generated alphanumeric code (e.g. CAMPUS-2026-CS) to university placement cells.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="font-semibold text-slate-200">Monitor Telemetry & Rank Candidates</h4>
                    <p className="text-slate-400 mt-0.5">
                      Observe active examination sessions live and download evaluated candidate percentiles.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* For Candidates */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/10 text-white">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">For Candidates</h3>
                  <p className="text-xs text-slate-400">Focused, fair, and reliable examination environment</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="font-semibold text-slate-200">Enter Code & Register Details</h4>
                    <p className="text-slate-400 mt-0.5">
                      Access the test hall with your drive code and verify student roll number, college, and branch.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="font-semibold text-slate-200">Take Examination with Palette</h4>
                    <p className="text-slate-400 mt-0.5">
                      Navigate color-coded questions, mark queries for review, and enjoy background auto-saving every 5 seconds.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="font-semibold text-slate-200">Instant Submission Receipt</h4>
                    <p className="text-slate-400 mt-0.5">
                      Review submission breakdown and receive a cryptographic exam attempt receipt upon completion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recruiter & Candidate Value Props */}
      <section className="py-20 border-b border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">
                Recruiter Benefits
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Cut campus screening cycles from 7 days down to 2 hours.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Prevent cheating without invasive software installations.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Export standardized CSV reports ready for interview scheduling.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Persisted in Cloud Firestore with enterprise security rules.</span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Candidate Benefits
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>Zero lag, clean distraction-free examination interface.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>Automatic answer preservation even during network interruptions.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>Interactive question palette with marked-for-review tags.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>Transparent evaluation rules and instant score receipt.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950 border-b border-slate-900 text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl font-extrabold text-white">
            Ready to assess and select premier campus talent?
          </h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            Experience the <AttlicWordmark /> recruiter dashboard or test the candidate examination environment right now.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('recruiter_register')}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-indigo-600/30"
            >
              Register Recruiter Account
            </button>
            <button
              onClick={() => onLaunchTestWithCode('CAMPUS-2026-CS')}
              className="px-6 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs transition"
            >
              Test Hall: CAMPUS-2026-CS
            </button>
          </div>
        </div>
      </section>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
