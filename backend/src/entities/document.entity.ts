import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne,
} from 'typeorm';
import { Client } from './client.entity';
import { User } from './user.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nom: string;

  @Column()
  storagePath: string; // Chemin MinIO

  @Column()
  mimeType: string;

  @Column()
  taille: number; // en bytes

  @Column({ default: false })
  isChiffre: boolean;

  @ManyToOne(() => Client, (client) => client.documents)
  client: Client;

  @ManyToOne(() => User)
  uploadePar: User;

  @CreateDateColumn()
  createdAt: Date;
}
