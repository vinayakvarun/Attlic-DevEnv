/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Privacy Policy
 */

import React from 'react';
import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { BrandLogo, AttlicWordmark } from '../components/common/BrandLogo';
import { NavigationPage } from '../types';
import { ShieldCheck, Lock, EyeOff, Server, Database } from 'lucide-react';

interface PrivacyPageProps {
  onNavigate: (page: NavigationPage) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar currentPage="privacy" onNavigate={onNavigate} />

      <main className="max-w-4xl mx-auto px-4 py-16 space-y-8">
        <div className="space-y-2">
          <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
            Legal & Security
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            <AttlicWordmark /> Privacy Policy & Data Security
          </h1>
          <p className="text-xs text-slate-400">
            Last updated: November 2026 • Governing candidate data protection and institutional integrity.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              1. Candidate Information We Collect
            </h2>
            <p>
              When a candidate takes an assessment on <AttlicWordmark />, we collect identification details strictly
              necessary for placement drive verification: student full name, institutional email address,
              university roll number, and academic branch. We do not sell, rent, or monetize candidate data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-indigo-400" />
              2. Passive Proctoring & Anti-Cheating Telemetry
            </h2>
            <p>
              To maintain academic fairness without intrusive device software, <AttlicWordmark /> captures in-browser
              telemetry: window focus loss events, tab switches, and submission timestamps. This metadata
              is retained solely for the recruiting organization conducting the examination.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              3. Cloud Storage & Firestore Security
            </h2>
            <p>
              All assessment schemas, candidate attempts, and evaluation scores are stored in encrypted
              Cloud Firestore database instances governed by strict attribute-based access control (ABAC)
              rules. Candidates can only access their authorized test receipt.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              4. Data Retention & Recruiter Access
            </h2>
            <p>
              Assessment results remain accessible to the authorized recruiter who created the drive.
              Placement cells may request data purging following the conclusion of the campus hiring cycle.
            </p>
          </section>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
