/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Candidate Portal & Examination Hall Entrance
 */

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { AttlicWordmark } from '../components/common/BrandLogo';
import { CandidateTestRunner } from '../components/candidate/CandidateTestRunner';
import { useAssessments } from '../context/AssessmentContext';
import { Assessment, Candidate, CandidateAttempt, NavigationPage } from '../types';
import {
  Terminal,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Camera,
  RefreshCw,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { WaitingAnimation } from '../components/common/WaitingAnimation';
import {
  validateExamAccess,
  generateDigitalIdSnapshotDataUrl,
  downloadCandidatePdfCertificate,
} from '../utils/examFeatures';
import { hasDiskApiBackend } from '../services/firebase';

interface CandidatePortalPageProps {
  initialCode?: string;
  initialStep?: 'code' | 'register';
  onNavigate: (page: NavigationPage) => void;
  onRouteStepChange?: (step: 'code' | 'register', code: string) => void;
}

export const CandidatePortalPage: React.FC<CandidatePortalPageProps> = ({
  initialCode = '',
  initialStep = 'code',
  onNavigate,
  onRouteStepChange,
}) => {
  const { getAssessmentByCode, assessments, attempts } = useAssessments();

  const [testCode, setTestCode] = useState(initialCode);
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasConsented, setHasConsented] = useState(false);

  // Candidate Registration Form (No prefilled data)
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [phone, setPhone] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, string>>({});

  // Optional 1-Snapshot Verification State (Only active if recruiter enabled requireCandidateSnapshot)
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Examination State
  const [isExamActive, setIsExamActive] = useState(false);
  const [submittedAttempt, setSubmittedAttempt] = useState<CandidateAttempt | null>(null);
  const [certificateDownloadNotice, setCertificateDownloadNotice] = useState<string | null>(null);

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  useEffect(() => {
    if (initialStep === 'code' && !initialCode) {
      setActiveAssessment(null);
      return;
    }
    if (initialCode) {
      setTestCode(initialCode);
      verifyCode(initialCode, false);
    }
  }, [initialCode, initialStep]);

  const startCameraPreview = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Webcam API is not available in this browser environment.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setCameraError(
        'Camera permission was denied or no physical webcam was detected. You can retry camera access or attach a verified digital ID snapshot.'
      );
    }
  };

  const handleCaptureSingleSnapshot = () => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 240, 180);
        // Subtle verification stamp bar at bottom
        ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
        ctx.fillRect(0, 156, 240, 24);
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 9px Ubuntu Mono, monospace';
        ctx.fillText(
          `ATTLIC VERIFIED • ${new Date().toLocaleTimeString()}`,
          10,
          171
        );
        const dataUrl = canvas.toDataURL('image/jpeg', 0.74);
        setSnapshotDataUrl(dataUrl);
        stopCameraStream();
        return;
      }
    }
    // Fallback if video stream frame is not ready
    const fallbackUrl = generateDigitalIdSnapshotDataUrl(
      candidateName || 'Candidate',
      rollNumber,
      candidateEmail
    );
    setSnapshotDataUrl(fallbackUrl);
    stopCameraStream();
  };

  const handleUseDigitalSnapshotFallback = () => {
    const fallbackUrl = generateDigitalIdSnapshotDataUrl(
      candidateName || 'Candidate',
      rollNumber,
      candidateEmail
    );
    setSnapshotDataUrl(fallbackUrl);
    setCameraError(null);
    stopCameraStream();
  };

  const verifyCode = async (codeToVerify: string, pushHistoryStep: boolean = true) => {
    if (!codeToVerify.trim()) return;
    try {
      setIsVerifying(true);
      setErrorMessage(null);
      const found = await getAssessmentByCode(codeToVerify);
      if (found) {
        const windowCheck = validateExamAccess(found);
        if (!windowCheck.allowed && (windowCheck.status === 'not_started' || windowCheck.status === 'ended')) {
          setErrorMessage(windowCheck.reason || 'This assessment is outside its scheduled window.');
          setActiveAssessment(null);
          return;
        }
        setActiveAssessment(found);
        setSnapshotDataUrl(null);
        stopCameraStream();
        if (pushHistoryStep && onRouteStepChange) {
          onRouteStepChange('register', found.code);
        }
      } else {
        setErrorMessage(`Assessment with code "${codeToVerify}" was not found or is not currently active.`);
        setActiveAssessment(null);
      }
    } catch {
      setErrorMessage('Could not verify assessment code. Please check your network connection.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCode(testCode, true);
  };

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateEmail.trim()) {
      setErrorMessage('Please fill in candidate Name and Email before starting.');
      return;
    }

    if (activeAssessment) {
      const accessCheck = validateExamAccess(activeAssessment, candidateEmail.trim());
      if (!accessCheck.allowed) {
        setErrorMessage(accessCheck.reason || 'Access to this assessment is restricted.');
        return;
      }
    }

    // Duplicate submission prevention (local state + zero-leak server check)
    const existingSubmitted = attempts.find(
      (att) =>
        att.assessmentId === activeAssessment?.id &&
        att.candidate?.email?.trim().toLowerCase() === candidateEmail.trim().toLowerCase() &&
        att.status === 'submitted'
    );
    if (existingSubmitted) {
      setErrorMessage(
        `You have already submitted an attempt for this assessment on ${new Date(
          existingSubmitted.submittedAt || ''
        ).toLocaleString()}. Multiple submissions are not permitted by the recruiter.`
      );
      return;
    }

    if (activeAssessment && hasDiskApiBackend()) {
      try {
        const dupRes = await fetch(
          `/api/assessments/code/${encodeURIComponent(activeAssessment.code)}/check-attempt?email=${encodeURIComponent(
            candidateEmail.trim()
          )}`
        );
        if (dupRes.ok) {
          const dupData = await dupRes.json();
          if (dupData.alreadySubmitted) {
            setErrorMessage(
              `You have already submitted an attempt for this assessment${
                dupData.submittedAt ? ` on ${new Date(dupData.submittedAt).toLocaleString()}` : ''
              }. Multiple submissions are not permitted by the recruiter.`
            );
            return;
          }
        }
      } catch {
        // Proceed if offline
      }
    }

    if (activeAssessment?.requireCandidateSnapshot && !snapshotDataUrl) {
      setErrorMessage(
        'Please capture your 1-click Candidate Verification Snapshot before entering the examination hall. It will be attached to your official PDF Certificate.'
      );
      return;
    }

    if (!hasConsented) {
      setErrorMessage(
        'You must acknowledge and consent to the proctored examination terms and academic honor code before proceeding.'
      );
      return;
    }

    const cfg = activeAssessment?.candidateDetailsConfig;
    if (cfg) {
      if (cfg.collectRollNumber && !rollNumber.trim()) {
        setErrorMessage('Roll Number / Student ID is required by the recruiter.');
        return;
      }
      if (cfg.collectPhone && !phone.trim()) {
        setErrorMessage('Contact phone number is required by the recruiter.');
        return;
      }
      if (cfg.customFields && cfg.customFields.length > 0) {
        for (const cf of cfg.customFields) {
          if (cf.required && !customFieldsValues[cf.id]?.trim()) {
            setErrorMessage(`"${cf.label}" is a required field.`);
            return;
          }
        }
      }
    }

    stopCameraStream();
    setIsExamActive(true);
  };

  if (isExamActive && activeAssessment) {
    const candidateObj: Candidate = {
      id: `cand-${Date.now()}`,
      name: candidateName.trim(),
      email: candidateEmail.trim(),
      rollNumber: rollNumber.trim().toUpperCase() || 'UNSPECIFIED',
      college: college.trim(),
      branch: branch.trim(),
      graduationYear: graduationYear ? Number(graduationYear) : 2026,
      phone: phone.trim(),
      cgpa: cgpa.trim(),
      snapshotDataUrl: snapshotDataUrl || undefined,
      customDetails: customFieldsValues,
    };

    return (
      <CandidateTestRunner
        assessment={activeAssessment}
        candidate={candidateObj}
        onFinish={(attempt) => {
          setIsExamActive(false);
          setSubmittedAttempt(attempt);
        }}
        onExit={() => setIsExamActive(false)}
      />
    );
  }

  const isScoreWithheld =
    activeAssessment?.showImmediateResults === false ||
    (submittedAttempt as any)?.resultsWithheld === true ||
    submittedAttempt?.score === null ||
    submittedAttempt?.score === undefined;

  const publishedDemoAssessments = assessments.filter((a) => a.status === 'published');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar currentPage="candidate_portal" onNavigate={onNavigate} />

      <main className="max-w-4xl mx-auto px-4 py-12 w-full my-auto">
        {submittedAttempt ? (
          /* Post-Exam Score Receipt & Downloadable PDF Certificate */
          <div key="step-submitted" className="animate-page-enter rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center space-y-6 max-w-xl mx-auto shadow-2xl">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border ${
                isScoreWithheld
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                  : submittedAttempt.passed
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                {isScoreWithheld
                  ? 'Official Submission Confirmation Receipt'
                  : 'Official Examination Scorecard & Certificate'}
              </span>
              <h2 className="text-2xl font-bold text-white">
                {submittedAttempt.candidate.name}
              </h2>
              <p className="text-xs text-slate-400">
                {submittedAttempt.candidate.college} • Roll No: {submittedAttempt.candidate.rollNumber}
              </p>
            </div>

            {/* Attached Candidate Snapshot Preview when captured */}
            {submittedAttempt.candidate.snapshotDataUrl && (
              <div className="inline-flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-indigo-500/30 mx-auto text-left">
                <img
                  src={submittedAttempt.candidate.snapshotDataUrl}
                  alt="Candidate Verification Snapshot"
                  className="w-20 h-14 object-cover rounded-lg border border-indigo-500/40"
                />
                <div className="pr-2">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verification Snapshot Attached</span>
                  </span>
                  <span className="text-[11px] text-slate-300 block">
                    Embedded in your official PDF Certificate
                  </span>
                </div>
              </div>
            )}

            {isScoreWithheld ? (
              <div className="p-5 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2 text-center">
                <div className="text-sm font-bold text-indigo-400">
                  Your Examination Responses Have Been Recorded
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Thank you for completing <strong className="text-white">{submittedAttempt.assessmentTitle}</strong>. Your answers and proctoring logs have been securely transmitted to the recruiting team. Final results will be communicated by the organizer after evaluation.
                </p>
              </div>
            ) : (
              /* Immediate Scorecard */
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block font-medium">Score</span>
                  <span className="text-2xl font-bold font-mono text-indigo-400">
                    {submittedAttempt.score}
                  </span>
                  <span className="text-[10px] text-slate-500 block">/ {submittedAttempt.totalMarks}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block font-medium">Percentage</span>
                  <span className="text-2xl font-bold font-mono text-white">
                    {submittedAttempt.percentage}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">Calculated</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block font-medium">Result</span>
                  <span
                    className={`text-sm font-bold block mt-1 ${
                      submittedAttempt.passed ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {submittedAttempt.passed ? 'QUALIFIED' : 'NOT QUALIFIED'}
                  </span>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-950/80 rounded-lg text-xs text-slate-400 font-mono text-left space-y-1">
              <div>Drive: <span className="text-slate-200">{submittedAttempt.assessmentTitle}</span></div>
              <div>Attempt ID: <span className="text-indigo-400">{submittedAttempt.id}</span></div>
              <div>Timestamp: <span className="text-slate-200">{new Date(submittedAttempt.submittedAt || '').toLocaleString()}</span></div>
              <div>Proctor Violations: <span className="text-slate-200">{submittedAttempt.tabSwitchCount} tab switches</span></div>
            </div>

            {certificateDownloadNotice && (
              <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300">
                {certificateDownloadNotice}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const file = downloadCandidatePdfCertificate(
                    submittedAttempt,
                    activeAssessment,
                    {
                      hideScoresForCandidate: isScoreWithheld,
                    }
                  );
                  setCertificateDownloadNotice(
                    `Downloaded official PDF certificate (${file}).`
                  );
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 transition shadow-lg shadow-indigo-600/25 inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF Certificate</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSubmittedAttempt(null);
                  setActiveAssessment(null);
                  setCertificateDownloadNotice(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition"
              >
                Take Another Assessment
              </button>
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-indigo-500/40 transition"
              >
                Return to Home
              </button>
            </div>
          </div>
        ) : !activeAssessment ? (
          /* Step 1: Enter Assessment Code */
          <div key="step-code" className="animate-page-enter max-w-md mx-auto rounded-2xl bg-slate-900/80 border border-slate-800 p-8 space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                <Terminal className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Candidate Examination Portal
              </h2>
              <p className="text-xs text-slate-400">
                Enter your university placement examination code to enter the <AttlicWordmark /> Test Hall.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Assessment Access Code
                </label>
                <input
                  type="text"
                  required
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CAMPUS-2026-CS"
                  className="w-full px-3.5 py-2.5 text-center text-sm font-mono font-bold tracking-widest bg-slate-950 border border-slate-800 rounded-lg text-indigo-400 uppercase placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || !testCode.trim()}
                className="w-full py-2.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition shadow-sm shadow-indigo-600/30 flex items-center justify-center gap-1.5"
              >
                {isVerifying ? (
                  <>
                    <WaitingAnimation size="xs" inline />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Candidate Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              {isVerifying && (
                <div className="pt-2">
                  <WaitingAnimation
                    size="sm"
                    label="Verifying assessment access code..."
                  />
                </div>
              )}
            </form>

            {/* Quick Demo Code helper chips (Only published active assessments when present) */}
            {publishedDemoAssessments.length > 0 && (
              <div className="pt-4 border-t border-slate-800/80 space-y-2 text-center">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Or Quick-Select Active Campus Drive:
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  {publishedDemoAssessments.slice(0, 3).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setTestCode(a.code);
                        verifyCode(a.code);
                      }}
                      className="px-2.5 py-1 text-[11px] font-mono rounded-md bg-slate-950 border border-slate-800 text-indigo-300 hover:text-white hover:border-slate-700 transition"
                    >
                      {a.code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Candidate Registration Verification */
          <div key="step-register" className="animate-page-enter max-w-lg mx-auto rounded-2xl bg-slate-900/80 border border-slate-800 p-8 space-y-6 shadow-2xl">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                Assessment Verified • {activeAssessment.code}
              </span>
              <h2 className="text-xl font-bold text-white">
                {activeAssessment.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {activeAssessment.durationMinutes} Minutes
                </span>
                <span>•</span>
                <span>{activeAssessment.totalMarks} Marks</span>
                <span>•</span>
                <span>{activeAssessment.sections.reduce((c, s) => c + s.questions.length, 0)} Questions</span>
              </div>

              {/* Scheduled Window / Domain Whitelist Notice */}
              {(activeAssessment.scheduledStartAt ||
                activeAssessment.scheduledEndAt ||
                (activeAssessment.allowedEmailDomains &&
                  activeAssessment.allowedEmailDomains.length > 0)) && (
                <div className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  {(activeAssessment.scheduledStartAt || activeAssessment.scheduledEndAt) && (
                    <div className="flex items-center gap-1.5 text-indigo-300">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Window:{' '}
                        {activeAssessment.scheduledStartAt
                          ? new Date(activeAssessment.scheduledStartAt).toLocaleString()
                          : 'Open'}{' '}
                        —{' '}
                        {activeAssessment.scheduledEndAt
                          ? new Date(activeAssessment.scheduledEndAt).toLocaleString()
                          : 'Open'}
                      </span>
                    </div>
                  )}
                  {activeAssessment.allowedEmailDomains &&
                    activeAssessment.allowedEmailDomains.length > 0 && (
                      <div className="text-slate-400">
                        Authorized Email Domains:{' '}
                        <span className="font-mono text-indigo-300">
                          {activeAssessment.allowedEmailDomains
                            .map((d) => (d.includes('@') ? d : `@${d}`))
                            .join(', ')}
                        </span>
                      </div>
                    )}
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleStartExam} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Full Name (As on College ID) *
                </label>
                <input
                  type="text"
                  required
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g. Priyanshu Sharma"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  College Email *
                </label>
                <input
                  type="email"
                  required
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeAssessment.candidateDetailsConfig?.collectRollNumber !== false && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Roll Number / Student ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="22BCS0142"
                      className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {activeAssessment.candidateDetailsConfig?.collectPhone && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Phone Number / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeAssessment.candidateDetailsConfig?.collectCollege !== false && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      University / College *
                    </label>
                    <input
                      type="text"
                      required
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="Enter your university or college name"
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {activeAssessment.candidateDetailsConfig?.collectBranch !== false && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Academic Branch *
                    </label>
                    <input
                      type="text"
                      required
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="Enter your branch / department"
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              {(activeAssessment.candidateDetailsConfig?.collectGraduationYear ||
                activeAssessment.candidateDetailsConfig?.collectCgpa) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeAssessment.candidateDetailsConfig?.collectGraduationYear && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Graduation Batch / Year
                      </label>
                      <input
                        type="number"
                        value={graduationYear}
                        onChange={(e) => setGraduationYear(e.target.value)}
                        placeholder="2026"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}

                  {activeAssessment.candidateDetailsConfig?.collectCgpa && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        CGPA / Percentage
                      </label>
                      <input
                        type="text"
                        value={cgpa}
                        onChange={(e) => setCgpa(e.target.value)}
                        placeholder="e.g. 8.75 or 85%"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Recruiter Custom Fields */}
              {activeAssessment.candidateDetailsConfig?.customFields &&
                activeAssessment.candidateDetailsConfig.customFields.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider block">
                      Additional Details Required by Recruiter:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeAssessment.candidateDetailsConfig.customFields.map((cf) => (
                        <div key={cf.id} className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">
                            {cf.label} {cf.required && '*'}
                          </label>
                          <input
                            type={cf.type === 'number' ? 'number' : 'text'}
                            required={cf.required}
                            value={customFieldsValues[cf.id] || ''}
                            onChange={(e) =>
                              setCustomFieldsValues({
                                ...customFieldsValues,
                                [cf.id]: e.target.value,
                              })
                            }
                            placeholder={cf.placeholder || `Enter ${cf.label}`}
                            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Optional 1-Snapshot Verification Card (Only shown when recruiter enabled requireCandidateSnapshot) */}
              {activeAssessment.requireCandidateSnapshot && (
                <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-white">
                        Candidate Verification Snapshot (1 Photo for PDF Certificate) *
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        snapshotDataUrl
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {snapshotDataUrl ? 'Snapshot Captured' : 'Required'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    This assessment requires one verification snapshot before starting. Your snapshot will be attached directly to your official PDF Verification Certificate.
                  </p>

                  {snapshotDataUrl ? (
                    <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="flex items-center gap-3">
                        <img
                          src={snapshotDataUrl}
                          alt="Captured Candidate Snapshot"
                          className="w-24 h-18 object-cover rounded-lg border border-indigo-500/40"
                        />
                        <div className="text-xs space-y-0.5">
                          <span className="text-emerald-400 font-semibold block">
                            ✓ Single Snapshot Ready
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            Will be embedded on your PDF Scorecard &amp; Certificate
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSnapshotDataUrl(null);
                          startCameraPreview();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retake</span>
                      </button>
                    </div>
                  ) : isCameraOpen ? (
                    <div className="space-y-3">
                      <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 max-w-[260px] mx-auto">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-44 object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleCaptureSingleSnapshot}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Capture 1 Snapshot</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopCameraStream}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={startCameraPreview}
                        className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Open Camera &amp; Take Snapshot</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleUseDigitalSnapshotFallback}
                        className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium"
                      >
                        Attach Verified Digital ID Stamp
                      </button>
                    </div>
                  )}

                  {cameraError && (
                    <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200 flex items-center justify-between gap-2">
                      <span>{cameraError}</span>
                      <button
                        type="button"
                        onClick={handleUseDigitalSnapshotFallback}
                        className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold shrink-0"
                      >
                        Use ID Stamp
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Candidate Consent & Academic Honor Code */}
              <div className="pt-3 border-t border-slate-800">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={hasConsented}
                    onChange={(e) => setHasConsented(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="leading-snug">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('terms')}
                      className="text-indigo-400 hover:text-indigo-300 underline font-medium"
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('privacy')}
                      className="text-indigo-400 hover:text-indigo-300 underline font-medium"
                    >
                      Privacy Policy
                    </button>
                    . I pledge to take this examination independently without unauthorized aids.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setActiveAssessment(null);
                    if (typeof window !== 'undefined' && window.history.state?.candidateStep === 'register') {
                      window.history.back();
                    } else if (onRouteStepChange) {
                      onRouteStepChange('code', '');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Change Code
                </button>

                <button
                  type="submit"
                  disabled={!hasConsented}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition shadow-sm shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <span>Enter Examination Hall</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
