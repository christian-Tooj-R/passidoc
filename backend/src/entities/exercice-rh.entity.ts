import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

export enum StatutExerciceRh {
  OUVERT = 'OUVERT',
  CLOTURE = 'CLOTURE',
}

/**
 * Exercice RH ANNUEL de l'entreprise elle-même (AFYM en tant qu'employeur) — gouverne le
 * module RH interne (cycles de paie mensuels, activité). Un seul exercice peut être OUVERT
 * par tenant à la fois (règle reprise de l'ancien logiciel RADIAN/URA : "un seul exercice
 * ouvert", "deux exercices ne peuvent pas être ouverts en même temps").
 *
 * ⚠️ À NE PAS CONFONDRE avec `Exercice` (entities/exercice.entity.ts), qui est l'exercice
 * COMPTABLE d'un DOSSIER CLIENT (mission d'audit, un par client/année) — notion totalement
 * différente, non liée à celle-ci. Voir Doc/MODULE_PAIE_RH_NOTES.md.
 */
@Entity('exercices_rh')
@Unique(['tenantId', 'annee'])
export class ExerciceRh {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @Column({ type: 'int' })
  annee: number;

  @Column({ type: 'date' })
  dateDebut: string;

  @Column({ type: 'date' })
  dateFin: string;

  @Column({ type: 'enum', enum: StatutExerciceRh, default: StatutExerciceRh.OUVERT })
  statut: StatutExerciceRh;

  @Column({ type: 'timestamp', nullable: true })
  dateOuverture: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  dateCloture: Date | null;

  @Column({ type: 'int', nullable: true })
  ouvertParId: number | null;

  @Column({ type: 'int', nullable: true })
  clotureParId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
