import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenant_config')
export class TenantConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nomSociete: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  slogan: string;

  @Column({ nullable: true })
  ville: string;

  @Column({ nullable: true })
  pays: string;

  @Column({ default: 'La Réunion' })
  poleLabel1: string;

  @Column({ default: 'Madagascar' })
  poleLabel2: string;

  @Column({ nullable: true })
  couleurPrimaire: string;

  @Column({ default: false })
  isConfigured: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
