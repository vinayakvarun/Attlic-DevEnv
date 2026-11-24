/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Global Footer (Dark Theme)
 */

import React from 'react';
import { BrandLogo, AttlicWordmark } from './BrandLogo';
import { NavigationPage } from '../../types';

interface FooterProps {
  onNavigate: (page: NavigationPage) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-slate-900 bg-slate-950 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-3">
            <BrandLogo size="sm" showTagline={true} />
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              <AttlicWordmark /> is an online assessment and technical evaluation platform engineered for
              hiring teams, university placement offices, and high-concurrency examination drives.
            </p>
          </div>

          {/* Workspace Navigation */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
              Platform
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('landing')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Overview
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('candidate_portal')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Candidate Examination Portal
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('recruiter_login')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Recruiter Sign In
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('recruiter_register')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Register Organization
                </button>
              </li>
            </ul>
          </div>

          {/* Institutional & Compliance */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
              Governance &amp; Policy
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('about')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  About <AttlicWordmark />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('privacy')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Privacy &amp; Data Protection
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('terms')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Candidate Conduct Policy
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-950 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <p>© {new Date().getFullYear()} <AttlicWordmark />. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
