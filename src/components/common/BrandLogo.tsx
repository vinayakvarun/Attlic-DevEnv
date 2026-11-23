/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Brand Identity & Round Glowing 'A' Logo (Black-DarkGrey & Pastel Orange)
 */

import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  primaryColor?: string;
}

export const AttlicWordmark: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className = '', style }) => (
  <span className={`font-nokia uppercase ${className}`} style={style}>
    ATTLIC
  </span>
);

/**
 * Renders a dynamic string while styling standalone occurrences of "ATTLIC"
 * (in any casing) as ALL CAPS in the Nokia font, leaving all surrounding text
 * and domain URLs (like attlic.in) untouched.
 */
export function renderWithAttlicBrand(text?: string | null): React.ReactNode {
  if (!text) return text ?? null;
  const parts = text.split(/((?<![.@/a-zA-Z0-9_-])attlic(?![.a-zA-Z0-9_-]))/gi);
  if (parts.length === 1) return text;
  return parts.map((part, idx) =>
    part.toLowerCase() === 'attlic' ? (
      <AttlicWordmark key={idx} />
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showTagline = false,
  className = '',
  primaryColor,
}) => {
  const badgeSizes = {
    sm: 'w-7 h-7 text-sm',
    md: 'w-9 h-9 text-lg',
    lg: 'w-11 h-11 text-2xl',
    xl: 'w-14 h-14 text-3xl',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  const glowColor = primaryColor || '#FFB37B';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Round Glowing 'A' Emblem */}
      <div
        className={`relative ${badgeSizes[size]} rounded-full flex items-center justify-center shrink-0 font-black text-white tracking-tighter border transition-transform duration-300`}
        style={{
          background: `radial-gradient(circle at 50% 35%, ${glowColor}66 0%, #0A0A0C 85%)`,
          borderColor: `${glowColor}88`,
          boxShadow: `0 0 22px -2px ${glowColor}99, inset 0 0 12px ${glowColor}55`,
        }}
        aria-hidden="true"
      >
        <span
          className="relative z-10 font-sans font-black leading-none"
          style={{
            textShadow: `0 0 10px #ffffffcc, 0 0 20px ${glowColor}`,
          }}
        >
          A
        </span>
      </div>

      {/* ATTLIC Wordmark & Optional Tagline */}
      <div className="flex flex-col">
        <div className={`font-black tracking-tight flex items-center leading-none ${textSizes[size]}`}>
          <AttlicWordmark
            className="text-white"
            style={{
              textShadow: `0 0 18px ${glowColor}66`,
            }}
          />
        </div>
        {showTagline && (
          <span
            className="text-[10px] font-semibold tracking-widest uppercase text-indigo-300/90 mt-1"
            style={primaryColor ? { color: primaryColor } : undefined}
          >
            Assess. Evaluate. Select.
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
