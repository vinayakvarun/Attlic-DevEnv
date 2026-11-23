/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Assessment Appearance & Customization Studio
 * Split-Screen: Customization Controls (Left) + Interactive Live Candidate Preview (Right)
 */

import React, { useState, useMemo } from 'react';
import {
  Assessment,
  AssessmentAppearance,
  PredefinedTheme,
  AppearanceColors,
  AppearanceCandidateExperience,
  FontFamily,
  FontSizeScale,
  LineSpacingScale,
  Question,
} from '../../types';
import { BrandLogo, AttlicWordmark, renderWithAttlicBrand } from '../common/BrandLogo';
import {
  THEME_PRESETS,
  DEFAULT_PREMADE_THEME_KEYS,
  FRUIT_THEME_KEYS,
  CURATED_COLOR_SWATCHES,
  getDefaultAppearance,
  applyThemeToAppearance,
  getScopedStudentThemeStyle,
  FONT_FAMILY_CLASSES,
  FONT_SIZE_CLASSES,
  LINE_SPACING_CLASSES,
  BUTTON_RADIUS_CLASSES,
} from '../../utils/appearanceDefaults';
import {
  Palette,
  Type,
  Layout,
  Sparkles,
  Building2,
  Sliders,
  Monitor,
  Smartphone,
  RotateCcw,
  Upload,
  Trash2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Copy,
  Clock,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Shield,
  HelpCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Info,
  Maximize2,
} from 'lucide-react';

interface AppearanceStudioProps {
  assessment: Assessment;
  onUpdateAssessment: (updated: Assessment) => void;
  onOpenCandidatePortalWithCode: (code: string) => void;
}

type StudioTab = 'themes' | 'colors' | 'typography' | 'layout' | 'branding' | 'experience';

