// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { AppBar, Box, Button, IconButton, Toolbar, Typography } from '@mui/material';
import { guideURL, repo } from '~/config/consts';
import { GitHubIcon } from './GitHubIcon';

export function Header() {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div">
          Tiny Tapeout DIP Setup
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button color="inherit" href={guideURL} target="_blank" rel="noopener noreferrer">
          Guide
        </Button>
        <IconButton
          color="inherit"
          component="a"
          href={repo}
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub repository"
        >
          <GitHubIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
