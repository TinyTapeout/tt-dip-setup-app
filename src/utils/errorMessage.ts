// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
