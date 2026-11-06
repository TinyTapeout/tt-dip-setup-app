// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { PROMPT } from './protocol';

export type SplitEvent = { type: 'line'; text: string } | { type: 'prompt' };

/**
 * Splits the board's output into lines and prompt events. The prompt isn't newline-terminated,
 * so it's detected anywhere in the stream; text preceding it on the same line is emitted first.
 */
export class LineSplitter {
  private buffer = '';

  push(chunk: string) {
    this.buffer += chunk;
    const events: SplitEvent[] = [];
    for (;;) {
      const newline = this.buffer.indexOf('\n');
      const prompt = this.buffer.indexOf(PROMPT);
      if (newline < 0 && prompt < 0) {
        break;
      }
      if (prompt >= 0 && (newline < 0 || prompt < newline)) {
        const before = this.buffer.slice(0, prompt).replace(/\r$/, '');
        if (before.length) {
          events.push({ type: 'line', text: before });
        }
        events.push({ type: 'prompt' });
        this.buffer = this.buffer.slice(prompt + PROMPT.length);
      } else {
        events.push({ type: 'line', text: this.buffer.slice(0, newline).replace(/\r$/, '') });
        this.buffer = this.buffer.slice(newline + 1);
      }
    }
    return events;
  }

  reset() {
    this.buffer = '';
  }
}
