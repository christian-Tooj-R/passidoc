import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, Unique,
} from 'typeorm';

@Entity('balance_mensuelle')
@Unique(['clientId', 'annee', 'mois'])
export class BalanceMensuelle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clientId: number;

  @Column({ nullable: true })
  tenantId: number;

  @Column()
  annee: number;

  @Column()
  mois: number; // 1-12

  // Attendu depuis FEC (comptes 401 = fournisseurs, 411 = clients, 471 = attentes)
  @Column({ default: 0 })
  nbFournisseursAttendu: number;

  @Column({ default: 0 })
  nbClientsAttendu: number;

  @Column({ default: 0 })
  nbAttentesAttendu: number;

  // Reçu (saisi manuellement ou mis à jour par le collaborateur)
  @Column({ default: 0 })
  nbFournisseursRecu: number;

  @Column({ default: 0 })
  nbClientsRecu: number;

  @Column({ default: 0 })
  nbAttentesRecu: number;

  @Column({ type: 'text', nullable: true })
  analyseIA: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
