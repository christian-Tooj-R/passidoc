import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn()
  role: string; // EXPERT_COMPTABLE | COLLABORATEUR

  @Column({ type: 'simple-json' })
  menuItems: string[]; // ex: ['dashboard','clients','tasks','documents','notes','equipes']

  @UpdateDateColumn()
  updatedAt: Date;
}
