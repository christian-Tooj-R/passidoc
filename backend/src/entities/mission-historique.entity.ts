import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Mission } from './mission.entity';

/** Historique des changements de statut d'une mission (R4 : date + auteur). */
@Entity('missions_historique')
export class MissionHistorique {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Mission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'missionId' })
  mission: Mission;

  @Column()
  missionId: number;

  /** Null à la création de la mission. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  ancienStatut: string | null;

  @Column({ type: 'varchar', length: 20 })
  nouveauStatut: string;

  @Column({ type: 'int', nullable: true })
  auteurId: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  auteurNom: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
