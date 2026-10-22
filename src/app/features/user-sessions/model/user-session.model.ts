export interface UserSession {
  userId: number;
  fullName: string;
  email: string;
  /** true = currently has an active token (online), false = logged out */
  isActive: boolean;
  currentSessionIp: string | null;
  lastSessionIp: string | null;
  loginAt: string | null;
  expiresAt: string | null;
  lastLogoutAt: string | null;
}

export interface UserSessionsPage {
  data: UserSession[];
  totalCount: number;
  totalActiveSessions: number;
  totalInactiveSessions: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface UserSessionsResponse {
  data: UserSessionsPage;
  message?: string;
  success?: boolean;
  statusCode?: number;
  count?: number;
}
