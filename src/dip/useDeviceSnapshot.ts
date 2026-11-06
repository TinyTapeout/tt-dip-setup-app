// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { useSyncExternalStore } from 'react';
import type { DipDevice } from './DipDevice';

export function useDeviceSnapshot(device: DipDevice) {
  return useSyncExternalStore(device.subscribe, device.getSnapshot, device.getSnapshot);
}
