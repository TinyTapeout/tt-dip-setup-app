// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { LineSplitter } from './LineSplitter';
import type { IDipLink } from './link';
import {
  commands,
  defaultSettings,
  emptyInfo,
  initialState,
  MAX_COMMAND_LENGTH,
  parseInfo,
  parseSettings,
  parseState,
  responseErrors,
  type IDipInfo,
  type IDipSettings,
  type IDipState,
} from './protocol';

export interface ILogEntry {
  id: number;
  sent: boolean;
  text: string;
}

export interface ICommandResult {
  lines: string[];
  /** Messages of the `ERROR:` lines in the response. */
  errors: string[];
}

export interface IDeviceSnapshot {
  connected: boolean;
  info: IDipInfo;
  state: IDipState;
  /** The firmware defaults until `start()` has read the board's settings. */
  settings: IDipSettings;
  /** False once a setting was changed in RAM but not yet written to flash. */
  savedToFlash: boolean;
  busy: boolean;
  logs: ILogEntry[];
}

interface IPendingCommand {
  command: string;
  lines: string[];
  resolve: (result: ICommandResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const MAX_LOG_ENTRIES = 1000;
const COMMAND_TIMEOUT_MS = 3000;
const HANDSHAKE_TIMEOUT_MS = 1500;
const WRITE_CONFIG_TIMEOUT_MS = 5000;
// restart() re-runs the boot sequence, which clocks the mux once per design index.
const RESTART_TIMEOUT_MS = 10_000;

export class DipDeviceError extends Error {}

/**
 * Talks to a TT-DIP board. Commands are sent one at a time, and each response is collected until
 * the board prints its prompt. The state is exposed as an immutable snapshot for React's
 * `useSyncExternalStore`.
 */
export class DipDevice {
  readonly link: IDipLink;
  private snapshot: IDeviceSnapshot = {
    connected: false,
    info: emptyInfo,
    state: initialState,
    settings: defaultSettings,
    savedToFlash: true,
    busy: false,
    logs: [],
  };
  private readonly listeners = new Set<() => void>();
  private readonly splitter = new LineSplitter();
  private queue: Promise<unknown> = Promise.resolve();
  private pending: IPendingCommand | null = null;
  private nextLogId = 1;
  private closed = false;

  constructor(link: IDipLink) {
    this.link = link;
    link.onData((chunk) => this.processInput(chunk));
    link.onClose(() => this.handleClose());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private updateSnapshot(patch: Partial<IDeviceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }

  private addLogEntry(text: string, sent: boolean) {
    const logs = [...this.snapshot.logs, { id: this.nextLogId++, sent, text }];
    if (logs.length > MAX_LOG_ENTRIES) {
      logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    }
    this.updateSnapshot({ logs });
  }

  private processInput(chunk: string) {
    for (const event of this.splitter.push(chunk)) {
      if (event.type === 'prompt') {
        this.resolvePending();
        continue;
      }
      const text = event.text;
      if (text.trim() === '') {
        continue;
      }
      // The board echoes our input; don't log it twice.
      if (this.pending && text.trim() === this.pending.command) {
        continue;
      }
      this.addLogEntry(text, false);
      this.pending?.lines.push(text);
    }
  }

  private handleClose() {
    this.closed = true;
    this.pending?.reject(new DipDeviceError('The board was disconnected'));
    this.pending = null;
    this.updateSnapshot({ connected: false, busy: false });
  }

  private resolvePending() {
    const pending = this.pending;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve({ lines: pending.lines, errors: responseErrors(pending.lines) });
  }

  /** Sends a command and resolves with the board's response once its prompt arrives. */
  sendCommand(command: string, options: { timeoutMs?: number; log?: boolean } = {}) {
    const { timeoutMs = COMMAND_TIMEOUT_MS, log = true } = options;
    const run = async (): Promise<ICommandResult> => {
      if (this.closed) {
        throw new DipDeviceError('The board is disconnected');
      }
      if (command.length > MAX_COMMAND_LENGTH) {
        throw new DipDeviceError(`Command too long: ${command}`);
      }
      this.updateSnapshot({ busy: true });
      try {
        const result = new Promise<ICommandResult>((resolve, reject) => {
          this.pending = {
            command,
            lines: [],
            resolve,
            reject,
            timer: setTimeout(() => {
              if (this.pending?.command === command) {
                this.pending = null;
              }
              reject(new DipDeviceError(`Timed out waiting for the board to answer "${command}"`));
            }, timeoutMs),
          };
        });
        if (log && command !== '') {
          this.addLogEntry(command, true);
        }
        await this.link.write(`${command}\n`);
        return await result;
      } finally {
        this.updateSnapshot({ busy: false });
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }

  async start() {
    // An empty line makes the board print its prompt, which tells us it's listening.
    for (let attempt = 1; ; attempt++) {
      try {
        this.splitter.reset();
        await this.sendCommand('', { timeoutMs: HANDSHAKE_TIMEOUT_MS, log: false });
        break;
      } catch {
        if (attempt >= 3 || this.closed) {
          throw new DipDeviceError(
            'No response from the board. Is it a Tiny Tapeout DIP, and is it powered?',
          );
        }
      }
    }
    await this.readShuttle();
    if (!this.snapshot.info.firmwareVersion) {
      throw new DipDeviceError('The connected device did not identify as a Tiny Tapeout DIP');
    }
    await this.syncSettings();
    await this.syncState();
    this.updateSnapshot({ connected: true, savedToFlash: true });
  }

  async readShuttle() {
    const { lines } = await this.sendCommand(commands.readShuttle());
    this.updateSnapshot({ info: parseInfo(lines) });
  }

  async syncState() {
    const { lines } = await this.sendCommand(commands.dumpState());
    this.updateSnapshot({ state: parseState(lines, this.snapshot.state) });
  }

  async syncSettings() {
    const { lines } = await this.sendCommand(commands.dumpSettings());
    this.updateSnapshot({ settings: parseSettings(lines, this.snapshot.settings) });
  }

  /** Sends a command that changes the board's state, then re-reads the state. */
  private async sendAndSyncState(command: string) {
    const result = await this.sendCommand(command);
    await this.syncState();
    return result;
  }

  /** A clock rate of 0 leaves the clock stopped. */
  selectDesign(design: number, clockHz: number) {
    return this.sendAndSyncState(commands.selectDesign(design, clockHz));
  }

  /** The board quantizes the rate; the synced state reports the actual one. 0 stops the clock. */
  setClock(hz: number) {
    return this.sendAndSyncState(commands.setClockHz(hz));
  }

  resetProject() {
    return this.sendAndSyncState(commands.resetProject());
  }

  manualClock() {
    return this.sendAndSyncState(commands.manualClock());
  }

  startFactoryTest() {
    return this.sendAndSyncState(commands.startFactoryTest());
  }

  /** Updates the settings in the board's RAM, sending only the ones that changed. */
  async applySettings(next: IDipSettings) {
    const current = this.snapshot.settings;
    const batch: string[] = [];
    if (
      next.defaultDesign !== current.defaultDesign ||
      next.defaultClockHz !== current.defaultClockHz
    ) {
      batch.push(commands.setDefault(next.defaultDesign, next.defaultClockHz));
    }
    if (next.resetOnLoadClocks !== current.resetOnLoadClocks) {
      batch.push(commands.resetOnLoad(next.resetOnLoadClocks));
    }
    if (next.checkExtDriveOnBoot !== current.checkExtDriveOnBoot) {
      batch.push(commands.checkExtDrive(next.checkExtDriveOnBoot));
    }
    if (next.muxExternal !== current.muxExternal) {
      batch.push(commands.setMuxExt(next.muxExternal));
    }
    if (next.clockExternal !== current.clockExternal) {
      batch.push(commands.setClkExt(next.clockExternal));
    }
    if (next.debugLevel !== current.debugLevel) {
      batch.push(commands.debugLevel(next.debugLevel));
    }
    const errors: string[] = [];
    for (const command of batch) {
      const result = await this.sendCommand(command);
      errors.push(...result.errors);
    }
    if (batch.length) {
      this.updateSnapshot({ savedToFlash: false });
    }
    await this.syncSettings();
    await this.syncState(); // check_ext_drive() stops the clock as a side effect.
    return { errors };
  }

  /** Saves the settings to flash. Resolves with whether the board confirmed the write. */
  async writeConfig() {
    const { lines, errors } = await this.sendCommand(commands.writeConfig(), {
      timeoutMs: WRITE_CONFIG_TIMEOUT_MS,
    });
    if (errors.length || lines.some((line) => /Could not save/i.test(line))) {
      throw new DipDeviceError(`The board could not save the configuration: ${lines.join(' ')}`);
    }
    this.updateSnapshot({ savedToFlash: true });
    return { confirmed: lines.some((line) => /Configuration saved/i.test(line)) };
  }

  /** Warm-boots the firmware, which re-runs the autodetection and loads the default design. */
  async restart() {
    const result = await this.sendCommand(commands.restart(), { timeoutMs: RESTART_TIMEOUT_MS });
    await this.readShuttle();
    await this.syncSettings();
    await this.syncState();
    return result;
  }

  async close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    await this.link.close();
  }
}
