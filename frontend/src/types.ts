// Shared API entity types for Track B screens.

export interface Category {
  id: string;
  name: string;
  _count?: { assets: number };
}

export interface Department {
  id: string;
  name: string;
  status: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
}

export interface Allocation {
  id: string;
  assetId: string;
  holderUserId: string | null;
  holderDepartmentId: string | null;
  allocatedAt: string;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  conditionNoteIn: string | null;
  isActive: boolean;
  holder?: { id: string; name: string; email?: string } | null;
  asset?: { id: string; assetTag: string; name: string; status: string };
}

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  categoryId: string;
  category?: { id: string; name: string };
  serialNumber: string | null;
  acquisitionDate: string | null;
  acquisitionCost: number | null;
  condition: string | null;
  location: string | null;
  photoUrl: string | null;
  isBookable: boolean;
  status: string;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  createdAt: string;
  allocations?: Allocation[];
}

export interface Transfer {
  id: string;
  assetId: string;
  fromUserId: string | null;
  toUserId: string | null;
  status: string;
  requestedAt: string;
  decidedAt: string | null;
  decidedById: string | null;
  fromUserName?: string | null;
  toUserName?: string | null;
  decidedByName?: string | null;
  asset?: { id: string; assetTag: string; name: string };
}

export interface Booking {
  id: string;
  assetId: string;
  bookedById: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
  asset?: { id: string; assetTag: string; name: string; location?: string | null };
  bookedBy?: { id: string; name: string };
}

export interface MaintenanceRequest {
  id: string;
  assetId: string;
  raisedById: string;
  issue: string;
  priority: string;
  photoUrl: string | null;
  status: string;
  technicianName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  asset?: { id: string; assetTag: string; name: string; status?: string };
  raisedBy?: { id: string; name: string };
}

export interface AuditItem {
  id: string;
  auditCycleId: string;
  assetId: string;
  result: 'PENDING' | 'VERIFIED' | 'MISSING' | 'DAMAGED';
  note: string | null;
  asset?: { id: string; assetTag: string; name: string; status: string; location: string | null };
}

export interface AuditCycle {
  id: string;
  scopeDept: string | null;
  scopeLoc: string | null;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
  assignments: { id: string; auditorId: string; auditor?: { id: string; name: string } }[];
  items?: AuditItem[];
  discrepancies?: AuditItem[];
  _count?: { items: number };
}
