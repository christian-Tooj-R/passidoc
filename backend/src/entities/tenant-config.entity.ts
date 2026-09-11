import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenant_config')
export class TenantConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  slug: string;

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

  @Column({ default: 'Pôle EST' })
  poleLabel1: string;

  @Column({ default: 'Pôle OUEST' })
  poleLabel2: string;

  @Column({ default: '🔵', nullable: true })
  poleFlag1: string;

  @Column({ default: '🟠', nullable: true })
  poleFlag2: string;

  @Column({ nullable: true })
  couleurPrimaire: string;

  @Column({ default: false })
  isConfigured: boolean;

  /* ── Mentions légales employeur (bulletin de salaire — module Paie RH interne) ──────
   * Ajoutées pour la refonte ~Sage du bulletin de salaire (voir
   * Doc/MODULE_PAIE_RH_NOTES.md, section "Refonte du bulletin de salaire (~Sage)").
   * Nullable / vides par défaut : AUCUNE valeur n'est inventée pour AFYM — c'est à la
   * direction/l'administrateur de les renseigner (PATCH /tenant/config, déjà générique —
   * `dto: any` — donc aucun changement de contrôleur n'est nécessaire). Tant qu'un champ
   * est vide, le PDF du bulletin affiche "à renseigner" plutôt qu'un blanc silencieux. */

  /** Adresse postale complète de l'établissement (affichée en en-tête du bulletin). */
  @Column({ type: 'varchar', nullable: true })
  adresse: string | null;

  /** Téléphone de contact de l'établissement. */
  @Column({ type: 'varchar', nullable: true })
  telephone: string | null;

  /**
   * Numéro d'immatriculation employeur à l'organisme de protection sociale — équivalent
   * générique du "N° Cnaps" (Madagascar) / organisme équivalent (Réunion) : l'organisme
   * diffère selon le régime, ce champ est volontairement neutre et paramétrable plutôt
   * que de coder en dur un nom d'organisme propre à un seul pays.
   */
  @Column({ type: 'varchar', nullable: true })
  numeroImmatriculationEmployeur: string | null;

  /** Numéro de registre du commerce et des sociétés (RCS / équivalent local). */
  @Column({ type: 'varchar', nullable: true })
  numeroRegistreCommerce: string | null;

  /** Numéro d'identifiant fiscal (NIF / équivalent local). */
  @Column({ type: 'varchar', nullable: true })
  numeroIdentifiantFiscal: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
