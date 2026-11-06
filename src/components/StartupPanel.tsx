// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import { ContentCopy, ExpandMore, PowerSettingsNew, Save, Undo } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { formatHz } from '~/dip/clock';
import type { DipDevice } from '~/dip/DipDevice';
import { MAX_DESIGN, sameSettings, type IDipSettings } from '~/dip/protocol';
import { useDeviceSnapshot } from '~/dip/useDeviceSnapshot';
import { findProject } from '~/model/shuttle';
import type { IShuttleStatus } from '~/model/useShuttle';
import { ClockInput } from './ClockInput';
import { useNotify } from './notify';
import { ProjectSelect } from './ProjectSelect';
import { useAsyncAction } from './useAsyncAction';

export interface IStartupPanelProps {
  device: DipDevice;
  shuttle: IShuttleStatus;
}

const debugLevels = ['0: critical', '1: errors', '2: warnings', '3: info', '4: debug'];
const DEFAULT_RESET_CLOCKS = 5;

/** Edits the settings the firmware applies on power-up, and saves them to the board's flash. */
export function StartupPanel(props: IStartupPanelProps) {
  const snapshot = useDeviceSnapshot(props.device);
  const notify = useNotify();
  const { working, run } = useAsyncAction();
  const { settings } = snapshot;
  const [draft, setDraft] = useState(settings);
  const [resetClocks, setResetClocks] = useState(
    settings.resetOnLoadClocks || DEFAULT_RESET_CLOCKS,
  );

  // Follow the board when its settings change (e.g. after a restart), unless the user is editing.
  const [base, setBase] = useState(settings);
  if (settings !== base) {
    setBase(settings);
    if (sameSettings(draft, base)) {
      setDraft(settings);
    }
  }

  const dirty = !sameSettings(draft, settings);
  const busy = working || snapshot.busy;
  const defaultProject = findProject(props.shuttle.projects, draft.defaultDesign);
  const patch = (changes: Partial<IDipSettings>) => setDraft({ ...draft, ...changes });

  /** Sends the draft to the board. False if the board reported errors. */
  const applyDraft = async () => {
    const { errors } = await props.device.applySettings(draft);
    if (errors.length) {
      notify(errors.join('. '), 'error');
      return false;
    }
    return true;
  };

  const apply = () =>
    run(async () => {
      if (await applyDraft()) {
        notify('Settings applied. Save to flash to keep them after power-up.');
      }
    });

  const save = () =>
    run(async () => {
      if (dirty && !(await applyDraft())) {
        return;
      }
      const { confirmed } = await props.device.writeConfig();
      if (confirmed) {
        notify('Configuration saved to flash.', 'success');
      } else {
        notify('Configuration written, but the board did not confirm it.', 'warning');
      }
    });

  const restart = () =>
    run(async () => {
      await props.device.restart();
      notify('Board restarted.', 'success');
    });

  const useCurrent = () =>
    patch({ defaultDesign: snapshot.state.design, defaultClockHz: snapshot.state.clockHz });

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          What the board does when it powers up.
        </Typography>
        {dirty && <Chip size="small" color="warning" label="Edited, not applied" />}
        {!dirty && !snapshot.savedToFlash && (
          <Chip
            size="small"
            color="warning"
            label="Not saved to flash"
            data-testid="unsaved-chip"
          />
        )}
      </Stack>

      <Typography variant="subtitle2">Default design</Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <ProjectSelect
          projects={props.shuttle.projects}
          loading={props.shuttle.loading}
          selected={defaultProject}
          onSelect={(project) =>
            patch({
              defaultDesign: project.address,
              defaultClockHz: project.clock_hz || draft.defaultClockHz,
            })
          }
          disabled={busy}
          label="Default project"
        />
        <TextField
          sx={{ width: 100, flexShrink: 0 }}
          label="Index"
          type="number"
          size="small"
          value={draft.defaultDesign}
          disabled={busy}
          slotProps={{ htmlInput: { min: 0, max: MAX_DESIGN, 'data-testid': 'default-index' } }}
          onChange={(e) => patch({ defaultDesign: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        />
        <Button
          onClick={useCurrent}
          variant="outlined"
          startIcon={<ContentCopy />}
          disabled={busy}
          sx={{ height: 40, whiteSpace: 'nowrap', flexShrink: 0 }}
          title={`Use design ${snapshot.state.design} at ${formatHz(snapshot.state.clockHz)}, as currently selected`}
        >
          Use current
        </Button>
      </Stack>
      <FormHelperText sx={{ mt: -1 }}>
        Index 0 disables loading a design on power-up.
      </FormHelperText>
      <ClockInput
        label="Default clock (Hz)"
        value={draft.defaultClockHz}
        onChange={(hz) => patch({ defaultClockHz: hz })}
        disabled={busy || draft.defaultDesign === 0}
      />

      <Typography variant="subtitle2">Reset</Typography>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Switch
              checked={draft.resetOnLoadClocks > 0}
              disabled={busy}
              onChange={(e) => patch({ resetOnLoadClocks: e.target.checked ? resetClocks : 0 })}
            />
          }
          label="Reset the project after loading it"
        />
        <TextField
          sx={{ width: 150 }}
          label="Clocks during reset"
          type="number"
          size="small"
          value={draft.resetOnLoadClocks || resetClocks}
          disabled={busy || draft.resetOnLoadClocks === 0}
          slotProps={{ htmlInput: { min: 1, max: 255 } }}
          onChange={(e) => {
            const clocks = Math.max(1, Math.min(255, parseInt(e.target.value, 10) || 1));
            setResetClocks(clocks);
            patch({ resetOnLoadClocks: clocks });
          }}
        />
      </Stack>

      <Typography variant="subtitle2">External circuitry</Typography>
      <FormControlLabel
        control={
          <Switch
            checked={draft.checkExtDriveOnBoot}
            disabled={busy}
            onChange={(e) => patch({ checkExtDriveOnBoot: e.target.checked })}
          />
        }
        label="Detect external drivers on power-up"
      />
      <FormHelperText sx={{ mt: -1 }}>
        Leaves the clock, reset and mux lines alone when they are pulled low by external circuitry
        at power-up.
      </FormHelperText>

      <Accordion disableGutters variant="outlined">
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">Advanced</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            <Alert severity="info">
              These override the automatic detection, and take effect immediately.
            </Alert>
            <FormControlLabel
              control={
                <Switch
                  checked={draft.muxExternal}
                  disabled={busy}
                  onChange={(e) => patch({ muxExternal: e.target.checked })}
                />
              }
              label="Mux driven externally"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draft.clockExternal}
                  disabled={busy}
                  onChange={(e) => patch({ clockExternal: e.target.checked })}
                />
              }
              label="Clock and reset driven externally"
            />
            <FormControl size="small" sx={{ width: 200 }} disabled={busy}>
              <InputLabel id="debug-level-label">Serial debug level</InputLabel>
              <Select
                labelId="debug-level-label"
                label="Serial debug level"
                value={draft.debugLevel}
                onChange={(e) => patch({ debugLevel: Number(e.target.value) })}
              >
                {debugLevels.map((title, level) => (
                  <MenuItem key={level} value={level}>
                    {title}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Below level 1 the board no longer reports errors.</FormHelperText>
            </FormControl>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button onClick={apply} variant="outlined" disabled={busy || !dirty}>
          Apply
        </Button>
        <Button
          onClick={save}
          variant="contained"
          startIcon={<Save />}
          disabled={busy || (!dirty && snapshot.savedToFlash)}
        >
          Save to flash
        </Button>
        <Button
          onClick={() => setDraft(settings)}
          variant="outlined"
          startIcon={<Undo />}
          disabled={busy || !dirty}
        >
          Revert
        </Button>
        <Button
          onClick={restart}
          variant="outlined"
          color="secondary"
          startIcon={<PowerSettingsNew />}
          disabled={busy}
          title="Warm-boot the firmware to see the start-up behaviour"
        >
          Restart board
        </Button>
      </Stack>
    </Stack>
  );
}
