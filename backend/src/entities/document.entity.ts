import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne,
} from 'typeorm';
import { Client } from './client.entity';
import { User } from './user.entity';

export type TypeDoc =
  | 'FACTURE_ACHAT'
  | 'FACTURE_VENTE'
  | 'RELEVE_BANCAIRE'
  | 'TVA_MENSUELLE'
  | 'TVA_TRIMESTRIELLE'
  | 'TVA_ANNUELLE'
  | 'PAIE'
  | 'RAPPORT_VENTE'
  | 'RECETTE_AMENITIZ'
  | 'PIECES_COMPTABLES'
  | 'AUTRE';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nom: string;

  @Column()
  storagePath: string;

  @Column()
  mimeType: string;

  @Column()
  taille: number;

  @Column({ default: false })
  isChiffre: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  typeDoc: TypeDoc | null;

  @Column({ type: 'int', nullable: true, default: null })
  periodeMois: number | null; // 1-12

  @Column({ type: 'int', nullable: true, default: null })
  periodeAnnee: number | null;

  @ManyToOne(() => Client, (client) => client.documents)
  client: Client;

  @ManyToOne(() => User)
  uploadePar: User;

  @CreateDateColumn()
  createdAt: Date;
}
