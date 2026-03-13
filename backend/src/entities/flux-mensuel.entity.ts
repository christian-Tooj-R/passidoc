import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne,
} from 'typeorm';
import { Client } from './client.entity';

export enum TypeFlux {
  RELEVE_BANCAIRE   = 'RELEVE_BANCAIRE',
  TVA_MENSUELLE     = 'TVA_MENSUELLE',
  TVA_TRIMESTRIELLE = 'TVA_TRIMESTRIELLE',
  TVA_ANNUELLE      = 'TVA_ANNUELLE',
  PAIE              = 'PAIE',
  RAPPORT_VENTE     = 'RAPPORT_VENTE',
  RECETTE_AMENITIZ  = 'RECETTE_AMENITIZ',
  PIECES_COMPTABLES = 'PIECES_COMPTABLES',
}

export enum StatutDepot {
  DEPOSE = 'DEPOSE',
  MANQUANT = 'MANQUANT',
  EN_RETARD = 'EN_RETARD',
}

@Entity('flux_mensuels')
export class FluxMensuel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: TypeFlux })
  type: TypeFlux;

  @Column()
  mois: number; // 1-12

  @Column()
  annee: number;

  @Column({ type: 'enum', enum: StatutDepot, default: StatutDepot.MANQUANT })
  statut: StatutDepot;

  @Column({ nullable: true })
  dateDepot: Date;

  @Column({ nullable: true })
  dateRelance: Date; // dernière relance client

  @Column({ nullable: true, type: 'text' })
  commentaire: string;

  @ManyToOne(() => Client, (client) => client.fluxMensuels)
  client: Client;

  @CreateDateColumn()
  createdAt: Date;
}
