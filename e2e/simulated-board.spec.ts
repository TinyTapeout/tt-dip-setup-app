// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { expect, test, type Page } from '@playwright/test';

const projects = [
  {
    macro: 'tt_um_factory_test',
    title: 'Tiny Tapeout Factory Test',
    author: 'Uri Shaked',
    address: 1,
    clock_hz: 0,
  },
  {
    macro: 'tt_um_vga_game',
    title: '2048 sliding tile puzzle game (VGA)',
    author: 'Uri Shaked',
    address: 194,
    clock_hz: 25175000,
  },
  { macro: 'tt_um_blinky', title: 'Blinky', author: 'Pat Deegan', address: 12, clock_hz: 4000 },
].map((project) => ({ ...project, repo: 'https://github.com/example/repo', commit: 'abc123' }));

async function connectSimulated(page: Page) {
  await page.route('https://index.tinytapeout.com/**', (route) =>
    route.fulfill({ json: { id: 'ttgf0p2', projects } }),
  );
  await page.goto('/?mock=1&factory=1');
  await page.getByRole('button', { name: 'Simulated board' }).click();
  await expect(page.getByRole('link', { name: 'ttgf0p2' })).toBeVisible();
  await expect(page.getByText(/^Firmware:/)).toContainText('0.9.8');
}

test('connects, selects a project and sets the clock', async ({ page }) => {
  await connectSimulated(page);
  await expect(page.getByTestId('state-design')).toHaveText('No design selected');

  const project = page.getByRole('combobox', { name: 'Project' });
  await project.fill('blinky');
  await page.getByRole('option', { name: /Blinky/ }).click();
  await expect(page.getByTestId('design-index')).toHaveValue('12');
  await expect(page.getByText('The board will clock at 4 kHz.')).toBeVisible();

  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(page.getByTestId('state-design')).toHaveText('Design 12: Blinky');
  await expect(page.getByTestId('state-clock')).toHaveText('Clock 4 kHz');

  // VGA rate is above what the board can do: the UI warns, and the board reports the capped rate.
  await project.fill('2048');
  await page.getByRole('option', { name: /2048/ }).click();
  await expect(
    page.getByText(/cannot produce exactly 25.175 MHz; it will clock at 24 MHz/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(page.getByTestId('state-clock')).toHaveText('Clock 24 MHz');

  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByTestId('state-clock')).toHaveText('Clock stopped');

  const log = page.getByTestId('serial-log');
  await expect(log).toContainText('> select_design(12, 4000)');
  await expect(log).toContainText('> set_clock_hz(0)');
  await page.screenshot({ path: 'test-results/control.png', fullPage: true });
});

test('edits the start-up configuration and saves it to flash', async ({ page }) => {
  await connectSimulated(page);
  await page.getByRole('tab', { name: 'Start-up' }).click();

  await page.getByTestId('default-index').fill('333');
  await page.getByLabel('Default clock (Hz)').fill('9999');
  await expect(page.getByText('Edited, not applied')).toBeVisible();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByTestId('unsaved-chip')).toBeVisible();
  await expect(
    page.getByText(/cannot produce exactly 9,999 Hz; it will clock at 10 kHz/),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Save to flash' }).click();
  await expect(page.getByText('Configuration saved to flash.')).toBeVisible();
  await expect(page.getByTestId('unsaved-chip')).toBeHidden();

  const log = page.getByTestId('serial-log');
  await expect(log).toContainText('> set_default(333, 9999)');
  await expect(log).toContainText('> write_config()');
  await expect(log).toContainText('INFO: Configuration saved');

  await page.getByRole('button', { name: 'Restart board' }).click();
  await expect(page.getByText('Board restarted.')).toBeVisible();
  await page.getByRole('tab', { name: 'Control' }).click();
  await expect(page.getByTestId('state-design')).toHaveText('Design 333');
  await page.screenshot({ path: 'test-results/startup.png', fullPage: true });
});
