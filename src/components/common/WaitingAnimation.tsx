/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Animated Lottie Waiting & Loading Indicator
 */

import React from 'react';
import { Lottie } from 'lottie-react';
import { renderWithAttlicBrand } from './BrandLogo';

const ATTLIC_ORBIT_LOTTIE = {
  v: '5.7.4',
  fr: 60,
  ip: 0,
  op: 120,
  w: 200,
  h: 200,
  nm: 'AttlicOrbitLoader',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'OuterArc',
      sr: 1,
      ks: {
        o: { a: 0, k: 95 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0], e: [360], i: { x: [0.5], y: [0.5] }, o: { x: [0.5], y: [0.5] } },
            { t: 120, s: [360] },
          ],
        },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              d: 1,
              ty: 'el',
              s: { a: 0, k: [140, 140] },
              p: { a: 0, k: [0, 0] },
              nm: 'OuterRingPath',
            },
            {
              ty: 'tm',
              s: { a: 0, k: 0 },
              e: {
                a: 1,
                k: [
                  { t: 0, s: [25], e: [75], i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } },
                  { t: 60, s: [75], e: [25], i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } },
                  { t: 120, s: [25] },
                ],
              },
              o: { a: 0, k: 0 },
              m: 1,
              nm: 'TrimPaths',
            },
            {
              ty: 'st',
              c: { a: 0, k: [1.0, 0.702, 0.482, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 10 },
              lc: 2,
              lj: 2,
              nm: 'StrokePastelOrange',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
          nm: 'OuterGroup',
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'CorePulse',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [50], e: [100], i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } },
            { t: 60, s: [100], e: [50], i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } },
            { t: 120, s: [50] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [75, 75, 100], e: [115, 115, 100], i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } },
            { t: 60, s: [115, 115, 100], e: [75, 75, 100], i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } },
            { t: 120, s: [75, 75, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              d: 1,
              ty: 'el',
              s: { a: 0, k: [36, 36] },
              p: { a: 0, k: [0, 0] },
              nm: 'CoreCircle',
            },
            {
              ty: 'fl',
              c: { a: 0, k: [1.0, 0.949, 0.902, 1] },
              o: { a: 0, k: 100 },
              r: 1,
              nm: 'FillWarmWhite',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
          nm: 'CoreGroup',
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
    },
  ],
};

interface WaitingAnimationProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
  inline?: boolean;
}

const DIMENSIONS = {
  xs: 20,
  sm: 32,
  md: 64,
  lg: 96,
};

export const WaitingAnimation: React.FC<WaitingAnimationProps> = ({
  size = 'md',
  label,
  sublabel,
  inline = false,
}) => {
  const px = DIMENSIONS[size] || 64;

  if (inline) {
    return (
      <span className="inline-flex items-center gap-2">
        <span style={{ width: px, height: px }} className="inline-block shrink-0">
          <Lottie src={ATTLIC_ORBIT_LOTTIE as any} autoplay loop className="w-full h-full" />
        </span>
        {label && <span>{renderWithAttlicBrand(label)}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-6 space-y-2.5">
      <div
        style={{ width: px, height: px }}
        className="relative flex items-center justify-center rounded-2xl bg-indigo-500/5 border border-indigo-500/15 shadow-inner"
      >
        <Lottie src={ATTLIC_ORBIT_LOTTIE as any} autoplay loop className="w-full h-full" />
      </div>
      {label && (
        <p className="text-xs sm:text-sm font-semibold text-white tracking-tight animate-pulse">
          {renderWithAttlicBrand(label)}
        </p>
      )}
      {sublabel && (
        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
          {renderWithAttlicBrand(sublabel)}
        </p>
      )}
    </div>
  );
};
