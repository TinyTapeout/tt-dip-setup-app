// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { Paper, Stack, Tab, Tabs } from '@mui/material';
import { useState } from 'react';
import type { DipDevice } from '~/dip/DipDevice';
import { useDeviceSnapshot } from '~/dip/useDeviceSnapshot';
import { useShuttle } from '~/model/useShuttle';
import { ControlPanel } from './ControlPanel';
import { DeviceHeader } from './DeviceHeader';
import { SerialLog } from './SerialLog';
import { StartupPanel } from './StartupPanel';

export interface IBoardSetupProps {
  device: DipDevice;
}

type TabName = 'control' | 'startup';

export function BoardSetup(props: IBoardSetupProps) {
  const snapshot = useDeviceSnapshot(props.device);
  const shuttle = useShuttle(snapshot.info.shuttle);
  const [activeTab, setActiveTab] = useState<TabName>('control');

  return (
    <Stack sx={{ mt: 2 }}>
      <DeviceHeader
        info={snapshot.info}
        linkDescription={props.device.link.description}
        onDisconnect={() => props.device.close()}
      />

      <Paper sx={{ padding: 1 }}>
        <Tabs value={activeTab} onChange={(_, value: TabName) => setActiveTab(value)}>
          <Tab label="Control" value="control" />
          <Tab label="Start-up" value="startup" />
        </Tabs>
        {activeTab === 'control' && <ControlPanel device={props.device} shuttle={shuttle} />}
        {activeTab === 'startup' && <StartupPanel device={props.device} shuttle={shuttle} />}
      </Paper>

      <SerialLog logs={snapshot.logs} />
    </Stack>
  );
}
