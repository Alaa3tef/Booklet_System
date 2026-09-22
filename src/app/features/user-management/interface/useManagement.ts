export interface AppUser {
  id: number;
  username: string;
  email: string;
  role: string;
  roleKey: string;
  phone?: string;
  status?: 'active' | 'inactive';
  createdAt: string;
  avatarInitials: string;
  avatarTone: string;
}
