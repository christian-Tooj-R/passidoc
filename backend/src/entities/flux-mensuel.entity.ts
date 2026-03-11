import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne,
} from 'typeorm';
import { Client } from './client.entity';

export enum TypeFlux {
  RELEVE_BANCAIRE = 'RELEVE_BANCAIRE',
  RAPPORT_VENTE = 'RAPPORT_VENTE',
  RAPPORT_REGLEMENT = 'RAPPORT_REGLEMENT',
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
  commentaire: string;

  @ManyToOne(() => Client, (client) => client.fluxMensuels)
  client: Client;

  @CreateDateColumn()
  createdAt: Date;
}
