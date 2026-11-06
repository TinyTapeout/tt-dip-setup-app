// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { Box, Collapse, IconButton, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import type { ILogEntry } from '~/dip/DipDevice';

export interface ISerialLogProps {
  logs: ILogEntry[];
}

export function SerialLog(props: ISerialLogProps) {
  const [open, setOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current && open) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [props.logs, open]);

  return (
    <Box
      sx={{ background: 'black', color: '#ccc', mt: 2, borderRadius: 1, fontFamily: 'monospace' }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', px: 1 }}>
        <Typography variant="body2" sx={{ flex: 1, fontFamily: 'inherit' }}>
          Serial log
        </Typography>
        <IconButton size="small" sx={{ color: 'inherit' }} onClick={() => setOpen(!open)}>
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Stack>
      <Collapse in={open}>
        <Box
          ref={listRef}
          data-testid="serial-log"
          sx={{ maxHeight: 300, overflow: 'auto', px: 1, pb: 1 }}
        >
          {props.logs.map((entry) => (
            <Box
              key={entry.id}
              sx={{
                color: entry.sent ? '#ccffcc' : '#ffccff',
                whiteSpace: 'pre-wrap',
                fontSize: 13,
              }}
            >
              {entry.sent ? '> ' : ''}
              {entry.text}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
