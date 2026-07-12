import type { AssetStatus } from '../../generated/prisma/enums.js';

/**
 * Single source of truth for the asset lifecycle state machine.
 * Every status change in the system must pass through canTransition().
 */
const ALLOWED_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  AVAILABLE: ['ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED'],
  ALLOCATED: ['AVAILABLE', 'UNDER_MAINTENANCE', 'LOST'],
  RESERVED: ['AVAILABLE', 'ALLOCATED'],
  UNDER_MAINTENANCE: ['AVAILABLE', 'ALLOCATED', 'RETIRED', 'DISPOSED'],
  LOST: ['AVAILABLE'],
  RETIRED: ['DISPOSED'],
  DISPOSED: [],
};

export function canTransition(from: AssetStatus, to: AssetStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: AssetStatus, to: AssetStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid asset lifecycle transition: ${from} → ${to}`);
  }
}

export { ALLOWED_TRANSITIONS };
