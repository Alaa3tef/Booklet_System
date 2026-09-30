export type UserRoleKey =
  | 'admin'
  | 'it'
  | 'planning'
  | 'printing'
  | 'quality'
  | 'packing'
  | 'archiving';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  roleKey: UserRoleKey;
  phone?: string;
  avatarInitials: string;
  avatarTone: string;
  token?: string;
  lastLogin?: string;
}

export interface LoginCredentials {
  identifier: string; // username or email
  password: string;
  rememberMe: boolean;
}

/** Payload sent to POST /api/Account/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** User object nested inside the login API response */
export interface LoginApiUser {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
}

/** Full response from POST /api/Account/login */
export interface LoginApiResponse {
  success: boolean;
  statusCode: number;
  message: string;
  count: number;
  data: {
    accessToken: string;
    user: LoginApiUser;
  };
}

export interface ForgotPasswordRequest {
  identifier: string; // email or username
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface DemoAccount {
  label: string;
  role: string;
  roleKey: UserRoleKey;
  username: string;
  email: string;
  fullName: string;
  icon: string;
  color: string;
}
