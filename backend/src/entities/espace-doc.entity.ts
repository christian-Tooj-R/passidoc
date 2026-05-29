import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Espace } from './espace.entity';

@Entity('espace_docs')
export class EspaceDoc {
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

  @Column()
  espaceId: number;

  @ManyToOne(() => Espace, e => e.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'espaceId' })
  espace: Espace;

  @Column({ nullable: true })
  uploadeParId: number;

  @CreateDateColumn()
  createdAt: Date;
}
