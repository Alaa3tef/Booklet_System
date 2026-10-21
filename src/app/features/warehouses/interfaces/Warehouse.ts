export interface Warehouse {
  id: number;
  code: string;
  name: string;
  dateCreated: string;
}

export interface WarehouseRequest {
  code: string;
  name: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
  statusCode: number;
  errors?: unknown;
}

export interface PagedResult<T> {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  data: T[];
}

export type WarehousesResponse = ApiResponse<PagedResult<Warehouse>>;
