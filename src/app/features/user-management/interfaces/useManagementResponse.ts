import { AppUser } from './useManagement';
import { AppRole } from './role';

// Generic wrapper used by every endpoint
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  statusCode: number;
  count?: number;
}

export interface PagedResult<T> {
  currentPage: number;
  totalPages: number;
  totalCount: number;
   activeUsersCount: number;
  inactiveUsersCount: number;
  managementUsersCount: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  data: T[];
}

export type AppUserResponse = ApiResponse<PagedResult<AppUser>>;
export type AppRolesResponse = ApiResponse<AppRole[]>;

export interface UserRequest {
  fullName: string;
  email: string;
  roleId: number;
  //isActive: boolean;
  password?: string; // required on create only
}


