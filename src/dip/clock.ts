// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

/**
 * The firmware drives the project clock with a 50% duty-cycle PWM from a 16-bit timer running
 * at 48 MHz (TT-DIP `src/platform/Clock.cpp`). The output is `48 MHz / (N * M)` where N is the
 * prescaler (1..65536) and M the period (even, 2..65536), so the achievable rates are
 * `24 MHz / k` for integer k. Other requests are quantized, and anything above 24 MHz is capped.
 */

const TIMER_CLOCK_HZ = 48_000_000;
export const MAX_CLOCK_HZ = 24_000_000;
const TIM_MAXDIV = 65536;

/** Mirrors the firmware's `calc_pwm_nm()`, so the UI can predict the rate the board will use. */
export function effectiveClockHz(requestedHz: number) {
  if (!Number.isFinite(requestedHz) || requestedHz <= 0) {
    return 0;
  }
  const targetHz = Math.max(1, Math.min(Math.floor(requestedHz), MAX_CLOCK_HZ));
  const totalTicks = Math.max(
    2,
    Math.floor((TIMER_CLOCK_HZ + Math.floor(targetHz / 2)) / targetHz),
  );

  // The firmware only tries the two even periods around the ideal one.
  const period = (n: number) => {
    const mLo = Math.max(2, Math.floor(Math.floor(totalTicks / n) / 2) * 2);
    const mHi = Math.min(mLo + 2, TIM_MAXDIV);
    const fLo = Math.floor(TIMER_CLOCK_HZ / (n * mLo));
    const fHi = Math.floor(TIMER_CLOCK_HZ / (n * mHi));
    return Math.abs(fLo - targetHz) <= Math.abs(fHi - targetHz) ? mLo : mHi;
  };

  let n = Math.min(Math.max(Math.floor((totalTicks + TIM_MAXDIV - 1) / TIM_MAXDIV), 1), TIM_MAXDIV);
  let m = period(n);
  if (m > TIM_MAXDIV) {
    n++;
    m = period(n);
  }
  n = Math.min(n, TIM_MAXDIV);
  m = Math.min(Math.max(m, 2), TIM_MAXDIV);
  return Math.floor(TIMER_CLOCK_HZ / (n * m));
}

/** Preset rates offered in the UI; all produced exactly by the board (verified by clock.spec.ts). */
export const clockPresets = [
  { title: '24 MHz', hz: 24_000_000 },
  { title: '12 MHz', hz: 12_000_000 },
  { title: '8 MHz', hz: 8_000_000 },
  { title: '6 MHz', hz: 6_000_000 },
  { title: '4 MHz', hz: 4_000_000 },
  { title: '3 MHz', hz: 3_000_000 },
  { title: '2 MHz', hz: 2_000_000 },
  { title: '1 MHz', hz: 1_000_000 },
  { title: '500 kHz', hz: 500_000 },
  { title: '100 kHz', hz: 100_000 },
  { title: '50 kHz', hz: 50_000 },
  { title: '10 kHz', hz: 10_000 },
  { title: '1 kHz', hz: 1_000 },
  { title: '100 Hz', hz: 100 },
  { title: '10 Hz', hz: 10 },
  { title: '1 Hz', hz: 1 },
];

export function formatHz(hz: number) {
  if (hz <= 0) {
    return 'stopped';
  }
  if (hz >= 1_000_000 && hz % 1_000 === 0) {
    return `${trimZeros(hz / 1_000_000)} MHz`;
  }
  if (hz >= 1_000 && hz % 10 === 0) {
    return `${trimZeros(hz / 1_000)} kHz`;
  }
  return `${hz.toLocaleString('en-US')} Hz`;
}

function trimZeros(value: number) {
  return value.toFixed(3).replace(/\.?0+$/, '');
}
