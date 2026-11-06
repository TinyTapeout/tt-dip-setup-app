// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
