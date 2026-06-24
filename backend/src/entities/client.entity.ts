import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToOne, OneToMany, ManyToOne, JoinColumn, AfterLoad,
} from 'typeorm';
import { TypeFlux } from './flux-mensuel.entity';
import { User } from './user.entity';
import { FicheIdentite } from './fiche-identite.entity';
import { FluxMensuel } from './flux-mensuel.entity';
import { Fournisseur } from './fournisseur.entity';
import { SyntheseCloture } from './synthese-cloture.entity';
import { Document } from './document.entity';
import { ConversationIA } from './conversation-ia.entity';
import { AnalyseStrategique } from './analyse-strategique.entity';
import { Mission } from './mission.entity';
import { ObjectifsClient } from './objectifs-client.entity';
import { ControleInterne } from './controle-interne.entity';
import { Task } from './task.entity';
import { QuestionnaireAdnGlobal } from './questionnaire-adn-global.entity';
import { QuestionnaireAdnSectoriel } from './questionnaire-adn-sectoriel.entity';
import { Exercice } from './exercice.entity';

export enum ClientSite {
  REUNION = 'REUNION',
  MADAGASCAR = 'MADAGASCAR',
}

/** @deprecated — les codes secteur sont désormais stockés dans la table `secteurs` */
export enum SecteurActivite {
  RESTAURATION = 'RESTAURATION',
  BTP = 'BTP',
  ASSOCIATION = 'ASSOCIATION',
  HOLDING = 'HOLDING',
  PROFESSION_LIBERALE = 'PROFESSION_LIBERALE',
  SCI = 'SCI',
}

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nom: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ type: 'enum', enum: ClientSite })
  site: ClientSite;

  @Column({ nullable: true })
  secteurActivite: string;

  santePassation: number = 0;
  completude: number = 0;

  @AfterLoad()
  computeSantePassation() {
    let score = 0;
    const fiche = (this as any).ficheIdentite;
    if (fiche?.raisonSociale) score += 10;
    if (fiche?.siren) score += 5;
    if (fiche?.gerants?.length > 0) score += 10;
    if (fiche?.salaries?.length > 0) score += 5;
    if (fiche?.emailContact || fiche?.telephoneContact) score += 5;
    if ((this as any).fluxMensuels?.length > 0) score += 10;
    if ((this as any).fournisseurs?.length > 0) score += 10;
    if ((this as any).synthesesCloture?.length > 0) score += 15;
    if ((this as any).documents?.length > 0) score += 5;
    const lastStrategie = (this as any).analysesStrategiques?.[0];
    if (lastStrategie?.forces?.length > 0) score += 10;
    if ((this as any).missions?.length > 0) score += 10;
    const lastControle = (this as any).controlesInternes?.[0];
    if (lastControle?.noteGenerale || lastControle?.processOk?.length > 0) score += 5;
    this.santePassation = Math.min(score, 100);
  }

  @AfterLoad()
  computeCompletude() {
    let score = 0;
    const fiche = (this as any).ficheIdentite;

    // Fiche identité — 20 pts
    if (fiche?.raisonSociale) score += 5;
    if (fiche?.siren)         score += 5;
    if (fiche?.gerants?.length > 0) score += 5;
    if (fiche?.emailContact || fiche?.telephoneContact) score += 5;

    // ADN Global — 25 pts
    const adn = (this as any).questionnaireAdnGlobal;
    if (adn?.mission)           score += 5;
    if (adn?.visionActivite)    score += 5;
    if (adn?.valeurCle)         score += 5;
    if (adn?.niveauNumerique != null) score += 5;
    if (adn?.principalConcurrent)    score += 5;

    // ADN Sectoriel — 20 pts
    const adnS = (this as any).questionnaireAdnSectoriel;
    if (adnS) {
      const skip = new Set(['id', 'clientId', 'createdAt', 'updatedAt']);
      const filled = Object.entries(adnS).filter(([k, v]) =>
        !skip.has(k) && v != null && v !== '' && !(Array.isArray(v) && (v as any[]).length === 0)
      ).length;
      if (filled >= 5) score += 20;
      else if (filled >= 2) score += 10;
    }

    // Missions actives — 15 pts
    const missions: any[] = (this as any).missions ?? [];
    if (missions.some(m => m.statut !== 'TERMINEE')) score += 15;

    // Flux mensuels ≥ 3 — 10 pts
    if (((this as any).fluxMensuels ?? []).length >= 3) score += 10;

    // Objectifs définis — 10 pts
    const obj = (this as any).objectifs;
    if (obj?.objectifs?.length > 0 || obj?.ca || obj?.resultat) score += 10;

    this.completude = Math.min(score, 100);
  }

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'simple-json', nullable: true })
  typesFluxActifs: TypeFlux[];

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'responsableId' })
  responsable: User;

  @Column({ nullable: true })
  responsableId: number;

  // Collaborateur Madagascar qui traite ce dossier (sous-assignation du portefeuille Réunion)
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'collaborateurMgId' })
  collaborateurMg: User;

  @Column({ nullable: true })
  collaborateurMgId: number;

  @OneToOne(() => FicheIdentite, (f) => f.client, { cascade: true })
  ficheIdentite: FicheIdentite;

  @OneToMany(() => FluxMensuel, (f) => f.client, { cascade: true })
  fluxMensuels: FluxMensuel[];

  @OneToMany(() => Fournisseur, (f) => f.client, { cascade: true })
  fournisseurs: Fournisseur[];

  @OneToMany(() => SyntheseCloture, (s) => s.client, { cascade: true })
  synthesesCloture: SyntheseCloture[];

  @OneToMany(() => Document, (d) => d.client, { cascade: true })
  documents: Document[];

  @OneToMany(() => ConversationIA, (c) => c.client, { cascade: true })
  conversationsIA: ConversationIA[];

  @OneToMany(() => AnalyseStrategique, (a: any) => a.client)
  analysesStrategiques: AnalyseStrategique[];

  @OneToMany(() => Mission, (m) => m.client, { cascade: true })
  missions: Mission[];

  @OneToMany(() => ObjectifsClient, (o: any) => o.client)
  objectifsItems: ObjectifsClient[];

  @OneToMany(() => ControleInterne, (c: any) => c.client)
  controlesInternes: ControleInterne[];

  @OneToMany(() => Task, (t) => t.client, { cascade: true })
  tasks: Task[];

  @OneToOne(() => QuestionnaireAdnGlobal, (q) => q.client, { cascade: true })
  questionnaireAdnGlobal: QuestionnaireAdnGlobal;

  @OneToOne(() => QuestionnaireAdnSectoriel, (q) => q.client, { cascade: true })
  questionnaireAdnSectoriel: QuestionnaireAdnSectoriel;

  @Column({ nullable: true, length: 5 })
  dateClotureExercice: string; // Format "MM-DD", ex: "12-31"

  @OneToMany(() => Exercice, (e) => e.client)
  exercices: Exercice[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
