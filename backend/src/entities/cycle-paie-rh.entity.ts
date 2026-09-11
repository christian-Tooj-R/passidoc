import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

/**
 * Statuts simplifiés du cycle mensuel de paie interne AFYM par rapport au CDC (§10, 10
 * étapes OUVERT→ARCHIVÉE) : OUVERT couvre OUVERT+PRÉPARATION, CALCULE couvre
 * CALCULÉE+CONTRÔLÉE, PAYABLE/PAYÉE/DÉCLARÉE ne sont pas des statuts de cycle distincts en
 * v1 (le paiement/la déclaration sont enregistrés au niveau du bulletin — voir
 * BulletinSalarie.datePaiement / le module déclarations V1). CLOTURE verrouille la
 * période : plus aucune mutation de contrat/variable/bulletin n'est possible pour ce
 * mois/année (immutabilité — CDC §1 "Une paie clôturée devient immuable").
 */
export enum StatutCyclePaieRh {
  OUVERT = 'OUVERT',
  CALCULE = 'CALCULE',
  VALIDE = 'VALIDE',
  CLOTURE = 'CLOTURE',
}

/**
 * Cycle mensuel de paie interne AFYM — un salarié à traiter, un statut, une clôture.
 * Distinct de tout cycle du module paie clients (qui n'a pas de notion de cycle mensuel
 * global, chaque bulletin y étant généré indépendamment).
 */
@Entity('paie_rh_cycles')
@Unique(['tenantId', 'mois', 'annee'])
export class CyclePaieRh {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @Column({ type: 'int' })
  mois: number;

  @Column({ type: 'int' })
  annee: number;

  @Column({ type: 'enum', enum: StatutCyclePaieRh, default: StatutCyclePaieRh.OUVERT })
  statut: StatutCyclePaieRh;

  @Column({ type: 'int', default: 0 })
  nbSalaries: number;

  @Column({ type: 'int', default: 0 })
  nbBulletinsGeneres: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalBrut: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalNetAPayer: number;

  @Column({ type: 'int', nullable: true })
  valideParId: number | null;

  @Column({ type: 'timestamp', nullable: true })
  dateCalcul: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  dateValidation: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  dateCloture: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
