import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

export enum SiteName { REUNION = 'REUNION', MADAGASCAR = 'MADAGASCAR' }

@Entity('site_locations')
export class SiteLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: SiteName, unique: true })
  site: SiteName;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  /** Rayon autorisé en mètres (défaut 300 m) */
  @Column({ default: 300 })
  radiusMeters: number;

  @Column({ nullable: true })
  adresse: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
