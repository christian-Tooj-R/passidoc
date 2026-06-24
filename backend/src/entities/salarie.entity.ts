import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('salaries_dossier')
export class Salarie {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @Column()
  nom: string;

  @Column()
  prenom: string;

  @Column({ type: 'date', nullable: true })
  dateEntree: string | null;

  @Column({ type: 'date', nullable: true })
  dateSortie: string | null;

  @Column({ nullable: true })
  poste: string;

  @Column({ nullable: true })
  typeContrat: string; // CDI, CDD, Apprentissage, Stage…

  /** Champ extensible pour toute donnée future */
  @Column({ type: 'json', nullable: true })
  meta: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
