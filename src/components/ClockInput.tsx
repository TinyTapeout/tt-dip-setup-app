// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import { clockPresets, effectiveClockHz, formatHz, MAX_CLOCK_HZ } from '~/dip/clock';

export interface IClockInputProps {
  /** Requested rate in Hz; 0 means no clock. */
  value: number;
  onChange: (hz: number) => void;
  label?: string;
  disabled?: boolean;
}

export function ClockInput(props: IClockInputProps) {
  const label = props.label ?? 'Clock (Hz)';
  const presetLabelId = useId();
  const effective = effectiveClockHz(props.value);
  const quantized = props.value > 0 && effective !== props.value;
  const presetValue = clockPresets.some((preset) => preset.hz === props.value) ? props.value : '';

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1}>
        <TextField
          sx={{ width: 150 }}
          label={label}
          type="number"
          size="small"
          value={props.value}
          disabled={props.disabled}
          slotProps={{ htmlInput: { min: 0, max: MAX_CLOCK_HZ } }}
          onChange={(e) => props.onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
        />
        <FormControl sx={{ width: 130 }} size="small" disabled={props.disabled}>
          <InputLabel id={presetLabelId}>Preset</InputLabel>
          <Select
            labelId={presetLabelId}
            label="Preset"
            value={presetValue}
            onChange={(e) => e.target.value && props.onChange(Number(e.target.value))}
          >
            {clockPresets.map((preset) => (
              <MenuItem key={preset.hz} value={preset.hz}>
                {preset.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      <Typography variant="caption" color={quantized ? 'warning.main' : 'text.secondary'}>
        {props.value <= 0
          ? 'No clock: the project will not be clocked by the board.'
          : quantized
            ? `The board cannot produce exactly ${formatHz(props.value)}; it will clock at ${formatHz(effective)}.`
            : `The board will clock at ${formatHz(effective)}.`}
      </Typography>
    </Stack>
  );
}
