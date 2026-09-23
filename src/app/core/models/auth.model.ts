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
