// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import type { AlertColor } from '@mui/material';
import { createContext, useContext } from 'react';

export type Notify = (message: string, severity?: AlertColor) => void;

export const NotifyContext = createContext<Notify>(() => {});

export function useNotify() {
  return useContext(NotifyContext);
}
