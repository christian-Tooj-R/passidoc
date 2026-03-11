export type UserRole = 'ADMIN' | 'EXPERT_COMPTABLE' | 'COLLABORATEUR';
export type UserSite = 'REUNION' | 'MADAGASCAR';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  site: UserSite;
  isTwoFactorEnabled: boolean;
  isActive: boolean;
  createdAt: string;
}
