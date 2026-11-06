// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { describe, expect, test } from 'vitest';
import { LineSplitter } from './LineSplitter';

describe('LineSplitter', () => {
  test('splits CRLF lines and detects the prompt', () => {
    const splitter = new LineSplitter();
    expect(
      splitter.push('select_design(3)\r\nSelect design 3 \r\nEnable project 3\r\n>>> '),
    ).toEqual([
      { type: 'line', text: 'select_design(3)' },
      { type: 'line', text: 'Select design 3 ' },
      { type: 'line', text: 'Enable project 3' },
      { type: 'prompt' },
    ]);
  });

  test('handles chunks split anywhere, including inside the prompt', () => {
    const splitter = new LineSplitter();
    const events = [
      ...splitter.push('tt.des'),
      ...splitter.push('ign=12\r'),
      ...splitter.push('\n>>'),
      ...splitter.push('> '),
    ];
    expect(events).toEqual([{ type: 'line', text: 'tt.design=12' }, { type: 'prompt' }]);
  });

  test('emits text that precedes a prompt on the same line', () => {
    const splitter = new LineSplitter();
    expect(splitter.push('INFO: Restarting...>>> dump_state()\r\n')).toEqual([
      { type: 'line', text: 'INFO: Restarting...' },
      { type: 'prompt' },
      { type: 'line', text: 'dump_state()' },
    ]);
  });

  test('emits consecutive prompts', () => {
    const splitter = new LineSplitter();
    expect(splitter.push('>>> >>> ')).toEqual([{ type: 'prompt' }, { type: 'prompt' }]);
  });
});
