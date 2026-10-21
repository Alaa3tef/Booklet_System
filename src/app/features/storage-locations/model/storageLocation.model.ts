export interface StorageLocation {
  id: number;
  warehouseId: number;
  warehouseName?: string;
  code: string;
  area: string;
  rack: string;
  shelf: string;
  bin: string;
}

export interface StorageLocationQuery {
  warehouseId?: number | null;
  pageNumber: number;
  pageSize: number;
  searchTerm?: string;
  ascending?: boolean;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

export interface CreateStorageLocationPayload {
  warehouseId: number;
  code: string;
  area: string;
  rack: string;
  shelf: string;
  bin: string;
}

// PUT body has no warehouseId
export type UpdateStorageLocationPayload = Omit<CreateStorageLocationPayload, 'warehouseId'>;

export interface LookupItem {
  id: number;
  name: string;
}