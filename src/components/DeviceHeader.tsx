// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { Button, Link, Stack, Typography } from '@mui/material';
import type { IDipInfo } from '~/dip/protocol';
import { shuttleURL } from '~/model/shuttle';

export interface IDeviceHeaderProps {
  info: IDipInfo;
  linkDescription: string;
  onDisconnect: () => void;
}

export function DeviceHeader(props: IDeviceHeaderProps) {
  const { shuttle, firmwareVersion, board } = props.info;
  const shuttleLink = shuttle?.startsWith('tt') && shuttle.length >= 4 ? shuttleURL(shuttle) : null;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
      <Stack sx={{ flex: 1, mr: 1 }}>
        <Typography>
          Shuttle:{' '}
          {shuttleLink ? (
            <Link href={shuttleLink} target="_blank" rel="noopener noreferrer">
              <strong>{shuttle}</strong>
            </Link>
          ) : (
            <strong>{shuttle ?? '<unknown>'}</strong>
          )}
        </Typography>
        <Typography>
          Firmware: <strong>{firmwareVersion ?? '<unknown>'}</strong>
          <Typography component="span" color="text.secondary" variant="body2" sx={{ ml: 1 }}>
            ({board ?? 'board'}, {props.linkDescription})
          </Typography>
        </Typography>
      </Stack>
      <Button onClick={props.onDisconnect} variant="outlined">
        Disconnect
      </Button>
    </Stack>
  );
}
