// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { Error as ErrorIcon, Warning } from '@mui/icons-material';
import { Autocomplete, Box, Stack, TextField, Typography } from '@mui/material';
import type { IProject } from '~/model/shuttle';

export interface IProjectSelectProps {
  projects: IProject[];
  loading?: boolean;
  selected: IProject | null;
  onSelect: (project: IProject) => void;
  label?: string;
  disabled?: boolean;
}

function matches(project: IProject, query: string) {
  const q = query.toLowerCase();
  return (
    project.title.toLowerCase().includes(q) ||
    project.author.toLowerCase().includes(q) ||
    project.macro.toLowerCase().includes(q) ||
    String(project.address) === q
  );
}

export function ProjectSelect(props: IProjectSelectProps) {
  return (
    <Autocomplete
      options={props.projects}
      value={props.selected}
      loading={props.loading}
      disabled={props.disabled}
      size="small"
      fullWidth
      autoHighlight
      onChange={(_, project) => project && props.onSelect(project)}
      getOptionLabel={(project) => project.title}
      isOptionEqualToValue={(a, b) => a.address === b.address}
      filterOptions={(options, { inputValue }) => {
        const query = inputValue.trim();
        return query ? options.filter((project) => matches(project, query)) : options;
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={props.label ?? 'Project'}
          placeholder={props.loading ? 'Loading projects...' : 'Search by title, author or index'}
        />
      )}
      renderOption={({ key, ...optionProps }, project) => (
        <li key={key} {...optionProps}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', width: '100%' }}>
            <Box component="code" sx={{ minWidth: 36, textAlign: 'right' }}>
              {project.address}
            </Box>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap>
                {project.title}
                {project.danger_level === 'medium' && (
                  <Warning
                    color="warning"
                    fontSize="small"
                    titleAccess={project.danger_reason}
                    sx={{ verticalAlign: 'middle', ml: 1 }}
                  />
                )}
                {project.danger_level === 'high' && (
                  <ErrorIcon
                    color="error"
                    fontSize="small"
                    titleAccess={project.danger_reason}
                    sx={{ verticalAlign: 'middle', ml: 1 }}
                  />
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                by {project.author}
              </Typography>
            </Stack>
          </Stack>
        </li>
      )}
    />
  );
}
