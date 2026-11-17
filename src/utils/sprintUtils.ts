import { Sprint } from '../types';

/**
 * Filters sprints to only those that can have tasks assigned or moved into them.
 * Excludes completed sprints.
 */
export function getAssignableSprints(sprints: Sprint[]): Sprint[] {
  if (!Array.isArray(sprints)) return [];
  return sprints.filter(s => s.status?.toUpperCase() !== 'COMPLETED');
}

/**
 * Returns the currently active sprint, or falls back to the first available non-completed sprint.
 */
export function getActiveSprint(sprints: Sprint[]): Sprint | undefined {
  if (!Array.isArray(sprints)) return undefined;
  return (
    sprints.find(s => s.status?.toUpperCase() === 'ACTIVE') ||
    sprints.find(s => s.status?.toUpperCase() !== 'COMPLETED') ||
    sprints[0]
  );
}
