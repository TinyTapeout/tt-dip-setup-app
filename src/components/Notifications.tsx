// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { Alert, Snackbar, type AlertColor } from '@mui/material';
import { useCallback, useState, type ReactNode } from 'react';
import { NotifyContext, type Notify } from './notify';

export interface INotificationsProviderProps {
  children: ReactNode;
}

interface INotification {
  message: string;
  severity: AlertColor;
  key: number;
}

/** Provides `useNotify()`, which shows a message in a snackbar at the bottom of the page. */
export function NotificationsProvider(props: INotificationsProviderProps) {
  const [current, setCurrent] = useState<INotification | null>(null);
  const notify = useCallback<Notify>((message, severity = 'info') => {
    setCurrent({ message, severity, key: Date.now() });
  }, []);

  return (
    <NotifyContext.Provider value={notify}>
      {props.children}
      <Snackbar
        key={current?.key}
        open={current != null}
        autoHideDuration={current?.severity === 'error' ? 8000 : 4000}
        onClose={(_, reason) => reason !== 'clickaway' && setCurrent(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={current?.severity ?? 'info'}
          variant="filled"
          onClose={() => setCurrent(null)}
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </NotifyContext.Provider>
  );
}