export const AppearanceStudio: React.FC<AppearanceStudioProps> = ({
  assessment,
  onUpdateAssessment,
  onOpenCandidatePortalWithCode,
}) => {
  // Ensure appearance is initialized
  const appearance: AssessmentAppearance = useMemo(() => {
    return assessment.appearance || getDefaultAppearance(assessment.companyName || assessment.organizationName);
  }, [assessment.appearance, assessment.companyName, assessment.organizationName]);

  const [activeTab, setActiveTab] = useState<StudioTab>('themes');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewScreen, setPreviewScreen] = useState<'exam' | 'welcome'>('exam');
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0);
  const [previewSelectedOptions, setPreviewSelectedOptions] = useState<Record<string, string[]>>({});
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // Representative questions from the assessment or fallback mock
  const previewQuestions: Question[] = useMemo(() => {
    const list = assessment.sections.flatMap((s) => s.questions);
    if (list.length > 0) return list;
    return [
      {
        id: 'sample_q1',
        type: 'single_choice',
        title: 'Which sorting algorithm exhibits the most optimal worst-case time complexity?',
        explanation: 'MergeSort guarantees O(n log n) worst-case performance under all input arrangements.',
        marks: 4,
        negativeMarks: 1,
        difficulty: 'medium',
        correctOptionIds: ['opt_b'],
        options: [
          { id: 'opt_a', text: 'QuickSort (Naive pivot)', isCorrect: false },
          { id: 'opt_b', text: 'MergeSort', isCorrect: true },
          { id: 'opt_c', text: 'BubbleSort', isCorrect: false },
          { id: 'opt_d', text: 'SelectionSort', isCorrect: false },
        ],
      },
      {
        id: 'sample_q2',
        type: 'multiple_choice',
        title: 'Select all true statements regarding modern distributed systems.',
        marks: 5,
        negativeMarks: 1,
        difficulty: 'hard',
        correctOptionIds: ['opt_1', 'opt_3'],
        options: [
          { id: 'opt_1', text: 'Eventual consistency allows high write availability.', isCorrect: true },
          { id: 'opt_2', text: 'Network partitions never happen in modern VPCs.', isCorrect: false },
          { id: 'opt_3', text: 'Idempotency keys prevent duplicate transaction processing.', isCorrect: true },
        ],
      },
      {
        id: 'sample_q3',
        type: 'true_false',
        title: 'HTTP/2 introduces multiplexing over a single TCP connection.',
        marks: 2,
        negativeMarks: 0.5,
        difficulty: 'easy',
        correctOptionIds: ['opt_true'],
        options: [
          { id: 'opt_true', text: 'True', isCorrect: true },
          { id: 'opt_false', text: 'False', isCorrect: false },
        ],
      },
    ];
  }, [assessment.sections]);

  const currentPreviewQ = previewQuestions[previewQuestionIndex] || previewQuestions[0];

  // Helper to commit appearance changes
  const updateAppearance = (patch: Partial<AssessmentAppearance>) => {
    const nextAppearance: AssessmentAppearance = {
      ...appearance,
      ...patch,
    };
    onUpdateAssessment({
      ...assessment,
      appearance: nextAppearance,
      updatedAt: new Date().toISOString(),
    });
  };

  // Helper to update colors
  const updateColors = (colorKey: keyof AssessmentAppearance['colors'], value: string) => {
    updateAppearance({
      colors: {
        ...appearance.colors,
        [colorKey]: value,
      },
    });
  };

  // Switch Theme Preset
  const handleSelectTheme = (theme: PredefinedTheme) => {
    const updated = applyThemeToAppearance(theme, appearance);
    updateAppearance(updated);
  };

  // Reset to default
  const handleResetToDefault = () => {
    const reset = getDefaultAppearance(assessment.companyName || assessment.organizationName);
    updateAppearance(reset);
  };

  // Handle Logo File Upload (Validation: Type and Size <= 2MB)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploadError(null);

    // Validate mime type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setLogoUploadError('Please upload a valid image file (PNG, JPG, SVG, or WebP).');
      return;
    }

    // Validate size (2MB = 2 * 1024 * 1024 bytes)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setLogoUploadError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 2MB.`);
      return;
    }

    // Convert to Base64 Data URL for instant rendering and storage
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      updateAppearance({
        branding: {
          ...appearance.branding,
          companyLogoUrl: result,
          showCompanyLogo: true,
        },
      });
    };
    reader.onerror = () => {
      setLogoUploadError('Failed to read image file. Please try another image.');
    };
    reader.readAsDataURL(file);
  };

  // Handle preview option click
  const handlePreviewOptionClick = (optId: string) => {
    if (!currentPreviewQ) return;
    const qId = currentPreviewQ.id;

    if (currentPreviewQ.type === 'multiple_choice') {
      const current = previewSelectedOptions[qId] || [];
      const next = current.includes(optId)
        ? current.filter((id) => id !== optId)
        : [...current, optId];
      setPreviewSelectedOptions({ ...previewSelectedOptions, [qId]: next });
    } else {
      setPreviewSelectedOptions({ ...previewSelectedOptions, [qId]: [optId] });
    }
  };

  // Format Hex string safely
  const handleHexInput = (colorKey: keyof AssessmentAppearance['colors'], inputVal: string) => {
    let clean = inputVal.trim();
    if (!clean.startsWith('#') && clean.length > 0) {
      clean = '#' + clean;
    }
    updateColors(colorKey, clean);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-8.5rem)] bg-slate-950 text-slate-100 font-sans">
      {/* Studio Top Control Strip */}
      <div className="px-6 py-3 border-b border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">Appearance & Customization Studio</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Candidate-Facing Styling
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Customize fruit-inspired themes, Ubuntu typography, logos, and candidate preview.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Reset to Default */}
          <button
            onClick={handleResetToDefault}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
            title="Reset theme and colors to default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset to Default</span>
          </button>

          {/* Device Preview Switcher */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition ${
                deviceMode === 'desktop' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Desktop Preview (Full Width)"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden md:inline">Desktop</span>
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition ${
                deviceMode === 'mobile' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Mobile Preview (Phone Frame)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden md:inline">Mobile (375px)</span>
            </button>
          </div>

          {/* Test Hall Launch */}
          <button
            onClick={() => onOpenCandidatePortalWithCode(assessment.code)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold transition"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Launch Live Test</span>
          </button>
        </div>
      </div>

      {/* Main Split-Screen Workspace (Both Columns Scrollable & Visible) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* ======================================================== */}
        {/* LEFT COLUMN: CUSTOMIZATION SETTINGS (5 Cols on Desktop)  */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col lg:max-h-[calc(100vh-12rem)] bg-slate-950">
          {/* Customization Navigation Tabs (Wraps so Candidate Section is always visible) */}
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-900/40 p-2 shrink-0">
            {[
              { id: 'themes', label: 'Fruit Themes', icon: Sparkles },
              { id: 'colors', label: 'Colors', icon: Palette },
              { id: 'typography', label: 'Typography', icon: Type },
              { id: 'layout', label: 'Layout', icon: Layout },
              { id: 'branding', label: 'Branding', icon: Building2 },
              { id: 'experience', label: 'Candidate Section', icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as StudioTab)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    isActive
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-bold shadow-sm'
                      : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Customization Controls Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* TAB 1: 4 PREMADE DEFAULT THEMES + 40 NAMED THEMES */}
            {activeTab === 'themes' && (
              <div className="space-y-5 animate-fadeIn">
                {/* 4 PREMADE DEFAULT THEMES (ALL WITH DEFAULT ORANGE ACCENTS) */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/35 space-y-3.5 shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                          4 Premade Default Themes
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          Default Orange Accents
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Curated monochrome and neutral studio themes — all paired with <AttlicWordmark /> default pastel-orange accents.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {DEFAULT_PREMADE_THEME_KEYS.map((thmKey, idx) => {
                      const preset = THEME_PRESETS[thmKey];
                      const isSelected = appearance.theme === thmKey;
                      return (
                        <div
                          key={thmKey}
                          onClick={() => handleSelectTheme(thmKey)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-2.5 ${
                            isSelected
                              ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500 shadow-lg'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                  {idx + 1}.
                                </span>
                                <span className="text-xs font-bold text-white">{preset.name}</span>
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded border"
                                  style={{
                                    backgroundColor: preset.colors.cardBackground,
                                    color: preset.colors.primary,
                                    borderColor: `${preset.colors.primary}55`,
                                  }}
                                >
                                  {renderWithAttlicBrand(preset.badge)}
                                </span>
                                {isSelected && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>Active</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                {preset.description}
                              </p>
                            </div>

                            <div className="shrink-0 mt-0.5">
                              <input
                                type="radio"
                                name="themePreset"
                                checked={isSelected}
                                onChange={() => handleSelectTheme(thmKey)}
                                className="accent-indigo-500 w-4 h-4 cursor-pointer"
                              />
                            </div>
                          </div>

                          {/* Live Surface + Orange Accent Mini Preview Bar */}
                          <div
                            className="p-2 rounded-lg border flex items-center justify-between gap-3"
                            style={{
                              backgroundColor: preset.colors.background,
                              borderColor: preset.colors.secondary,
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="px-2.5 py-1 rounded text-[10px] font-semibold border flex items-center gap-1.5"
                                style={{
                                  backgroundColor: preset.colors.cardBackground,
                                  borderColor: preset.colors.secondary,
                                  color: preset.colors.textMain,
                                }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: preset.colors.primary }}
                                />
                                <span>{preset.name}</span>
                              </div>
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                                style={{ backgroundColor: preset.colors.buttonPrimary }}
                              >
                                Orange Accent
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {[
                                { c: preset.colors.background, label: 'Background' },
                                { c: preset.colors.cardBackground, label: 'Card Surface' },
                                { c: preset.colors.secondary, label: 'Border / Secondary' },
                                { c: preset.colors.primary, label: 'Orange Primary' },
                                { c: preset.colors.buttonPrimary, label: 'Orange Button' },
                                { c: preset.colors.textMain, label: 'Typography' },
                              ].map((sw, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="w-4 h-4 rounded-full border border-slate-500/40 shadow-sm"
                                  style={{ backgroundColor: sw.c }}
                                  title={`${sw.label}: ${sw.c}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      40 Dark-Background Named Themes
                    </h4>
                    <span className="text-[10px] font-mono text-indigo-400">
                      {FRUIT_THEME_KEYS.length} Distinct Palettes
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Every named theme features a distinct dark-background surface paired with its own unique primary, action button, timer, and highlight palette for the candidate test screen.
                  </p>
                </div>

                {/* Quick-Apply Theme Preset Grid (4 Defaults + All 40 Named Themes) */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-200">
                      Quick-Apply Theme Preset (4 Defaults + {FRUIT_THEME_KEYS.length} Named Themes)
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400 uppercase">
                      Active: {THEME_PRESETS[appearance.theme]?.name || appearance.theme}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-64 overflow-y-auto pr-1">
                    {[...DEFAULT_PREMADE_THEME_KEYS, ...FRUIT_THEME_KEYS].map((thmKey) => {
                      const preset = THEME_PRESETS[thmKey];
                      const active = appearance.theme === thmKey;
                      return (
                        <button
                          key={thmKey}
                          type="button"
                          onClick={() => handleSelectTheme(thmKey)}
                          title={`${preset.name} (${preset.badge})`}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition text-left ${
                            active
                              ? 'border-indigo-400 ring-1 ring-indigo-400/50 shadow-sm'
                              : 'border-slate-700/80 hover:border-slate-500'
                          }`}
                          style={{
                            backgroundColor: preset.colors.cardBackground,
                            color: preset.colors.textMain,
                          }}
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-black/20"
                            style={{ backgroundColor: preset.colors.primary }}
                          />
                          <span className="truncate">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {FRUIT_THEME_KEYS.map((thmKey, idx) => {
                    const preset = THEME_PRESETS[thmKey];
                    const isSelected =
                      appearance.theme === thmKey ||
                      (thmKey === 'kiwi' && appearance.theme === 'dark') ||
                      (thmKey === 'coconut' && appearance.theme === 'light');
                    return (
                      <div
                        key={thmKey}
                        onClick={() => handleSelectTheme(thmKey)}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition flex flex-col gap-3 ${
                          isSelected
                            ? 'bg-indigo-950/35 border-indigo-500 ring-1 ring-indigo-500 shadow-lg'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                #{idx + 1}
                              </span>
                              <span className="text-xs font-bold text-white">{preset.name}</span>
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded border"
                                style={{
                                  backgroundColor: preset.colors.cardBackground,
                                  color: preset.colors.primary,
                                  borderColor: `${preset.colors.primary}45`,
                                }}
                              >
                                {renderWithAttlicBrand(preset.badge)}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Active</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {preset.description}
                            </p>
                          </div>

                          <div className="shrink-0 mt-0.5">
                            <input
                              type="radio"
                              name="themePreset"
                              checked={isSelected}
                              onChange={() => handleSelectTheme(thmKey)}
                              className="accent-indigo-500 w-4 h-4 cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Live Dark Background + Card + Fruit Accent Mini Preview Bar */}
                        <div
                          className="p-2.5 rounded-lg border flex items-center justify-between gap-3"
                          style={{
                            backgroundColor: preset.colors.background,
                            borderColor: preset.colors.secondary,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="px-2.5 py-1 rounded text-[10px] font-semibold border flex items-center gap-1.5"
                              style={{
                                backgroundColor: preset.colors.cardBackground,
                                borderColor: preset.colors.secondary,
                                color: preset.colors.textMain,
                              }}
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: preset.colors.primary }}
                              />
                              <span>{preset.fruit}</span>
                            </div>
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                              style={{ backgroundColor: preset.colors.buttonPrimary }}
                            >
                              Action
                            </span>
                            <span
                              className="text-[10px] font-mono font-bold"
                              style={{ color: preset.colors.timerColor }}
                            >
                              45:00
                            </span>
                          </div>

                          {/* 6 Labeled Color Swatches */}
                          <div className="flex items-center gap-1.5">
                            {[
                              { c: preset.colors.background, label: 'Dark Background' },
                              { c: preset.colors.cardBackground, label: 'Card Surface' },
                              { c: preset.colors.secondary, label: 'Secondary Panel' },
                              { c: preset.colors.primary, label: 'Primary Accent' },
                              { c: preset.colors.buttonPrimary, label: 'Action Button' },
                              { c: preset.colors.accent, label: 'Highlight Accent' },
                            ].map((sw, sIdx) => (
                              <span
                                key={sIdx}
                                className="w-5 h-5 rounded-full border border-white/25 shadow-sm"
                                style={{ backgroundColor: sw.c }}
                                title={`${sw.label}: ${sw.c}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: REBUILT COLOR CUSTOMIZATION WITH CURATED DARK & FRUIT SWATCHES */}
            {activeTab === 'colors' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Dark-Background &amp; Named Theme Color Studio
                  </h4>
                  <p className="text-xs text-slate-400">
                    Quickly switch between all {FRUIT_THEME_KEYS.length} distinct named palettes or fine-tune each surface and accent using curated dark-theme swatches below.
                  </p>
                </div>

                {/* Quick 4 Default + 40-Theme Palette Selector inside Colors Tab */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300">
                      Quick-Apply Theme Preset (4 Defaults + {FRUIT_THEME_KEYS.length} Named Themes)
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400 uppercase">
                      {THEME_PRESETS[appearance.theme]?.name || appearance.theme}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-64 overflow-y-auto pr-1">
                    {[...DEFAULT_PREMADE_THEME_KEYS, ...FRUIT_THEME_KEYS].map((thmKey) => {
                      const preset = THEME_PRESETS[thmKey];
                      const active = appearance.theme === thmKey;
                      return (
                        <button
                          key={thmKey}
                          type="button"
                          onClick={() => handleSelectTheme(thmKey)}
                          title={`${preset.name} (${preset.badge})`}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition text-left ${
                            active
                              ? 'border-indigo-400 ring-1 ring-indigo-400/50 shadow-sm'
                              : 'border-slate-700/80 hover:border-slate-500'
                          }`}
                          style={{
                            backgroundColor: preset.colors.cardBackground,
                            color: preset.colors.textMain,
                          }}
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-black/20"
                            style={{ backgroundColor: preset.colors.primary }}
                          />
                          <span className="truncate">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  {(
                    [
                      {
                        key: 'background',
                        label: 'Page Background (Darkish Backdrop)',
                        desc: 'Outer examination hall dark background — curated deep hues for zero eye strain',
                      },
                      {
                        key: 'cardBackground',
                        label: 'Question Card Background (Elevated Dark Surface)',
                        desc: 'Active problem statement & options container surface',
                      },
                      {
                        key: 'secondary',
                        label: 'Secondary Panel & Border Surface',
                        desc: 'Question palette container, option hover states, and dividers',
                      },
                      {
                        key: 'primary',
                        label: 'Primary Fruit Accent',
                        desc: 'Selected option borders, active section indicators, and highlights',
                      },
                      {
                        key: 'buttonPrimary',
                        label: 'Primary Action Button Color',
                        desc: 'Save & Next, Begin Exam, and primary CTA buttons',
                      },
                      {
                        key: 'accent',
                        label: 'Secondary Fruit Highlight / Badge',
                        desc: 'Marks badge, completion highlights, and status accents',
                      },
                      {
                        key: 'timerColor',
                        label: 'Countdown Timer Color',
                        desc: 'Live remaining exam clock readout in the top bar',
                      },
                      {
                        key: 'progressIndicator',
                        label: 'Progress Bar Fill Color',
                        desc: 'Continuous completion progress bar and percentage badge',
                      },
                      {
                        key: 'textMain',
                        label: 'Primary Text Color',
                        desc: 'High-contrast light text for question statements and headings',
                      },
                      {
                        key: 'textSecondary',
                        label: 'Secondary Text Color',
                        desc: 'Tinted fruit-mist text for instructions, subtitles, and metadata',
                      },
                    ] as Array<{ key: keyof AppearanceColors; label: string; desc: string }>
                  ).map((field) => {
                    const colorVal = appearance.colors[field.key] || '#ffffff';
                    const curatedSwatches = CURATED_COLOR_SWATCHES[field.key] || [];
                    return (
                      <div
                        key={field.key}
                        className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <label className="text-xs font-semibold text-slate-200 block">
                              {field.label}
                            </label>
                            <span className="text-[10px] text-slate-400 block">{field.desc}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Native Color Picker */}
                            <div className="relative">
                              <input
                                type="color"
                                value={colorVal.length === 7 ? colorVal : '#4cbba1'}
                                onChange={(e) => updateColors(field.key, e.target.value)}
                                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-slate-700 p-0 overflow-hidden"
                              />
                            </div>

                            {/* Hex Input */}
                            <input
                              type="text"
                              value={colorVal}
                              onChange={(e) => handleHexInput(field.key, e.target.value)}
                              placeholder="#000000"
                              className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 uppercase focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        {/* 10 Curated Swatches for this Token */}
                        {curatedSwatches.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                            <span className="text-[10px] text-slate-500 font-mono mr-1">
                              Presets:
                            </span>
                            {curatedSwatches.map((swatchHex, sIdx) => {
                              const isCurrentSwatch =
                                colorVal.toLowerCase() === swatchHex.toLowerCase();
                              const fruitName =
                                THEME_PRESETS[FRUIT_THEME_KEYS[sIdx]]?.fruit || `Option ${sIdx + 1}`;
                              return (
                                <button
                                  key={swatchHex + sIdx}
                                  type="button"
                                  onClick={() => updateColors(field.key, swatchHex)}
                                  title={`${fruitName}: ${swatchHex}`}
                                  className={`w-5 h-5 rounded-md border transition transform hover:scale-110 ${
                                    isCurrentSwatch
                                      ? 'border-white ring-2 ring-indigo-400 scale-110'
                                      : 'border-white/20 hover:border-white/60'
                                  }`}
                                  style={{ backgroundColor: swatchHex }}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: TYPOGRAPHY */}
            {activeTab === 'typography' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Typography & Text Hierarchy
                  </h4>
                  <p className="text-xs text-slate-400">
                    Configure web-safe typography, font sizes, and line-heights to guarantee maximum candidate readability.
                  </p>
                </div>

                {/* Font Family */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-200 block">
                    Font Family
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'sans', label: 'Ubuntu (Default)', desc: 'Clean, modern Ubuntu UI font' },
                      { id: 'roboto', label: 'Roboto / Geometric', desc: 'Neutral, clean readability' },
                      { id: 'serif', label: 'Editorial Serif', desc: 'Traditional academic exam format' },
                      { id: 'mono', label: 'Ubuntu Mono', desc: 'Technical & code-oriented' },
                      { id: 'poppins', label: 'Poppins / Rounded', desc: 'Warm, student-friendly style' },
                    ].map((f) => {
                      const isSelected = appearance.typography.fontFamily === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() =>
                            updateAppearance({
                              typography: {
                                ...appearance.typography,
                                fontFamily: f.id as FontFamily,
                              },
                            })
                          }
                          className={`p-3 rounded-xl border text-left transition ${
                            isSelected
                              ? 'bg-indigo-950/20 border-indigo-500 ring-1 ring-indigo-500 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold">{f.label}</div>
                          <div className="text-[10px] text-slate-400">{f.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scale Sliders / Selectors */}
                <div className="space-y-3 pt-2">
                  {/* Heading Size */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-200 block">Section & Header Font Size</label>
                      <span className="text-[10px] text-slate-400">Scale of top bar & section banners</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      {(['sm', 'md', 'lg', 'xl'] as FontSizeScale[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            updateAppearance({
                              typography: { ...appearance.typography, headingSize: s },
                            })
                          }
                          className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase transition ${
                            appearance.typography.headingSize === s
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Prompt Size */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-200 block">Question Problem Statement Size</label>
                      <span className="text-[10px] text-slate-400">Text size of main question statement</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      {(['sm', 'md', 'lg', 'xl'] as FontSizeScale[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            updateAppearance({
                              typography: { ...appearance.typography, questionSize: s },
                            })
                          }
                          className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase transition ${
                            appearance.typography.questionSize === s
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Option Text Size */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-200 block">Answer Option Font Size</label>
                      <span className="text-[10px] text-slate-400">Scale of multiple-choice radio / checkboxes</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      {(['sm', 'md', 'lg'] as FontSizeScale[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            updateAppearance({
                              typography: { ...appearance.typography, optionSize: s },
                            })
                          }
                          className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase transition ${
                            appearance.typography.optionSize === s
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Line Spacing */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-200 block">Question Line Spacing</label>
                      <span className="text-[10px] text-slate-400">Leading line height for long problem statements</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      {(['tight', 'normal', 'relaxed'] as LineSpacingScale[]).map((sp) => (
                        <button
                          key={sp}
                          type="button"
                          onClick={() =>
                            updateAppearance({
                              typography: { ...appearance.typography, lineSpacing: sp },
                            })
                          }
                          className={`px-2.5 py-0.5 rounded text-[11px] font-mono capitalize transition ${
                            appearance.typography.lineSpacing === sp
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {sp}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: LAYOUT & STRUCTURE */}
            {activeTab === 'layout' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Candidate Examination Layout
                  </h4>
                  <p className="text-xs text-slate-400">
                    Configure question cards, header styles, button geometry, and palette placement.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Question Card Design */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200 block">Question Card Design</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'bordered', label: 'Bordered Stroke', desc: 'Clean 1px border highlight' },
                        { id: 'elevated', label: 'Elevated Shadow', desc: 'Pronounced shadow depth' },
                        { id: 'flat', label: 'Flat Canvas', desc: 'Minimal flush surface' },
                        { id: 'glass', label: 'Glassmorphism', desc: 'Translucent frosted backdrop' },
                      ].map((cd) => (
                        <button
                          key={cd.id}
                          type="button"
                          onClick={() =>
                            updateAppearance({
                              layout: {
                                ...appearance.layout,
                                questionCardDesign: cd.id as any,
                              },
                            })
                          }
                          className={`p-2.5 rounded-xl border text-left transition ${
                            appearance.layout.questionCardDesign === cd.id
                              ? 'bg-indigo-950/20 border-indigo-500 ring-1 ring-indigo-500 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold">{cd.label}</div>
                          <div className="text-[10px] text-slate-400">{cd.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Header Layout */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200 block">Header Navigation Layout</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'standard', label: 'Standard Split', desc: 'Logo left, timer right' },
                        { id: 'compact', label: 'Compact Sleek', desc: 'Condensed 48px height' },
                        { id: 'centered', label: 'Centered Title', desc: 'Logo & exam title centered' },
                        { id: 'minimal', label: 'Minimal Timer Only', desc: 'Focus strictly on countdown' },
                      ].map((hl) => (
                        <button
                          key={hl.id}
                          type="button"
                          onClick={() =>
                            updateAppearance({
                              layout: {
                                ...appearance.layout,
                                headerLayout: hl.id as any,
                              },
                            })
                          }
                          className={`p-2.5 rounded-xl border text-left transition ${
                            appearance.layout.headerLayout === hl.id
                              ? 'bg-indigo-950/20 border-indigo-500 ring-1 ring-indigo-500 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold">{hl.label}</div>
                          <div className="text-[10px] text-slate-400">{hl.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Palette Style */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-200 block">Question Navigation Style</label>
                      <span className="text-[10px] text-slate-400">Palette grid vs question list</span>
                    </div>
                    <select
                      value={appearance.layout.questionNavigationPanel}
                      onChange={(e) =>
                        updateAppearance({
                          layout: {
                            ...appearance.layout,
                            questionNavigationPanel: e.target.value as any,
                          },
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="palette">Grid Question Palette</option>
                      <option value="list">Vertical Question List</option>
                      <option value="compact_bar">Compact Bottom Bar</option>
                    </select>
                  </div>

                  {/* Button Appearance (Radius) */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-200 block">Button Shape & Geometry</label>
                      <span className="text-[10px] text-slate-400">Corner radius of candidate interactive controls</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      {[
                        { id: 'rounded-none', label: 'Square' },
                        { id: 'rounded-md', label: 'Rounded' },
                        { id: 'pill', label: 'Soft Pill' },
                        { id: 'rounded-full', label: 'Full Pill' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            updateAppearance({
                              layout: {
                                ...appearance.layout,
                                buttonAppearance: b.id as any,
                              },
                            })
                          }
                          className={`px-2 py-0.5 rounded text-[11px] transition ${
                            appearance.layout.buttonAppearance === b.id
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Progress Bar Style */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-200 block">Progress Bar Representation</label>
                      <span className="text-[10px] text-slate-400">Exam completion gauge format</span>
                    </div>
                    <select
                      value={appearance.layout.progressBar}
                      onChange={(e) =>
                        updateAppearance({
                          layout: {
                            ...appearance.layout,
                            progressBar: e.target.value as any,
                          },
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="bar">Continuous Progress Bar</option>
                      <option value="percentage_pill">Numeric Percentage Badge</option>
                      <option value="step_dots">Step Question Dots</option>
                      <option value="none">Hidden</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: BRANDING & LOGO */}
            {activeTab === 'branding' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Company Branding & Visual Assets
                  </h4>
                  <p className="text-xs text-slate-400">
                    Upload your organization logo and personalize the candidate welcome notice.
                  </p>
                </div>

                {/* Logo Upload Card */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <label className="text-xs font-semibold text-slate-200 block">
                    Company Logo Asset (PNG, SVG, JPG, WebP &le; 2MB)
                  </label>

                  {appearance.branding.companyLogoUrl ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex items-center gap-3">
                        <img
                          src={appearance.branding.companyLogoUrl}
                          alt="Logo Preview"
                          className="w-12 h-12 object-contain rounded-md bg-slate-900 p-1 border border-slate-800"
                        />
                        <div>
                          <span className="text-xs font-bold text-white block">Logo Uploaded</span>
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active in candidate header</span>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateAppearance({
                            branding: {
                              ...appearance.branding,
                              companyLogoUrl: undefined,
                            },
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 hover:bg-rose-950/50 text-xs font-medium flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-950/50 hover:bg-slate-950">
                      <Upload className="w-6 h-6 text-indigo-400" />
                      <div className="text-center">
                        <span className="text-xs font-semibold text-slate-200 block">Click to upload company logo</span>
                        <span className="text-[10px] text-slate-500">Max size 2MB. Transparent PNG or SVG recommended</span>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  )}

                  {logoUploadError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>{logoUploadError}</span>
                    </div>
                  )}
                </div>

                {/* Company Display Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200 block">
                    Company Display Name
                  </label>
                  <input
                    type="text"
                    value={appearance.branding.companyDisplayName || ''}
                    onChange={(e) =>
                      updateAppearance({
                        branding: {
                          ...appearance.branding,
                          companyDisplayName: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Acme Tech Labs"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Welcome Message */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200 block">
                    Custom Welcome Screen Notice
                  </label>
                  <textarea
                    rows={3}
                    value={appearance.branding.welcomeMessage || ''}
                    onChange={(e) =>
                      updateAppearance({
                        branding: {
                          ...appearance.branding,
                          welcomeMessage: e.target.value,
                        },
                      })
                    }
                    placeholder="Welcome instructions shown to candidates prior to launching the exam..."
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>

                {/* Footer Branding Text */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200 block">
                    Footer Branding Note
                  </label>
                  <input
                    type="text"
                    value={appearance.branding.footerBrandingText || ''}
                    onChange={(e) =>
                      updateAppearance({
                        branding: {
                          ...appearance.branding,
                          footerBrandingText: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Acme Campus Recruitment Cell 2026"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* TAB 6: CANDIDATE EXPERIENCE & VISIBILITY TOGGLES */}
            {activeTab === 'experience' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Candidate Visibility Controls
                  </h4>
                  <p className="text-xs text-slate-400">
                    Select exactly what examination metadata is shown to students during test runtime.
                  </p>
                </div>

                {/* Info Note */}
                <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-start gap-2.5 text-xs text-indigo-300">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                  <span>
                    These toggles only govern visual presence on the student screen. Correct answers, solution hints, and scoring keys are never transmitted to candidates.
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(
                    [
                      {
                        key: 'showQuestionNumbers',
                        label: 'Show Question Numbers',
                        desc: 'Displays "Question 1", "Question 2" labels above problem statements.',
                      },
                      {
                        key: 'showTotalQuestionCount',
                        label: 'Show Total Question Count',
                        desc: 'Displays total questions in section (e.g., "Question 2 of 25").',
                      },
                      {
                        key: 'showQuestionMarks',
                        label: 'Show Marks per Question',
                        desc: 'Displays positive and negative marking weightage badge (+4 / -1).',
                      },
                      {
                        key: 'showTimer',
                        label: 'Show Countdown Timer',
                        desc: 'Displays the ticking countdown timer in the header.',
                      },
                      {
                        key: 'showProgressPercentage',
                        label: 'Show Progress Percentage',
                        desc: 'Displays calculated completion percent badge (e.g., "64% Complete").',
                      },
                      {
                        key: 'showAnswerStatus',
                        label: 'Show Answered / Visited Indicators',
                        desc: 'Color-codes palette buttons (answered, unvisited, marked for review).',
                      },
                      {
                        key: 'showSectionProgress',
                        label: 'Show Section Navigation & Progress',
                        desc: 'Displays multi-section tabs or dropdown switcher.',
                      },
                    ] as Array<{ key: keyof AppearanceCandidateExperience; label: string; desc: string }>
                  ).map((item) => {
                    const isChecked = appearance.candidateExperience[item.key];
                    return (
                      <label
                        key={item.key}
                        className="flex items-start justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition"
                      >
                        <div className="space-y-0.5 pr-3">
                          <span className="text-xs font-semibold text-slate-200 block">{item.label}</span>
                          <span className="text-[10px] text-slate-400 block">{item.desc}</span>
                        </div>

                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            updateAppearance({
                              candidateExperience: {
                                ...appearance.candidateExperience,
                                [item.key]: e.target.checked,
                              },
                            })
                          }
                          className="accent-indigo-500 w-4 h-4 mt-0.5 rounded cursor-pointer shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: INTERACTIVE LIVE CANDIDATE PREVIEW (7 Cols) */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 flex flex-col lg:max-h-[calc(100vh-12rem)] bg-slate-900/40 min-h-[620px]">
          {/* Preview Viewport Toolbar */}
          <div className="px-6 py-2.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Live Candidate Interface Preview
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                (Scrollable interactive test hall simulation)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Screen selector */}
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPreviewScreen('exam')}
                  className={`px-2.5 py-1 rounded text-xs transition ${
                    previewScreen === 'exam' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Exam Hall View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewScreen('welcome')}
                  className={`px-2.5 py-1 rounded text-xs transition ${
                    previewScreen === 'welcome' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Welcome Screen
                </button>
              </div>
            </div>
          </div>

          {/* Preview Container Frame (Scrollable vertically and horizontally) */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex items-start justify-center bg-slate-950/70">
            {/* Viewport Frame Box */}
            <div
              className={`transition-all duration-300 shadow-2xl flex flex-col ${
                deviceMode === 'mobile'
                  ? 'w-[375px] min-h-[667px] rounded-[36px] border-[10px] border-slate-800 ring-2 ring-slate-700/50'
                  : 'w-full min-h-[560px] max-w-5xl rounded-2xl border border-slate-800'
              }`}
              style={{
                ...(getScopedStudentThemeStyle(appearance.colors) as React.CSSProperties),
                fontFamily:
                  appearance.typography.fontFamily === 'serif'
                    ? "'Playfair Display', serif"
                    : appearance.typography.fontFamily === 'mono'
                    ? "'Ubuntu Mono', 'JetBrains Mono', monospace"
                    : "'Ubuntu', 'Inter', sans-serif",
              }}
            >
              {/* PREVIEW SCREEN 1: PRE-EXAM WELCOME SCREEN */}
              {previewScreen === 'welcome' && (
                <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col justify-between space-y-6">
                  {/* Brand & Logo */}
                  <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: appearance.colors.secondary }}>
                    <div className="flex items-center gap-3">
                      {appearance.branding.showCompanyLogo && appearance.branding.companyLogoUrl ? (
                        <img
                          src={appearance.branding.companyLogoUrl}
                          alt="Company Logo"
                          className="h-9 max-w-[120px] object-contain"
                        />
                      ) : (
                        <BrandLogo size="sm" primaryColor={appearance.colors.primary} />
                      )}
                      <div>
                        <span className="text-xs font-bold block" style={{ color: appearance.colors.textMain }}>
                          {appearance.branding.companyDisplayName || assessment.companyName || 'Acme Engineering'}
                        </span>
                        <span className="text-[10px]" style={{ color: appearance.colors.textSecondary }}>
                          Campus Recruitment 2026
                        </span>
                      </div>
                    </div>

                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded"
                      style={{ backgroundColor: appearance.colors.secondary, color: appearance.colors.textSecondary }}
                    >
                      {assessment.code}
                    </span>
                  </div>

                  {/* Main Welcome Message */}
                  <div className="space-y-4 max-w-xl mx-auto text-center py-4">
                    <div
                      className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-white"
                      style={{ backgroundColor: appearance.colors.primary }}
                    >
                      <Shield className="w-6 h-6" />
                    </div>

                    <h2
                      className={`${FONT_SIZE_CLASSES.heading[appearance.typography.headingSize]} font-bold`}
                      style={{ color: appearance.colors.textMain }}
                    >
                      {assessment.title}
                    </h2>

                    <p
                      className={`${FONT_SIZE_CLASSES.general[appearance.typography.generalTextSize]} ${LINE_SPACING_CLASSES[appearance.typography.lineSpacing]}`}
                      style={{ color: appearance.colors.textSecondary }}
                    >
                      {appearance.branding.welcomeMessage}
                    </p>

                    {/* Highlights Cards */}
                    <div className="grid grid-cols-3 gap-3 pt-4 text-left">
                      <div
                        className="p-3 rounded-xl border"
                        style={{
                          backgroundColor: appearance.colors.cardBackground,
                          borderColor: appearance.colors.secondary,
                        }}
                      >
                        <span className="text-[10px] uppercase font-bold block" style={{ color: appearance.colors.textSecondary }}>
                          Total Time
                        </span>
                        <span className="text-sm font-bold block mt-0.5" style={{ color: appearance.colors.timerColor }}>
                          {assessment.durationMinutes} Minutes
                        </span>
                      </div>

                      <div
                        className="p-3 rounded-xl border"
                        style={{
                          backgroundColor: appearance.colors.cardBackground,
                          borderColor: appearance.colors.secondary,
                        }}
                      >
                        <span className="text-[10px] uppercase font-bold block" style={{ color: appearance.colors.textSecondary }}>
                          Questions
                        </span>
                        <span className="text-sm font-bold block mt-0.5" style={{ color: appearance.colors.textMain }}>
                          {previewQuestions.length} Problems
                        </span>
                      </div>

                      <div
                        className="p-3 rounded-xl border"
                        style={{
                          backgroundColor: appearance.colors.cardBackground,
                          borderColor: appearance.colors.secondary,
                        }}
                      >
                        <span className="text-[10px] uppercase font-bold block" style={{ color: appearance.colors.textSecondary }}>
                          Total Score
                        </span>
                        <span className="text-sm font-bold block mt-0.5" style={{ color: appearance.colors.accent }}>
                          {assessment.totalMarks} Marks
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Launch button preview */}
                  <div className="pt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setPreviewScreen('exam')}
                      className={`px-8 py-3 text-xs font-bold text-white shadow-lg transition transform active:scale-95 ${
                        BUTTON_RADIUS_CLASSES[appearance.layout.buttonAppearance]
                      }`}
                      style={{ backgroundColor: appearance.colors.buttonPrimary }}
                    >
                      <span>Begin Examination</span>
                    </button>
                    <p className="text-[10px] pt-3" style={{ color: appearance.colors.textSecondary }}>
                      {renderWithAttlicBrand(appearance.branding.footerBrandingText)}
                    </p>
                  </div>
                </div>
              )}

              {/* PREVIEW SCREEN 2: ACTIVE EXAMINATION HALL */}
              {previewScreen === 'exam' && (
                <div className="flex-1 flex flex-col min-h-full overflow-y-auto">
                  {/* Candidate Header */}
                  <div
                    className="px-4 py-3 border-b flex items-center justify-between shrink-0"
                    style={{
                      borderColor: appearance.colors.secondary,
                      backgroundColor:
                        appearance.layout.headerLayout === 'compact' ? appearance.colors.cardBackground : appearance.colors.background,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {appearance.branding.showCompanyLogo && appearance.branding.companyLogoUrl ? (
                        <img
                          src={appearance.branding.companyLogoUrl}
                          alt="Logo"
                          className="h-6 max-w-[100px] object-contain"
                        />
                      ) : (
                        <BrandLogo size="sm" primaryColor={appearance.colors.primary} />
                      )}

                      {appearance.branding.showTitleDisplay && (
                        <span
                          className="text-xs font-semibold truncate hidden sm:inline"
                          style={{ color: appearance.colors.textMain }}
                        >
                          {assessment.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Live Timer Preview */}
                      {appearance.candidateExperience.showTimer && (
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-bold shadow-sm"
                          style={{
                            backgroundColor: appearance.colors.cardBackground,
                            color: appearance.colors.timerColor,
                            border: `1px solid ${appearance.colors.secondary}`,
                          }}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>44:38</span>
                        </div>
                      )}

                      {/* Progress Badge */}
                      {appearance.candidateExperience.showProgressPercentage && (
                        <span
                          className="px-2 py-1 rounded-lg text-[10px] font-bold"
                          style={{
                            backgroundColor: appearance.colors.secondary,
                            color: appearance.colors.progressIndicator,
                          }}
                        >
                          {Math.round(((previewQuestionIndex + 1) / previewQuestions.length) * 100)}% Complete
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Continuous Progress Bar Preview */}
                  {appearance.layout.progressBar === 'bar' && (
                    <div className="w-full h-1 bg-slate-800/40 overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${((previewQuestionIndex + 1) / previewQuestions.length) * 100}%`,
                          backgroundColor: appearance.colors.progressIndicator,
                        }}
                      />
                    </div>
                  )}

                  {/* Main Center Area: Question + Optional Navigation */}
                  <div className="flex-1 flex flex-col md:flex-row overflow-y-auto">
                    {/* Main Question Panel */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                      {/* Section Navigator Tabs */}
                      {appearance.candidateExperience.showSectionProgress && (
                        <div
                          className="flex items-center gap-2 pb-2 border-b text-xs overflow-x-auto"
                          style={{ borderColor: appearance.colors.secondary }}
                        >
                          <span
                            className="px-3 py-1 rounded-lg font-semibold text-[11px]"
                            style={{
                              backgroundColor: appearance.colors.primary,
                              color: '#ffffff',
                            }}
                          >
                            Section 1: Core Domain
                          </span>
                          <span
                            className="px-3 py-1 rounded-lg text-[11px]"
                            style={{ color: appearance.colors.textSecondary }}
                          >
                            Section 2: Quantitative
                          </span>
                        </div>
                      )}

                      {/* Question Card Box */}
                      {currentPreviewQ && (
                        <div
                          className={`p-5 space-y-4 transition ${
                            appearance.layout.questionCardDesign === 'bordered'
                              ? 'border rounded-xl shadow-sm'
                              : appearance.layout.questionCardDesign === 'elevated'
                              ? 'rounded-2xl shadow-xl'
                              : appearance.layout.questionCardDesign === 'glass'
                              ? 'rounded-2xl backdrop-blur-md border border-white/10'
                              : 'rounded-none'
                          }`}
                          style={{
                            backgroundColor: appearance.colors.cardBackground,
                            borderColor: appearance.colors.secondary,
                          }}
                        >
                          {/* Question Header Meta */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {appearance.candidateExperience.showQuestionNumbers && (
                                <span
                                  className="text-xs font-bold uppercase tracking-wider"
                                  style={{ color: appearance.colors.primary }}
                                >
                                  Question {previewQuestionIndex + 1}
                                  {appearance.candidateExperience.showTotalQuestionCount && (
                                    <span style={{ color: appearance.colors.textSecondary }}>
                                      {' '}of {previewQuestions.length}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>

                            {/* Marks badge */}
                            {appearance.candidateExperience.showQuestionMarks && (
                              <span
                                className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
                                style={{
                                  backgroundColor: appearance.colors.secondary,
                                  color: appearance.colors.accent,
                                }}
                              >
                                +{currentPreviewQ.marks} / -{currentPreviewQ.negativeMarks} Marks
                              </span>
                            )}
                          </div>

                          {/* Question Text */}
                          <h3
                            className={`${FONT_SIZE_CLASSES.question[appearance.typography.questionSize]} ${
                              LINE_SPACING_CLASSES[appearance.typography.lineSpacing]
                            } font-semibold`}
                            style={{ color: appearance.colors.textMain }}
                          >
                            {currentPreviewQ.title}
                          </h3>

                          {/* Options List */}
                          <div className="space-y-2 pt-1">
                            {currentPreviewQ.options.map((opt) => {
                              const isChecked = (previewSelectedOptions[currentPreviewQ.id] || []).includes(opt.id);
                              return (
                                <div
                                  key={opt.id}
                                  onClick={() => handlePreviewOptionClick(opt.id)}
                                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                                    BUTTON_RADIUS_CLASSES[appearance.layout.buttonAppearance]
                                  }`}
                                  style={{
                                    backgroundColor: isChecked ? `${appearance.colors.primary}15` : appearance.colors.background,
                                    borderColor: isChecked ? appearance.colors.primary : appearance.colors.secondary,
                                    color: appearance.colors.textMain,
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition ${
                                        isChecked ? 'text-white' : ''
                                      }`}
                                      style={{
                                        borderColor: isChecked ? appearance.colors.primary : appearance.colors.textSecondary,
                                        backgroundColor: isChecked ? appearance.colors.primary : 'transparent',
                                      }}
                                    >
                                      {isChecked && <Check className="w-2.5 h-2.5" />}
                                    </div>
                                    <span className={FONT_SIZE_CLASSES.option[appearance.typography.optionSize]}>
                                      {opt.text}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Question Navigation Bottom Actions */}
                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          disabled={previewQuestionIndex === 0}
                          onClick={() => setPreviewQuestionIndex((prev) => Math.max(0, prev - 1))}
                          className={`px-3 py-2 text-xs font-medium border flex items-center gap-1.5 transition disabled:opacity-30 ${
                            BUTTON_RADIUS_CLASSES[appearance.layout.buttonAppearance]
                          }`}
                          style={{
                            borderColor: appearance.colors.secondary,
                            backgroundColor: appearance.colors.cardBackground,
                            color: appearance.colors.textMain,
                          }}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Previous</span>
                        </button>

                        <button
                          type="button"
                          disabled={previewQuestionIndex === previewQuestions.length - 1}
                          onClick={() => setPreviewQuestionIndex((prev) => Math.min(previewQuestions.length - 1, prev + 1))}
                          className={`px-4 py-2 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm transition disabled:opacity-30 ${
                            BUTTON_RADIUS_CLASSES[appearance.layout.buttonAppearance]
                          }`}
                          style={{ backgroundColor: appearance.colors.buttonPrimary }}
                        >
                          <span>Save & Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Right Question Palette (if visible) */}
                    {appearance.layout.sidebarVisibility !== 'hidden' && (
                      <div
                        className="w-36 lg:w-44 border-l p-3 flex flex-col justify-between shrink-0 hidden sm:flex"
                        style={{
                          borderColor: appearance.colors.secondary,
                          backgroundColor: appearance.colors.cardBackground,
                        }}
                      >
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: appearance.colors.textSecondary }}>
                            Question Palette
                          </span>

                          <div className="grid grid-cols-4 gap-1.5">
                            {previewQuestions.map((q, idx) => {
                              const isCurrent = idx === previewQuestionIndex;
                              const isAnswered = (previewSelectedOptions[q.id] || []).length > 0;
                              return (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => setPreviewQuestionIndex(idx)}
                                  className={`w-7 h-7 rounded-lg text-[10px] font-bold font-mono transition flex items-center justify-center`}
                                  style={{
                                    backgroundColor: isCurrent
                                      ? appearance.colors.primary
                                      : isAnswered && appearance.candidateExperience.showAnswerStatus
                                      ? appearance.colors.accent
                                      : appearance.colors.background,
                                    color: isCurrent || (isAnswered && appearance.candidateExperience.showAnswerStatus) ? '#ffffff' : appearance.colors.textMain,
                                    border: isCurrent ? 'none' : `1px solid ${appearance.colors.secondary}`,
                                  }}
                                >
                                  {idx + 1}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Legend */}
                        {appearance.candidateExperience.showAnswerStatus && (
                          <div className="pt-3 border-t space-y-1 text-[9px]" style={{ borderColor: appearance.colors.secondary }}>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: appearance.colors.accent }} />
                              <span style={{ color: appearance.colors.textSecondary }}>Answered</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: appearance.colors.background }} />
                              <span style={{ color: appearance.colors.textSecondary }}>Not visited</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
