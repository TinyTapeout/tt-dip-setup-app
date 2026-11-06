// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import {
  Error as ErrorIcon,
  FactCheck,
  Info,
  PrecisionManufacturing,
  RestartAlt,
  Stop,
  TouchApp,
  Warning,
} from '@mui/icons-material';
import { Alert, Button, Chip, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { formatHz } from '~/dip/clock';
import type { DipDevice, ICommandResult } from '~/dip/DipDevice';
import { MAX_DESIGN } from '~/dip/protocol';
import { useDeviceSnapshot } from '~/dip/useDeviceSnapshot';
import { findProject, projectLinks, type IProject } from '~/model/shuttle';
import type { IShuttleStatus } from '~/model/useShuttle';
import { isFactoryMode } from '~/utils/query';
import { ClockInput } from './ClockInput';
import { GitHubIcon } from './GitHubIcon';
import { useNotify } from './notify';
import { ProjectSelect } from './ProjectSelect';
import { useAsyncAction } from './useAsyncAction';

export interface IControlPanelProps {
  device: DipDevice;
  shuttle: IShuttleStatus;
}

const CLOCK_NOT_STARTED = 'The board did not start the clock. Is the clock driven externally?';

export function ControlPanel(props: IControlPanelProps) {
  const snapshot = useDeviceSnapshot(props.device);
  const notify = useNotify();
  const { working, run } = useAsyncAction();
  const [design, setDesign] = useState(snapshot.state.design);
  const [clockHz, setClockHz] = useState(snapshot.state.clockHz);

  const { projects } = props.shuttle;
  const selectedProject = findProject(projects, design);
  const boardProject = findProject(projects, snapshot.state.design);
  const dangerLevel = selectedProject?.danger_level;
  const links =
    selectedProject && props.shuttle.id ? projectLinks(props.shuttle.id, selectedProject) : null;
  const busy = working || snapshot.busy;

  /** Runs a board command and reports its `ERROR:` lines, or else the success message. */
  const runCommand = (command: () => Promise<ICommandResult>, success?: string) =>
    run(async () => {
      const { errors } = await command();
      if (errors.length) {
        notify(errors.join('. '), 'error');
      } else if (success) {
        notify(success, 'success');
      }
    });

  const setSelectedProject = (project: IProject) => {
    setDesign(project.address);
    if (project.clock_hz) {
      setClockHz(project.clock_hz);
    }
  };

  const setSelectedIndex = (address: number) => {
    if (Number.isNaN(address)) {
      return;
    }
    setDesign(Math.max(0, Math.min(MAX_DESIGN, address)));
    const project = findProject(projects, address);
    if (project?.clock_hz) {
      setClockHz(project.clock_hz);
    }
  };

  // The firmware doesn't report failures as errors below debug level 1, so the state is checked.
  const select = () =>
    runCommand(async () => {
      const result = await props.device.selectDesign(design, clockHz);
      const { state } = props.device.getSnapshot();
      if (state.design !== design) {
        result.errors.push(
          `The board reports design ${state.design} instead of ${design}. If the mux is driven externally, the board cannot select designs.`,
        );
      } else if (clockHz > 0 && state.clockHz === 0) {
        result.errors.push(CLOCK_NOT_STARTED);
      }
      return result;
    });

  const setClock = () =>
    runCommand(async () => {
      const result = await props.device.setClock(clockHz);
      if (clockHz > 0 && props.device.getSnapshot().state.clockHz === 0) {
        result.errors.push(CLOCK_NOT_STARTED);
      }
      return result;
    });

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          Board state:
        </Typography>
        <Chip
          size="small"
          label={
            snapshot.state.design
              ? `Design ${snapshot.state.design}${boardProject ? `: ${boardProject.title}` : ''}`
              : 'No design selected'
          }
          color={snapshot.state.design ? 'primary' : 'default'}
          data-testid="state-design"
        />
        <Chip
          size="small"
          label={
            snapshot.state.clockHz ? `Clock ${formatHz(snapshot.state.clockHz)}` : 'Clock stopped'
          }
          color={snapshot.state.clockHz ? 'primary' : 'default'}
          data-testid="state-clock"
        />
        {snapshot.settings.muxExternal && (
          <Chip size="small" color="warning" label="Mux driven externally" />
        )}
        {snapshot.settings.clockExternal && (
          <Chip size="small" color="warning" label="Clock/reset driven externally" />
        )}
      </Stack>

      {props.shuttle.error && (
        <Alert severity="warning">
          Could not load the project list for shuttle <strong>{props.shuttle.id}</strong>:{' '}
          {props.shuttle.error}. You can still select designs by index.
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <ProjectSelect
          projects={projects}
          loading={props.shuttle.loading}
          selected={selectedProject}
          onSelect={setSelectedProject}
          disabled={busy}
        />
        <TextField
          sx={{ width: 100, flexShrink: 0 }}
          label="Index"
          type="number"
          size="small"
          value={design}
          disabled={busy}
          slotProps={{ htmlInput: { min: 0, max: MAX_DESIGN, 'data-testid': 'design-index' } }}
          onChange={(e) => setSelectedIndex(parseInt(e.target.value, 10))}
        />
        <Button
          onClick={select}
          variant="contained"
          disabled={busy || dangerLevel === 'high'}
          title={dangerLevel === 'high' ? selectedProject?.danger_reason : undefined}
          sx={{ height: 40 }}
        >
          Select
        </Button>
        {dangerLevel === 'medium' && (
          <Tooltip title={selectedProject?.danger_reason}>
            <Warning color="warning" fontSize="large" />
          </Tooltip>
        )}
        {dangerLevel === 'high' && (
          <Tooltip title={selectedProject?.danger_reason}>
            <ErrorIcon color="error" fontSize="large" />
          </Tooltip>
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <ClockInput value={clockHz} onChange={setClockHz} disabled={busy} />
        <Button onClick={setClock} variant="contained" disabled={busy} sx={{ height: 40 }}>
          Set
        </Button>
        <Button
          onClick={() => runCommand(() => props.device.setClock(0))}
          variant="outlined"
          startIcon={<Stop />}
          disabled={busy || snapshot.state.clockHz === 0}
          sx={{ height: 40 }}
        >
          Stop
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button
          onClick={() => runCommand(() => props.device.resetProject())}
          variant="outlined"
          startIcon={<RestartAlt />}
          disabled={busy}
        >
          Reset project
        </Button>
        <Button
          onClick={() => runCommand(() => props.device.manualClock())}
          variant="outlined"
          startIcon={<TouchApp />}
          disabled={busy}
          title="Stop the clock and toggle it once"
        >
          Clock once
        </Button>
        {isFactoryMode() && (
          <Button
            sx={{ backgroundColor: 'orange' }}
            onClick={() => runCommand(() => props.device.startFactoryTest(), 'Factory test loaded')}
            variant="outlined"
            startIcon={<PrecisionManufacturing />}
            disabled={busy}
          >
            Factory Test
          </Button>
        )}
      </Stack>

      {links && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button
            component="a"
            sx={{ backgroundColor: 'yellow' }}
            href={links.feedback}
            target="_blank"
            variant="outlined"
            startIcon={<FactCheck />}
          >
            Report results
          </Button>
          <Button component="a" startIcon={<Info />} href={links.docs} target="_blank">
            Project docs
          </Button>
          <Button component="a" startIcon={<GitHubIcon />} href={links.repo} target="_blank">
            Repo
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
