// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { useState } from 'react';
import { errorMessage } from '~/utils/errorMessage';
import { useNotify } from './notify';

/** Tracks whether an action is in flight, and reports a thrown error as a notification. */
export function useAsyncAction() {
  const notify = useNotify();
  const [working, setWorking] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setWorking(true);
    try {
      await action();
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setWorking(false);
    }
  };

  return { working, run };
}
