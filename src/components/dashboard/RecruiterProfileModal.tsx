/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Recruiter Profile Modal (Dark Theme)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, X } from 'lucide-react';

interface RecruiterProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  mandatory?: boolean;
}

const INDUSTRY_OPTIONS = [
  'Software & Cloud Technology',
  'FinTech & Banking',
  'Consulting & Professional Services',
  'Core Engineering & Manufacturing',
  'Healthcare & Biotechnology',
  'E-Commerce & Retail',
  'Telecommunications',
  'Education & EdTech',
  'Other',
];

export const RecruiterProfileModal: React.FC<RecruiterProfileModalProps> = ({
  isOpen,
  onClose,
  mandatory = false,
}) => {
  const { currentUser, currentOrg, updateUserProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [industry, setIndustry] = useState(INDUSTRY_OPTIONS[0]);
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [targetCampuses, setTargetCampuses] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL || '');
      setJobTitle(currentUser.jobTitle || 'Head of Campus Recruiting');
      setCompanyName(currentUser.companyName || currentOrg?.name || '');
      setPhone(currentUser.phone || '');
      setIndustry(currentUser.industry || currentOrg?.industry || INDUSTRY_OPTIONS[0]);
      setCompanyWebsite(currentUser.companyWebsite || currentOrg?.companyWebsite || '');
      setTargetCampuses(
        currentUser.targetCampuses && currentUser.targetCampuses.length > 0
          ? currentUser.targetCampuses.join(', ')
          : 'IITs, NITs, IIITs, State Engineering Colleges'
      );
    }
  }, [currentUser, currentOrg, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setIsSaving(true);
      setSuccessMessage(null);

      const parsedCampuses = targetCampuses
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      await updateUserProfile({
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
        jobTitle: jobTitle.trim(),
        companyName: companyName.trim(),
        phone: phone.trim(),
        industry,
        companyWebsite: companyWebsite.trim(),
        targetCampuses: parsedCampuses,
        isProfileComplete: true,
      });

      setSuccessMessage('Recruiter profile updated.');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 800);
    } catch {
      // Saved locally
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 my-8">
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">Recruiter Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Update your recruiter identity and organization details.
            </p>
          </div>
          {!mandatory && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="font-medium text-slate-300 block">Full Name *</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-slate-300 block">Work Email</label>
              <input
                type="email"
                disabled
                value={currentUser?.email || ''}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 font-mono cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-slate-300 block">Organization *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-slate-300 block">Job Title *</label>
              <input
                type="text"
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-slate-300 block">Contact Phone *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-slate-300 block">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {INDUSTRY_OPTIONS.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-slate-300 block">Target Universities</label>
            <input
              type="text"
              value={targetCampuses}
              onChange={(e) => setTargetCampuses(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
            {!mandatory && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-medium transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
