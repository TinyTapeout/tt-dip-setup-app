// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { describe, expect, test } from 'vitest';
import { DipDevice } from './DipDevice';
import type { IDipLink } from './link';
import { SimulatedDip, type ISimulatedDipOptions } from './SimulatedDip';
import { PROMPT } from './protocol';

async function connect(options?: ISimulatedDipOptions) {
  const dip = new SimulatedDip(options);
  const device = new DipDevice(dip);
  await device.start();
  return { dip, device };
}

describe('DipDevice', () => {
  test('reads identity, settings and state on start', async () => {
    const { device } = await connect({ shuttle: 'ttsky25a', settings: { defaultDesign: 42 } });
    const snapshot = device.getSnapshot();
    expect(snapshot.connected).toBe(true);
    expect(snapshot.info.shuttle).toBe('ttsky25a');
    expect(snapshot.info.firmwareVersion).toBe('0.9.8');
    expect(snapshot.settings.defaultDesign).toBe(42);
    expect(snapshot.state.design).toBe(42); // loaded on boot
    expect(snapshot.state.clockHz).toBe(10);
  });

  test('sends the commands in the firmware syntax and does not log echoes', async () => {
    const { device, dip } = await connect();
    await device.selectDesign(12, 4000);
    expect(dip.received).toContain('select_design(12,4000)');
    expect(device.getSnapshot().state).toEqual({ design: 12, clockHz: 4000 });
    const logs = device.getSnapshot().logs;
    expect(logs.filter((entry) => entry.sent).map((entry) => entry.text)).toEqual([
      'read_shuttle()',
      'dump_settings()',
      'dump_state()',
      'select_design(12, 4000)',
      'dump_state()',
    ]);
    expect(logs.filter((entry) => entry.text === 'select_design(12, 4000)')).toHaveLength(1);
  });

  test('reports the quantized clock rate from the board', async () => {
    const { device } = await connect();
    await device.setClock(123456);
    expect(device.getSnapshot().state.clockHz).toBe(123711);
    await device.setClock(0);
    expect(device.getSnapshot().state.clockHz).toBe(0);
  });

  test('collects ERROR: lines', async () => {
    const { device } = await connect({ settings: { clockExternal: true } });
    const result = await device.setClock(1000);
    expect(result.errors).toEqual(["Clock driver externally, can't start"]);
  });

  test('applies only changed settings, and tracks whether they are saved to flash', async () => {
    const { device, dip } = await connect();
    const current = device.getSnapshot().settings;
    dip.received.length = 0;
    await device.applySettings({
      ...current,
      defaultDesign: 333,
      defaultClockHz: 9999,
      resetOnLoadClocks: 0,
    });
    expect(dip.received.filter((cmd) => !cmd.startsWith('dump_'))).toEqual([
      'set_default(333,9999)',
      'reset_on_load(0)',
    ]);
    expect(device.getSnapshot().settings).toMatchObject({
      defaultDesign: 333,
      defaultClockHz: 9999,
      resetOnLoadClocks: 0,
    });
    expect(device.getSnapshot().savedToFlash).toBe(false);

    const { confirmed } = await device.writeConfig();
    expect(confirmed).toBe(true);
    expect(device.getSnapshot().savedToFlash).toBe(true);
    expect(dip.flash?.defaultDesign).toBe(333);
  });

  test('serializes concurrent commands', async () => {
    const { device } = await connect();
    const [a, b] = await Promise.all([
      device.sendCommand('dump_state()'),
      device.sendCommand('about'),
    ]);
    expect(a.lines).toContain('tt.design=0');
    expect(b.lines.join('\n')).toContain('TT DIP firmware');
  });

  test('rejects pending commands when the board disconnects', async () => {
    const { device, dip } = await connect();
    const pending = device.sendCommand('dump_state()');
    void dip.close();
    await expect(pending).rejects.toThrow(/disconnected/);
    expect(device.getSnapshot().connected).toBe(false);
  });

  test('restarts the board and re-reads everything', async () => {
    const { device } = await connect();
    await device.applySettings({
      ...device.getSnapshot().settings,
      defaultDesign: 7,
      defaultClockHz: 1000,
    });
    await device.restart();
    expect(device.getSnapshot().state).toEqual({ design: 7, clockHz: 1000 });
  });

  test('fails to start when the device is not a DIP', async () => {
    let onData: (chunk: string) => void = () => {};
    // Prints a prompt after every line, but never the key=value lines of read_shuttle().
    const link: IDipLink = {
      description: 'not a DIP',
      onData: (listener) => {
        onData = listener;
      },
      onClose: () => {},
      write: async (data) => {
        queueMicrotask(() => onData(data === '\n' ? PROMPT : `huh?\r\n${PROMPT}`));
      },
      close: async () => {},
    };
    await expect(new DipDevice(link).start()).rejects.toThrow(/did not identify/);
  });
});
