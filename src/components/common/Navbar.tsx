/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Global Navigation Bar (Dark Theme)
 */

import React, { useState } from 'react';
import { BrandLogo, renderWithAttlicBrand } from './BrandLogo';
import { useAuth } from '../../context/AuthContext';
import { NavigationPage } from '../../types';
import { ArrowLeft, ArrowRight, Menu, X, Terminal } from 'lucide-react';

interface NavbarProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  onGoBack?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate, onGoBack }) => {
  const { currentUser, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleBackClick = () => {
    if (onGoBack) {
      onGoBack();
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      onNavigate('landing');
    }
  };

  const navItems: { page: NavigationPage; label: string }[] = [
    { page: 'landing', label: 'Platform' },
    { page: 'about', label: 'About ATTLIC' },
    { page: 'privacy', label: 'Privacy' },
    { page: 'terms', label: 'Terms' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand + Contextual Back */}
        <div className="flex items-center gap-3 shrink-0">
          {currentPage !== 'landing' && (
            <button
              type="button"
              onClick={handleBackClick}
              aria-label="Go back to previous page"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors"
              title="Go back to previous page"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="cursor-pointer flex items-center gap-2 text-left focus:outline-none"
          >
            <BrandLogo size="sm" />
          </button>
        </div>

        {/* Zone 2: Primary Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const active = currentPage === item.page;
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => onNavigate(item.page)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {renderWithAttlicBrand(item.label)}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Right Actions */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('candidate_portal')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-indigo-500/50 transition-colors whitespace-nowrap"
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Enter Test Code</span>
          </button>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('recruiter_dashboard')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-colors whitespace-nowrap"
              >
                <span>Recruiter Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={signOut}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors whitespace-nowrap"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('recruiter_login')}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap"
              >
                Recruiter Sign In
              </button>
              <button
                type="button"
                onClick={() => onNavigate('recruiter_register')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-colors whitespace-nowrap"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu toggle */}
        <div className="md:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('candidate_portal')}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-800 bg-slate-900 text-slate-200"
          >
            Enter Code
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-400 hover:text-white focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950 px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.page}
              type="button"
              onClick={() => {
                onNavigate(item.page);
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-xs font-medium ${
                currentPage === item.page
                  ? 'bg-indigo-500/15 text-indigo-300 font-semibold'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {renderWithAttlicBrand(item.label)}
            </button>
          ))}
          <div className="pt-3 mt-2 border-t border-slate-800 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                onNavigate('candidate_portal');
                setMobileMenuOpen(false);
              }}
              className="w-full py-2 text-center text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
            >
              Candidate Portal (Enter Exam Code)
            </button>
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  onNavigate('recruiter_dashboard');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 text-center text-xs font-semibold rounded-lg bg-indigo-600 text-white"
              >
                Open Recruiter Console
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onNavigate('recruiter_login');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 text-center text-xs font-semibold rounded-lg bg-indigo-600 text-white"
              >
                Recruiter Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
