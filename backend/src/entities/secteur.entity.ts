import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export interface SecteurQuestion {
  id: string;
  section?: string;
  label: string;
  type: 'radio' | 'multiselect' | 'text' | 'textarea' | 'number';
  required?: boolean;
  options?: { value: string; label: string; icon?: string }[];
  placeholder?: string;
  hint?: string;
}

@Entity('secteurs')
export class Secteur {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  label: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  codeNaf: string;

  @Column({ nullable: true, type: 'text' })
  codeNafLibelle: string;

  @Column({ type: 'json', nullable: true })
  questions: SecteurQuestion[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
