import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne,
} from 'typeorm';
import { Client } from './client.entity';
import { User } from './user.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('conversations_ia')
export class ConversationIA {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: MessageRole })
  role: MessageRole;

  @Column({ type: 'text' })
  contenu: string;

  @ManyToOne(() => Client, (client) => client.conversationsIA)
  client: Client;

  @ManyToOne(() => User)
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
