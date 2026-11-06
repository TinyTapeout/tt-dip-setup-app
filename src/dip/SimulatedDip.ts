// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { effectiveClockHz, MAX_CLOCK_HZ } from './clock';
import type { IDipLink } from './link';
import { PROMPT, type IDipSettings } from './protocol';

export interface ISimulatedDipOptions {
  shuttle?: string;
  firmwareVersion?: string;
  settings?: Partial<IDipSettings>;
  latencyMs?: number;
}

/**
 * Simulates the TT-DIP firmware (v0.9.8) closely enough to develop and test the app without
 * hardware: input echo, the prompt, the `key=value` dumps, the debug-level filtered messages, and
 * the effect of each command on the settings and state.
 */
export class SimulatedDip implements IDipLink {
  readonly description = 'simulated board';
  private dataListener: ((chunk: string) => void) | null = null;
  private closeListener: (() => void) | null = null;
  private input = '';
  private closed = false;
  readonly shuttle: string;
  readonly firmwareVersion: string;
  private readonly latencyMs: number;

  settings: IDipSettings = {
    checkExtDriveOnBoot: true,
    defaultDesign: 0,
    defaultClockHz: 10,
    muxExternal: false,
    clockExternal: false,
    resetOnLoadClocks: 5,
    debugLevel: 3,
  };
  flash: IDipSettings | null = null;
  design = 0;
  clockHz = 0;
  /** Every command line parsed, for tests. */
  readonly received: string[] = [];

  constructor(options: ISimulatedDipOptions = {}) {
    this.shuttle = options.shuttle ?? 'ttgf0p2';
    this.firmwareVersion = options.firmwareVersion ?? '0.9.8';
    this.latencyMs = options.latencyMs ?? 0;
    this.settings = { ...this.settings, ...options.settings };
    this.boot();
  }

  onData(listener: (chunk: string) => void) {
    this.dataListener = listener;
  }

  onClose(listener: () => void) {
    this.closeListener = listener;
  }

  async close() {
    this.closed = true;
    this.closeListener?.();
  }

  async write(data: string) {
    if (this.closed) {
      throw new Error('Link closed');
    }
    this.emit(data); // echo
    for (const char of data) {
      if (char === '\r' || char === '\n') {
        const line = this.input;
        this.input = '';
        if (line.length) {
          this.received.push(line);
          this.execute(line);
        }
        this.emit(PROMPT);
      } else if (char !== ' ' && char !== '\t' && char !== ';') {
        this.input += char;
      }
    }
  }

  private emit(text: string) {
    if (this.closed) {
      return;
    }
    const deliver = () => this.dataListener?.(text);
    if (this.latencyMs > 0) {
      setTimeout(deliver, this.latencyMs);
    } else {
      queueMicrotask(deliver);
    }
  }

  private out(text: string) {
    this.emit(`${text}\r\n`);
  }

