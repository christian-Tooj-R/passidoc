import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('questionnaires_adn_sectoriel')
export class QuestionnaireAdnSectoriel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  secteur: string; // RESTAURATION | BTP | ASSOCIATION | HOLDING | PROFESSION_LIBERALE | SCI

  @Column({ type: 'json', nullable: true })
  reponses: Record<string, any>;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;
}
