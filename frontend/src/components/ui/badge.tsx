import { titleCase } from '@/lib/format';

/**
 * One badge component for every status enum in the system.
 * Colors follow a consistent semantic scale: green = good/active,
 * amber = waiting, blue = in progress, red = problem, gray = terminal.
 */
const statusStyles: Record<string, string> = {
  // Asset lifecycle
  AVAILABLE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ALLOCATED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  RESERVED: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  UNDER_MAINTENANCE: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  LOST: 'bg-red-50 text-red-700 ring-red-600/20',
  RETIRED: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  DISPOSED: 'bg-gray-100 text-gray-500 ring-gray-500/20',
  // Bookings
  UPCOMING: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  ONGOING: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  COMPLETED: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  CANCELLED: 'bg-red-50 text-red-600 ring-red-600/20',
  // Maintenance
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  APPROVED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  REJECTED: 'bg-red-50 text-red-700 ring-red-600/20',
  TECHNICIAN_ASSIGNED: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  IN_PROGRESS: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  // Transfers
  REQUESTED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  // Audit
  OPEN: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  CLOSED: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  VERIFIED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  MISSING: 'bg-red-50 text-red-700 ring-red-600/20',
  DAMAGED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  // Priorities
  LOW: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  MEDIUM: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  HIGH: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  CRITICAL: 'bg-red-50 text-red-700 ring-red-600/20',
  // Generic
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  INACTIVE: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const style = statusStyles[status] ?? 'bg-gray-100 text-gray-600 ring-gray-500/20';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style} ${className}`}
    >
      {titleCase(status)}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
      Overdue
    </span>
  );
}
