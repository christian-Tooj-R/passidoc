import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToOne, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
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

export enum ClientSite {
  REUNION = 'REUNION',
  MADAGASCAR = 'MADAGASCAR',
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

  @Column({ default: 0 })
  santePassation: number;

  @Column({ default: true })
  isActive: boolean;

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

  @OneToOne(() => AnalyseStrategique, (a) => a.client, { cascade: true })
  analyseStrategique: AnalyseStrategique;

  @OneToMany(() => Mission, (m) => m.client, { cascade: true })
  missions: Mission[];

  @OneToOne(() => ObjectifsClient, (o) => o.client, { cascade: true })
  objectifs: ObjectifsClient;

  @OneToOne(() => ControleInterne, (c) => c.client, { cascade: true })
  controleInterne: ControleInterne;

  @OneToMany(() => Task, (t) => t.client, { cascade: true })
  tasks: Task[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
