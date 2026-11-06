// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { useEffect, useState } from 'react';
import { errorMessage } from '~/utils/errorMessage';
import { fetchShuttleProjects, type IProject } from './shuttle';

export interface IShuttleStatus {
  id: string | null;
  loading: boolean;
  error: string | null;
  projects: IProject[];
}

interface IShuttleResult {
  id: string;
  projects: IProject[];
  error: string | null;
}

/** Loads the project list of the given shuttle from the Tiny Tapeout index. */
export function useShuttle(id: string | null): IShuttleStatus {
  const [result, setResult] = useState<IShuttleResult | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    const controller = new AbortController();
    fetchShuttleProjects(id, controller.signal)
      .then((projects) => setResult({ id, projects, error: null }))
      .catch((e) => {
        if (!controller.signal.aborted) {
          setResult({ id, projects: [], error: errorMessage(e) });
        }
      });
    return () => controller.abort();
  }, [id]);

  if (!id) {
    return { id, loading: false, error: null, projects: [] };
  }
  if (result?.id !== id) {
    return { id, loading: true, error: null, projects: [] };
  }
  return { id, loading: false, error: result.error, projects: result.projects };
}
