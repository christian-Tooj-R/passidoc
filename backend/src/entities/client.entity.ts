import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToOne, OneToMany,
} from 'typeorm';
import { FicheIdentite } from './fiche-identite.entity';
import { FluxMensuel } from './flux-mensuel.entity';
import { Fournisseur } from './fournisseur.entity';
import { SyntheseCloture } from './synthese-cloture.entity';
import { Document } from './document.entity';
import { ConversationIA } from './conversation-ia.entity';

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
  santePassation: number; // Score de 0 à 100

  @Column({ default: true })
  isActive: boolean;

  @OneToOne(() => FicheIdentite, (fiche) => fiche.client, { cascade: true })
  ficheIdentite: FicheIdentite;

  @OneToMany(() => FluxMensuel, (flux) => flux.client, { cascade: true })
  fluxMensuels: FluxMensuel[];

  @OneToMany(() => Fournisseur, (f) => f.client, { cascade: true })
  fournisseurs: Fournisseur[];

  @OneToMany(() => SyntheseCloture, (s) => s.client, { cascade: true })
  synthesesCloture: SyntheseCloture[];

  @OneToMany(() => Document, (d) => d.client, { cascade: true })
  documents: Document[];

  @OneToMany(() => ConversationIA, (c) => c.client, { cascade: true })
  conversationsIA: ConversationIA[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