  private message(level: number, text: string) {
    const names = ['CRITICAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];
    if (level <= this.settings.debugLevel) {
      this.out(`${names[level]}: ${text}`);
    }
  }

  private info(text: string) {
    this.message(3, text);
  }

  private error(text: string) {
    this.message(1, text);
  }

  private boot() {
    if (this.flash) {
      this.settings = { ...this.flash };
    }
    this.design = 0;
    this.clockHz = 0;
    if (this.settings.defaultDesign) {
      if (this.settings.muxExternal) {
        this.info('Def design specified but MUX driven ext');
      } else {
        this.info('Loading default project');
        this.enableDesign(this.settings.defaultDesign);
      }
      if (this.settings.defaultClockHz) {
        if (this.settings.clockExternal) {
          this.info('Def clock rate set, but clock drv ext');
        } else {
          this.info('Clocking default project');
          this.startClock(this.settings.defaultClockHz);
        }
      }
    }
  }

  private enableDesign(id: number) {
    this.out(`Enable project ${id}`);
    if (this.settings.muxExternal) {
      this.info("MUX can't enable -- driven externally");
      return;
    }
    this.design = id;
  }

  private startClock(hz: number) {
    this.clockHz = 0;
    if (this.settings.clockExternal) {
      return 0;
    }
    if (hz === 0) {
      return 0;
    }
    if (hz > MAX_CLOCK_HZ) {
      this.out(`Set to MAX clock rate ${MAX_CLOCK_HZ}Hz`);
    }
    this.clockHz = effectiveClockHz(hz);
    this.out(`Clocking at ${this.clockHz} Hz`);
    return this.clockHz;
  }

  private execute(line: string) {
    const name = line.replace(/\(.*$/, '');
    const params = [...(line.match(/\((.*)\)?/)?.[1] ?? '').matchAll(/-?\d+/g)].map((m) =>
      parseInt(m[0], 10),
    );
    const matches = (command: string) => command.startsWith(name) && name.length > 0;

    if (matches('read_shuttle')) {
      this.out('commit=deadbeef01');
      this.out('repo=TinyTapeout/tinytapeout-gf-0p2');
      this.out(`shuttle=${this.shuttle}`);
      this.out('board=dip');
      this.out(`dipfw=${this.firmwareVersion}`);
    } else if (matches('dump_state')) {
      this.info('Dumping state');
      this.out('');
      this.out(`tt.design=${this.design}`);
      this.out('tt.subtile=-1');
      this.out(`tt.clk_freq=${this.clockHz}`);
    } else if (matches('dump_settings')) {
      const s = this.settings;
      this.info('Dumping settings');
      this.out(`set.check_ext=${s.checkExtDriveOnBoot ? 1 : 0}`);
      this.out(`set.def_design=${s.defaultDesign}`);
      this.out(`set.def_clk=${s.defaultClockHz}`);
      this.out(`set.mux_ext=${s.muxExternal ? 1 : 0}`);
      this.out(`set.clk_ext=${s.clockExternal ? 1 : 0}`);
      this.out(`set.auto_reset_proj=${s.resetOnLoadClocks}`);
      this.out(`set.debug_level=${s.debugLevel}`);
    } else if (matches('select_design')) {
      if (params.length < 1) {
        return this.error('Need param design idx');
      }
      this.out(`Select design ${params[0]} `);
      this.clockHz = 0;
      this.enableDesign(params[0]);
      if (params.length < 2 || !params[1]) {
        return;
      }
      this.out(`Attempting clock @  ${params[1]} Hz`);
      const rate = this.startClock(params[1]);
      if (!rate) {
        return this.error('Could not start clocking');
      }
      this.out(`Clock @  ${rate} Hz`);
    } else if (matches('set_default')) {
      if (params.length < 1) {
        return this.error('Need param design idx');
      }
      this.out(`Set default design ${params[0]} `);
      this.settings.defaultDesign = params[0];
      this.settings.defaultClockHz = params[1] ?? 0;
      this.out(`Set default clock @  ${this.settings.defaultClockHz} Hz`);
    } else if (matches('set_clock_hz')) {
      if (params.length < 1) {
        return this.error('Need param clock rate');
      }
      this.clockHz = 0;
      if (this.settings.clockExternal) {
        return this.error("Clock driver externally, can't start");
      }
      if (params[0]) {
        this.out(`Starting clock @ ${params[0]} Hz`);
        this.startClock(params[0]);
      } else {
        this.info('Stopped clocking');
      }
    } else if (matches('start_factory_test')) {
      this.info('Run Factory Test');
      this.clockHz = 0;
      this.enableDesign(1);
      this.startClock(10);
    } else if (matches('reset_project')) {
      this.info('Project Reset');
    } else if (matches('manual_clock')) {
      this.info('Manual clocking');
      this.clockHz = 0;
    } else if (matches('set_mux_ext')) {
      this.out(`Set external MUX drive ${params[0] ? 'true' : 'false'} `);
      this.settings.muxExternal = !!params[0];
    } else if (matches('set_clk_ext')) {
      this.out(`Set external clocking ${params[0] ? 'true' : 'false'} `);
      this.settings.clockExternal = !!params[0];
    } else if (matches('check_ext_drive')) {
      if (params.length < 1) {
        return this.error('Need param ON (0 or 1)');
      }
      this.clockHz = 0;
      this.settings.checkExtDriveOnBoot = !!params[0];
      this.info(
        params[0]
          ? 'Will check for external drivers on boot'
          : 'No check for external drivers on powerup',
      );
    } else if (matches('reset_on_load')) {
      if (params.length < 1) {
        return this.error('Need param NUM_CLOCKS');
      }
      if (params[0] > 255) {
        return this.error('NUM_CLOCKS must be <= 255');
      }
      this.settings.resetOnLoadClocks = params[0];
      if (params[0]) {
        this.info(`Reset on load with ${params[0]} clocks`);
      } else {
        this.info('No reset on project load');
      }
    } else if (matches('debug_level')) {
      if (params.length < 1) {
        return this.error('Need param LEVEL');
      }
      if (params[0] > 4) {
        return this.error('LEVEL must be 0-4');
      }
      this.settings.debugLevel = params[0];
      this.info(`Debug level now ${params[0]}`);
    } else if (matches('write_config')) {
      this.flash = { ...this.settings };
      this.info('Configuration saved');
    } else if (matches('about')) {
      this.out(`TT DIP firmware v${this.firmwareVersion}`);
    } else if (matches('restart')) {
      this.info('Restarting...');
      this.boot();
    } else {
      this.error(`Unrecognized '${line}'`);
    }
  }
}
