import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { Client } from './client.entity';
import { Exercice } from './exercice.entity';

export type StatutOutilBp = 'BROUILLON' | 'VALIDE';

/**
 * Un outil stratégique du « Tableau de Bord BP » (SWOT, Porter, BMC, PESTEL, chaîne de valeur,
 * diagnostic interne, matrice de risques, persona/ICP, BCG) pour un dossier et un exercice.
 * Source : « Outils stratégiques PASSIDOC x Business Partner » (6 nov. 2026), partie 5.
 * Le contenu dépend de l'outil : voir `outils-bp.util.ts` (normaliserContenu).
 */
@Entity('outils_bp')
@Unique(['clientId', 'exerciceId', 'outil'])
export class OutilBp {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @ManyToOne(() => Exercice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciceId' })
  exercice: Exercice;

  @Column()
  exerciceId: number;

  @Column({ type: 'varchar', length: 20 })
  outil: string;

  @Column({ type: 'json' })
  contenu: Record<string, any>;

  /** Toute modification repasse l'outil en brouillon ; seuls les profils BP+ le valident. */
  @Column({ type: 'varchar', length: 12, default: 'BROUILLON' })
  statut: StatutOutilBp;

  @Column({ type: 'int', nullable: true })
  valideParId: number | null;

  @Column({ type: 'timestamp', nullable: true })
  valideLe: Date | null;

  /** « Validation et commentaires par le BP » (document, SWOT) : commentaire saisi en validant. */
  @Column({ type: 'text', nullable: true })
  commentaireValidation: string | null;

  @Column({ type: 'int', nullable: true })
  modifieParId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
