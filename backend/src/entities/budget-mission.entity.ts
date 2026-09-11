import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('budgets_missions')
export class BudgetMission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  clientId: number;

  @Column({ type: 'varchar', length: 10 })
  missionCode: string;

  @Column()
  annee: number;

  @Column({ type: 'float' })
  heuresBudget: number;

  @CreateDateColumn()
  createdAt: Date;
}
