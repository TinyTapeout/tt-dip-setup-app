// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

/**
 * The TT-DIP firmware's text protocol, see https://github.com/TinyTapeout/tt-dip-firmware#tui-api.
 *
 * Commands are `name(arg, arg)` lines. The firmware echoes its input, ends its output lines with
 * CRLF, and prints the `>>> ` prompt (without a newline) once it has executed the queued commands.
 * Results that matter to us are `key=value` lines; the rest is logging that depends on the
 * board's debug level.
 */

export const PROMPT = '>>> ';

/** The firmware's input buffer size; longer lines are discarded. */
export const MAX_COMMAND_LENGTH = 64;

/** The highest design index (mux address). */
export const MAX_DESIGN = 1023;

/** From `read_shuttle()`. */
export interface IDipInfo {
  shuttle: string | null;
  board: string | null;
  firmwareVersion: string | null;
}

/** From `dump_state()`. */
export interface IDipState {
  design: number;
  clockHz: number;
}

/** From `dump_settings()`: the settings kept in RAM, and saved to flash by `write_config()`. */
export interface IDipSettings {
  checkExtDriveOnBoot: boolean;
  defaultDesign: number;
  defaultClockHz: number;
  muxExternal: boolean;
  clockExternal: boolean;
  /** Clock pulses sent while in reset after loading a design; 0 disables the reset. */
  resetOnLoadClocks: number;
  /** 0 = critical only ... 4 = debug. */
  debugLevel: number;
}

export const emptyInfo: IDipInfo = { shuttle: null, board: null, firmwareVersion: null };

/** No design selected, clock stopped. */
export const initialState: IDipState = { design: 0, clockHz: 0 };

/** The firmware's factory defaults. */
export const defaultSettings: IDipSettings = {
  checkExtDriveOnBoot: true,
  defaultDesign: 0,
  defaultClockHz: 0,
  muxExternal: false,
  clockExternal: false,
  resetOnLoadClocks: 0,
  debugLevel: 3,
};

function keyValueMap(lines: string[]) {
  const map = new Map<string, string>();
  for (const line of lines) {
    const match = line.trim().match(/^([A-Za-z_][\w.]*)=(.*)$/);
    if (match) {
      map.set(match[1], match[2].trim());
    }
  }
  return map;
}

function int(value: string | undefined, fallback: number) {
  const parsed = parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function bool(value: string | undefined, fallback: boolean) {
  return int(value, fallback ? 1 : 0) !== 0;
}

export function parseInfo(lines: string[]): IDipInfo {
  const map = keyValueMap(lines);
  return {
    shuttle: map.get('shuttle') ?? null,
    board: map.get('board') ?? null,
    firmwareVersion: map.get('dipfw') ?? null,
  };
}

/** Keys missing from the dump keep their `previous` value. */
export function parseState(lines: string[], previous: IDipState): IDipState {
  const map = keyValueMap(lines);
  return {
    design: int(map.get('tt.design'), previous.design),
    clockHz: int(map.get('tt.clk_freq'), previous.clockHz),
  };
}

/** Keys missing from the dump keep their `previous` value. */
export function parseSettings(lines: string[], previous: IDipSettings): IDipSettings {
  const map = keyValueMap(lines);
  return {
    checkExtDriveOnBoot: bool(map.get('set.check_ext'), previous.checkExtDriveOnBoot),
    defaultDesign: int(map.get('set.def_design'), previous.defaultDesign),
    defaultClockHz: int(map.get('set.def_clk'), previous.defaultClockHz),
    muxExternal: bool(map.get('set.mux_ext'), previous.muxExternal),
    clockExternal: bool(map.get('set.clk_ext'), previous.clockExternal),
    resetOnLoadClocks: int(map.get('set.auto_reset_proj'), previous.resetOnLoadClocks),
    debugLevel: int(map.get('set.debug_level'), previous.debugLevel),
  };
}

/** The `ERROR: ...` lines of a response (only printed when the board's debug level is >= 1). */
export function responseErrors(lines: string[]) {
  return lines
    .map((line) => line.trim().match(/^ERROR:\s*(.*)$/)?.[1])
    .filter((message) => message != null);
}

export function sameSettings(a: IDipSettings, b: IDipSettings) {
  return (
    a.checkExtDriveOnBoot === b.checkExtDriveOnBoot &&
    a.defaultDesign === b.defaultDesign &&
    a.defaultClockHz === b.defaultClockHz &&
    a.muxExternal === b.muxExternal &&
    a.clockExternal === b.clockExternal &&
    a.resetOnLoadClocks === b.resetOnLoadClocks &&
    a.debugLevel === b.debugLevel
  );
}

/** A clock rate of 0 is left out, which leaves the clock stopped. */
export const commands = {
  readShuttle: () => 'read_shuttle()',
  dumpState: () => 'dump_state()',
  dumpSettings: () => 'dump_settings()',
  selectDesign: (design: number, clockHz: number) =>
    clockHz ? `select_design(${design}, ${clockHz})` : `select_design(${design})`,
  setClockHz: (hz: number) => `set_clock_hz(${hz})`,
  resetProject: () => 'reset_project()',
  manualClock: () => 'manual_clock()',
  startFactoryTest: () => 'start_factory_test()',
  setDefault: (design: number, clockHz: number) =>
    clockHz ? `set_default(${design}, ${clockHz})` : `set_default(${design})`,
  checkExtDrive: (on: boolean) => `check_ext_drive(${on ? 1 : 0})`,
  resetOnLoad: (clocks: number) => `reset_on_load(${clocks})`,
  setMuxExt: (driven: boolean) => `set_mux_ext(${driven ? 1 : 0})`,
  setClkExt: (driven: boolean) => `set_clk_ext(${driven ? 1 : 0})`,
  debugLevel: (level: number) => `debug_level(${level})`,
  writeConfig: () => 'write_config()',
  restart: () => 'restart()',
};
