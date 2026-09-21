export interface AppUser {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  roleKey: string;
  status: 'active' | 'inactive';
  createdAt: string;
  avatarInitials: string;
  avatarTone: string;
}
