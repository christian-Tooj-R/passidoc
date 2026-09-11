import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { EmployeClient } from './employe-client.entity';

export interface LigneBulletin {
  code: string;
  libelle: string;
  imputation: string;
  base: number;
  tauxSalarial: number | null;
  montantSalarial: number;
  tauxPatronal: number | null;
  montantPatronal: number;
}

/**
 * Bulletin de paie généré et figé pour un employé client, pour un mois/année donné.
 * `detailRubriques` est un SNAPSHOT des lignes calculées au moment de la génération :
 * si les rubriques/paramètres sont modifiés plus tard, les bulletins déjà générés ne
 * changent pas rétroactivement (traçabilité).
 */
@Entity('paie_bulletins')
export class BulletinPaie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @ManyToOne(() => EmployeClient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'employeClientId' })
  employeClient: EmployeClient;

  @Column()
  employeClientId: number;

  @Column({ type: 'int', nullable: true })
  variablePaieId: number | null;

  @Column({ type: 'int' })
  mois: number;

  @Column({ type: 'int' })
  annee: number;

  @Column({ nullable: true })
  regimePaieCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  salaireBase: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalBrut: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalCotisationsSalariales: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalCotisationsPatronales: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  netImposable: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  netAPayer: number;

  @Column({ type: 'json' })
  detailRubriques: LigneBulletin[];

  @CreateDateColumn()
  dateGeneration: Date;
}
