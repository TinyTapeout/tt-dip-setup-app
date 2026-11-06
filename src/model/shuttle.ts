// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

export interface IProject {
  macro: string;
  address: number;
  title: string;
  author: string;
  repo: string;
  commit: string;
  clock_hz: number;
  danger_level?: 'high' | 'medium' | 'safe' | 'unknown';
  danger_reason?: string;
  /** Defaults to 'project' when missing. */
  type?: 'project' | 'group' | 'subtile';
}

const indexURL = 'https://index.tinytapeout.com';
const fields = 'title,author,repo,address,macro,clock_hz,commit,danger_level,danger_reason,type';

/** The shuttle's projects from the Tiny Tapeout index, sorted by title. */
export async function fetchShuttleProjects(id: string, signal: AbortSignal): Promise<IProject[]> {
  const response = await fetch(`${indexURL}/${encodeURIComponent(id)}.json?fields=${fields}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `Shuttle "${id}" not found in the Tiny Tapeout index (HTTP ${response.status})`,
    );
  }
  const index: { projects: IProject[] } = await response.json();
  // The DIP firmware can't select subtiles (they share their group's mux address).
  const projects = index.projects.filter((p) => (p.type ?? 'project') === 'project');
  return projects.sort((a, b) => a.title.localeCompare(b.title));
}

export function findProject(projects: IProject[], address: number) {
  return projects.find((project) => project.address === address) ?? null;
}

export function shuttleURL(id: string) {
  return `https://tinytapeout.com/chips/${id}/`;
}

export function projectLinks(shuttleId: string, project: IProject) {
  return {
    repo: `${project.repo}/tree/${project.commit}`,
    docs: `https://tinytapeout.com/chips/${shuttleId}/${project.macro}`,
    feedback: `https://app.tinytapeout.com/shuttles/${shuttleId}/${project.macro}/feedback`,
  };
}
