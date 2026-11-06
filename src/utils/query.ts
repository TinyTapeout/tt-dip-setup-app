// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

function queryFlag(name: string) {
  return new URLSearchParams(location.search).get(name) === '1';
}

export const isFactoryMode = () => queryFlag('factory');

/** `?mock=1` offers a simulated board, for development without hardware. */
export const isMockMode = () => queryFlag('mock');
