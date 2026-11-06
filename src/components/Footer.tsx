// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { Box, Link, Typography } from '@mui/material';
import { repo } from '~/config/consts';

export function Footer() {
  const commit = __COMMIT_HASH__;
  const buildTimeShort = __BUILD_TIME__.replace(/\.\d{3}/, '');

  return (
    <Box
      component="footer"
      sx={{
        py: 1,
        px: 2,
        mt: 4,
        width: '100%',
        textAlign: 'center',
        backgroundColor: (theme) =>
          theme.palette.mode === 'light' ? theme.palette.grey[200] : theme.palette.grey[800],
      }}
    >
      <Typography variant="body2">
        Copyright (C) 2026, Tiny Tapeout B.V. Revision{' '}
        <Link href={`${repo}/commit/${commit}`} target="_blank" rel="noopener noreferrer">
          <code>{commit}</code>
        </Link>{' '}
        built at {buildTimeShort}.
      </Typography>
    </Box>
  );
}
