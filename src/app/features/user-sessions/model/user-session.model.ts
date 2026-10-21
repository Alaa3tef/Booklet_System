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

export interface UserSessionsResponse {
  data: UserSession[];
  message?: string;
  success?: boolean;
}
