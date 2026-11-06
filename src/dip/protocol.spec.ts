// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { describe, expect, test } from 'vitest';
import {
  commands,
  defaultSettings,
  initialState,
  parseInfo,
  parseSettings,
  parseState,
} from './protocol';

describe('parseInfo', () => {
  test('parses read_shuttle() output', () => {
    const lines = [
      'DEBUG: Returning ROM contents',
      'commit=deadbeef01',
      'repo=TinyTapeout/tinytapeout-gf-0p2',
      'shuttle=ttgf0p2',
      'board=dip',
      'dipfw=0.9.8',
    ];
    expect(parseInfo(lines)).toEqual({
      shuttle: 'ttgf0p2',
      board: 'dip',
      firmwareVersion: '0.9.8',
    });
  });

  test('returns nulls for a non-DIP device', () => {
    expect(parseInfo(['MicroPython v1.22.0'])).toEqual({
      shuttle: null,
      board: null,
      firmwareVersion: null,
    });
  });
});

describe('parseState', () => {
  test('parses dump_state() output', () => {
    const lines = ['INFO: Dumping state', '', 'tt.design=333', 'tt.subtile=-1', 'tt.clk_freq=0'];
    expect(parseState(lines, initialState)).toEqual({ design: 333, clockHz: 0 });
  });

  test('keeps previous values for missing keys', () => {
    expect(parseState(['tt.clk_freq=4000'], { design: 12, clockHz: 0 })).toEqual({
      design: 12,
      clockHz: 4000,
    });
  });
});

describe('parseSettings', () => {
  test('parses dump_settings() output', () => {
    const lines = [
      'INFO: Dumping settings',
      'set.check_ext=1',
      'set.def_design=333',
      'set.def_clk=9999',
      'set.mux_ext=0',
      'set.clk_ext=1',
      'set.auto_reset_proj=123',
      'set.debug_level=3',
    ];
    expect(parseSettings(lines, defaultSettings)).toEqual({
      checkExtDriveOnBoot: true,
      defaultDesign: 333,
      defaultClockHz: 9999,
      muxExternal: false,
      clockExternal: true,
      resetOnLoadClocks: 123,
      debugLevel: 3,
    });
  });
});

describe('commands', () => {
  test('leaves out a zero clock rate', () => {
    expect(commands.selectDesign(12, 4000)).toBe('select_design(12, 4000)');
    expect(commands.selectDesign(12, 0)).toBe('select_design(12)');
    expect(commands.setDefault(333, 9999)).toBe('set_default(333, 9999)');
    expect(commands.setDefault(0, 0)).toBe('set_default(0)');
  });

  test('formats booleans as 0 and 1', () => {
    expect(commands.checkExtDrive(true)).toBe('check_ext_drive(1)');
    expect(commands.setMuxExt(false)).toBe('set_mux_ext(0)');
  });
});
