import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TacheRecurrente, FrequenceTache } from '../entities/tache-recurrente.entity';
import { Task, TaskStatut, TaskPriorite } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { CreateTacheRecurrenteDto, UpdateTacheRecurrenteDto } from './dto/create-tache-recurrente.dto';

@Injectable()
export class TacheRecurrenteService {
  constructor(
    @InjectRepository(TacheRecurrente) private repo: Repository<TacheRecurrente>,
    @InjectRepository(Task) private taskRepo: Repository<Task>,
  ) {}

  async create(dto: CreateTacheRecurrenteDto, user: User): Promise<TacheRecurrente> {
    const t = this.repo.create({
      ...dto,
      delaiAvantEcheanceJours: dto.delaiAvantEcheanceJours ?? 7,
      tenantId: user.tenantId,
    });
    return this.repo.save(t);
  }

  findByClient(clientId: number): Promise<TacheRecurrente[]> {
    return this.repo.find({
      where: { clientId, isActive: true },
      relations: ['assigneA'],
      order: { createdAt: 'DESC' },
    });
  }

  findByTenant(tenantId: number): Promise<TacheRecurrente[]> {
    return this.repo.find({
      where: { tenantId },
      relations: ['client', 'assigneA'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: number, dto: UpdateTacheRecurrenteDto): Promise<TacheRecurrente> {
    await this.repo.update(id, dto as any);
    const result = await this.repo.findOne({ where: { id }, relations: ['assigneA'] });
    if (!result) throw new Error(`TacheRecurrente ${id} not found`);
    return result;
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  async genererTachesEcheances(tenantId?: number, force = false): Promise<number> {
    const where: any = { isActive: true };
    if (tenantId) where.tenantId = tenantId;

    const recurrentes = await this.repo.find({ where, relations: ['client'] });
    let created = 0;

    for (const tr of recurrentes) {
      // En mode force (déclenchement manuel), utiliser la période courante si la prochaine n'est pas encore due
      const echeance = force
        ? this.calculerEcheanceCourante(tr.frequence)
        : this.calculerProchaineEcheance(tr.frequence);
      const echeanceStr = echeance.toISOString().split('T')[0];
      const dateCreation = this.soustraireJours(echeance, tr.delaiAvantEcheanceJours);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!force && dateCreation > today) continue;

      // Vérifier si la tâche n'existe pas déjà pour cette période
      const existe = await this.taskRepo.findOne({
        where: {
          clientId: tr.clientId,
          dateEcheance: echeanceStr,
          estRecurrente: true,
          titre: `[REC] ${tr.titre}`,
        },
      });
      if (existe) continue;

      const task = this.taskRepo.create({
        titre: `[REC] ${tr.titre}`,
        description: tr.description,
        statut: TaskStatut.A_FAIRE,
        priorite: TaskPriorite.NORMALE,
        dateEcheance: echeanceStr,
        clientId: tr.clientId,
        assigneeId: tr.assigneAId ?? null,
        tenantId: tr.tenantId,
        estRecurrente: true,
        serviceDestinataire: tr.serviceDestinataire ?? null,
      });
      await this.taskRepo.save(task);
      created++;
    }

    return created;
  }

  // Prochaine échéance (cron automatique) — toujours dans le futur
  private calculerProchaineEcheance(frequence: FrequenceTache): Date {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (frequence) {
      case FrequenceTache.MENSUELLE:
        d.setMonth(d.getMonth() + 1);
        break;
      case FrequenceTache.TRIMESTRIELLE: {
        const trimestre = Math.floor(now.getMonth() / 3);
        d.setMonth((trimestre + 1) * 3);
        break;
      }
      case FrequenceTache.SEMESTRIELLE: {
        const semestre = Math.floor(now.getMonth() / 6);
        d.setMonth((semestre + 1) * 6);
        break;
      }
      case FrequenceTache.ANNUELLE:
        d.setFullYear(d.getFullYear() + 1, 0, 1);
        break;
    }
    return d;
  }

  // Échéance de la période COURANTE (mode force / déclenchement manuel)
  private calculerEcheanceCourante(frequence: FrequenceTache): Date {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (frequence) {
      case FrequenceTache.MENSUELLE:
        // Fin du mois courant = 1er du mois suivant
        d.setMonth(d.getMonth() + 1);
        break;
      case FrequenceTache.TRIMESTRIELLE: {
        const trimestre = Math.floor(now.getMonth() / 3);
        d.setMonth((trimestre + 1) * 3);
        break;
      }
      case FrequenceTache.SEMESTRIELLE: {
        const semestre = Math.floor(now.getMonth() / 6);
        d.setMonth((semestre + 1) * 6);
        break;
      }
      case FrequenceTache.ANNUELLE:
        d.setFullYear(d.getFullYear() + 1, 0, 1);
        break;
    }
    return d;
  }

  private soustraireJours(date: Date, jours: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - jours);
    return d;
  }
}
