export interface Warehouse {
  id: number;
  name: string;
  code: string;
  location?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface WarehouseQuery {
  pageNumber: number;
  pageSize: number;
  searchTerm?: string;
  isActive?: boolean;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

export interface CreateWarehousePayload {
  name: string;
  code: string;
  location?: string;
  description?: string;
}

export type UpdateWarehousePayload = CreateWarehousePayload;

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}
