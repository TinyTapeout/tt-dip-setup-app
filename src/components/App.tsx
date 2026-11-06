// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import {
  Button,
  CircularProgress,
  CssBaseline,
  Stack,
  ThemeProvider,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { DipDevice } from '~/dip/DipDevice';
import { SimulatedDip } from '~/dip/SimulatedDip';
import { requestDipPort, WebSerialLink } from '~/dip/WebSerialLink';
import { errorMessage } from '~/utils/errorMessage';
import { isMockMode } from '~/utils/query';
import { theme } from '~/utils/theme';
import { BoardSetup } from './BoardSetup';
import { Footer } from './Footer';
import { Header } from './Header';
import { NotificationsProvider } from './Notifications';
import { useNotify } from './notify';

const serialSupported = 'serial' in navigator;

function Main() {
  const notify = useNotify();
  const [device, setDevice] = useState<DipDevice | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    if (!device) {
      return;
    }
    return device.subscribe(() => {
      if (!device.getSnapshot().connected) {
        setDevice(null);
        notify('The board was disconnected.', 'warning');
      }
    });
  }, [device, notify]);

  useEffect(() => () => void device?.close(), [device]);

  const connect = async (simulated: boolean) => {
    setConnecting(true);
    setConnectError(null);
    let candidate: DipDevice | null = null;
    try {
      const link = simulated
        ? new SimulatedDip({ latencyMs: 5 })
        : new WebSerialLink(await requestDipPort());
      candidate = new DipDevice(link);
      await candidate.start();
      setDevice(candidate);
    } catch (e) {
      await candidate?.close();
      const message = errorMessage(e);
      if (!/No port selected/i.test(message)) {
        setConnectError(message);
      }
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Stack component="main" sx={{ alignItems: 'center', maxWidth: '100vw', minHeight: '100vh' }}>
      <Header />

      <Stack sx={{ maxWidth: '100%', width: 640, flex: 1, py: 2, px: 2 }}>
        <Typography variant="h6" component="h1">
          Configure your Tiny Tapeout DIP
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Select the active design, set its clock, and choose what the board does on power-up.
        </Typography>

        {!serialSupported && (
          <Typography variant="body1" color="error" sx={{ mt: 2 }}>
            Your browser does not support the Web Serial API. You can use Chrome, Edge, Opera, or
            Firefox 151+ to connect to the DIP from this page.
          </Typography>
        )}

        {!device && (
          <Stack spacing={1} sx={{ alignItems: 'flex-start', mt: 2 }}>
            <Stack direction="row" spacing={1}>
              <Button
                onClick={() => void connect(false)}
                variant="contained"
                disabled={!serialSupported || connecting}
                startIcon={connecting ? <CircularProgress size={18} color="inherit" /> : undefined}
              >
                {connecting ? 'Connecting...' : 'Connect to DIP'}
              </Button>
              {isMockMode() && (
                <Button onClick={() => void connect(true)} variant="outlined" disabled={connecting}>
                  Simulated board
                </Button>
              )}
            </Stack>
            {connectError && (
              <Typography variant="body1" color="error">
                Error: {connectError}
              </Typography>
            )}
          </Stack>
        )}

        {device && <BoardSetup device={device} />}
      </Stack>

      <Footer />
    </Stack>
  );
}

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <NotificationsProvider>
        <Main />
      </NotificationsProvider>
    </ThemeProvider>
  );
}
