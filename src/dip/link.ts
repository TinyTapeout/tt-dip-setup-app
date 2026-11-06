// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

/** A text channel to a DIP board: a Web Serial port, or a simulated one. */
export interface IDipLink {
  onData(listener: (chunk: string) => void): void;
  onClose(listener: () => void): void;
  write(data: string): Promise<void>;
  close(): Promise<void>;
  /** Short description for display, e.g. the USB VID/PID or "simulated board". */
  readonly description: string;
}
