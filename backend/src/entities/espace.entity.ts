import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { EspaceDoc } from './espace-doc.entity';

@Entity('espaces')
export class Espace {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nom: string;

  @Column()
  userId: number;

  @Column({ nullable: true, type: 'text' })
  couleur: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => EspaceDoc, d => d.espace, { cascade: true })
  documents: EspaceDoc[];

  @CreateDateColumn()
  createdAt: Date;
}
