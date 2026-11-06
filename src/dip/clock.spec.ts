// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { describe, expect, test } from 'vitest';
import { clockPresets, effectiveClockHz, formatHz, MAX_CLOCK_HZ } from './clock';

describe('effectiveClockHz', () => {
  test('matches the examples from the firmware README', () => {
    // `set_clock_hz(123456)` -> "Clocking at 123711 Hz"
    expect(effectiveClockHz(123456)).toBe(123711);
    // `set_clock_hz(100000000)` -> "Set to MAX clock rate 24000000Hz"
    expect(effectiveClockHz(100_000_000)).toBe(MAX_CLOCK_HZ);
  });

  test('quantizes rates the PWM cannot produce', () => {
    expect(effectiveClockHz(25_000_000)).toBe(24_000_000);
    expect(effectiveClockHz(16_000_000)).toBe(12_000_000);
    expect(effectiveClockHz(25_175_000)).toBe(24_000_000);
    // The firmware only tries the two even periods around the ideal one, so 7 MHz rounds up.
    expect(effectiveClockHz(7_000_000)).toBe(8_000_000);
  });

  test('treats 0 and invalid values as stopped', () => {
    expect(effectiveClockHz(0)).toBe(0);
    expect(effectiveClockHz(-5)).toBe(0);
    expect(effectiveClockHz(NaN)).toBe(0);
  });
});

describe('clockPresets', () => {
  test('only lists rates the board produces exactly', () => {
    for (const preset of clockPresets) {
      expect(effectiveClockHz(preset.hz), preset.title).toBe(preset.hz);
    }
  });
});

describe('formatHz', () => {
  test('formats common rates', () => {
    expect(formatHz(0)).toBe('stopped');
    expect(formatHz(24_000_000)).toBe('24 MHz');
    expect(formatHz(6_857_142)).toBe('6,857,142 Hz');
    expect(formatHz(50_000)).toBe('50 kHz');
    expect(formatHz(123_711)).toBe('123,711 Hz');
    expect(formatHz(10)).toBe('10 Hz');
  });
});
