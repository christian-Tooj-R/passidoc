export type UserRole =
  | 'ADMIN'
  | 'EXPERT_COMPTABLE'
  | 'CHEF_ANTENNE'
  | 'CHEF_MISSION'
  | 'COLLABORATEUR'
  | 'GERANT_MADAGASCAR';

export type UserSite    = 'REUNION' | 'MADAGASCAR';
export type UserAntenne = 'EST' | 'OUEST';

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:             'Administrateur',
  EXPERT_COMPTABLE:  'Expert-comptable',
  CHEF_ANTENNE:      'Chef d\'antenne',
  CHEF_MISSION:      'Chef de mission',
  COLLABORATEUR:     'Collaborateur',
  GERANT_MADAGASCAR: 'Gérant Madagascar',
};

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  site: UserSite;
  antenne?: UserAntenne | null;
  referentId?: number | null;
  isTwoFactorEnabled: boolean;
  isActive: boolean;
  createdAt: string;
}
