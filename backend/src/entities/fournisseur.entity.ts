import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, CreateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('fournisseurs')
export class Fournisseur {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nom: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  telephone: string;

  @Column({ nullable: true })
  categorie: string;

  @ManyToOne(() => Client, (client) => client.fournisseurs)
  client: Client;

  @CreateDateColumn()
  createdAt: Date;
}
