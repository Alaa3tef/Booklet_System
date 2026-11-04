export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
  statusCode?: number;
  errors?: string[];
  count?: number;
}

export interface PagedResponse<T> extends ApiResponse<T[]> {
  pageNumber?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
}

export interface AuditLog {
  id: number;
  action: string;
  entityName: string | null;
  entityId: string | number | null;
  userId: number | null;
  userName: string | null;
  userFullName: string | null;
  isUserDeleted: boolean;
  occurredAt: string;            // عدّلي الاسم لو مختلف
  correlationId: string | null;
  batchId: number | null;
  committeeId: number | null;
  boxId: number | null;
  deliveryOrderId: number | null;
  summary: string | null;
}

export interface AuditLogFilter {
  search?: string | null;
  from?: string | null;
  to?: string | null;
  action?: string | null;
  userId?: number | null;
  batchId?: number | null;
  committeeId?: number | null;
  boxId?: number | null;
  deliveryOrderId?: number | null;
  snapshotTime?: string | null;
  pageNumber: number;
  pageSize: number;
  isPaged: boolean;
  pageSizeOrAll?: number | null;
  searchTerm?: string | null;
  ascending?: boolean | null;
}

// Lookups
export interface DeliveryOrderLookup {
  deliveryOrderId: number;
  year: number;
  governorateName: string;
  deliveryDate: string;
  displayLabel: string;
}

export interface CommitteeLookup {
  committeeId: number;
  batchId: number;
  committeeNumber: string;
  displayLabel: string;
}

export interface BatchLookup {
  batchId: number;
  displayLabel: string;
  year: number;
  governorateName: string;
  subjectName: string;
  roundName: string;
  educationalStageName: string;
}

export interface ActorLookup {
  userId: number;
  userName: string;
  displayName: string;
  isActive: boolean;
  isDeleted: boolean;
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}