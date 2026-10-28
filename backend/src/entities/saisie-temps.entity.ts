import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Client } from './client.entity';

export enum TypeTemps {
  FACTURABLE = 'FACTURABLE',
  NON_FACTURABLE = 'NON_FACTURABLE',
}

export enum CategorieNonFacturable {
  APPEL_CLIENT = 'APPEL_CLIENT',
  REUNION_INTERNE = 'REUNION_INTERNE',
  FORMATION = 'FORMATION',
  ADMINISTRATIF = 'ADMINISTRATIF',
  AUTRE = 'AUTRE',
}

export enum MissionCode {
  TCO  = 'TCO',
  REV  = 'REV',
  FISC = 'FISC',
  SOC  = 'SOC',
  JUR  = 'JUR',
  CON  = 'CON',
  FORM = 'FORM',
  ADM  = 'ADM',
}

@Entity('saisies_temps')
export class SaisieTemps {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'float' })
  dureeHeures: number;

  @Column({ type: 'enum', enum: TypeTemps })
  type: TypeTemps;

  @Column({ type: 'enum', enum: CategorieNonFacturable, nullable: true })
  categorie: CategorieNonFacturable;

  @Column({ type: 'varchar', length: 10, nullable: true })
  missionCode: string;

  @Column({ nullable: true })
  dossierId: number;

  @Column({ type: 'text', nullable: true })
  commentaire: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  heureDebut: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  heureFin: string;

  /** Affaire = exercice comptable du dossier, au format Tempolia « C2026-09 » (exercice clos
   *  en 09/2026). Attribuée automatiquement à la création (cf. saisie-temps/affaire.util.ts),
   *  puis modifiable — figée ensuite pour que la clôture d'un exercice ne déplace pas
   *  rétroactivement les temps d'une affaire à l'autre. Null si la saisie n'a pas de client. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  affaire: string | null;

  /** Prix de vente horaire du collaborateur FIGÉ au moment de la saisie (valorisation
   *  « PV Col ») — un changement de tarif ultérieur ne revalorise pas l'historique. */
  @Column({ type: 'float', nullable: true })
  tauxHoraire: number | null;

  /** Pôle de travail (cahier v2 #5) : EST | OUEST | HORS_BUREAU — défaut = site du collaborateur. */
  @Column({ type: 'varchar', length: 12, nullable: true })
  lieuTravail: string | null;

  /** Tâche dont provient ce temps (minuteur de la tâche ou saisie automatique à sa fin) — sert
   *  à ne pas saisir deux fois le même temps chronométré. Sans contrainte : la saisie survit à
   *  la suppression de la tâche. */
  @Column({ type: 'int', nullable: true })
  taskId: number | null;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lockedBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collaborateurId' })
  collaborateur: User;

  @Column()
  collaborateurId: number;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ nullable: true })
  clientId: number;

  @Column({ nullable: true })
  tenantId: number;

  @CreateDateColumn()
  createdAt: Date;
}
