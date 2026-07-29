import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatut } from '../entities/task.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksScheduler {
  private readonly logger = new Logger(TasksScheduler.name);

  constructor(
    @InjectRepository(Task) private repo: Repository<Task>,
    private notifications: NotificationsService,
  ) {}

  // ── Notification J-1 avant échéance ────────────────────────────────────────
  @Cron('0 8 * * *')
  async notifierEcheancesProches(): Promise<number> {
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    const dateStr = `${demain.getFullYear()}-${String(demain.getMonth() + 1).padStart(2, '0')}-${String(demain.getDate()).padStart(2, '0')}`;

    const taches = await this.repo.createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('task.dateEcheance = :date', { date: dateStr })
      .andWhere('task.statut != :done', { done: TaskStatut.TERMINEE })
      .andWhere('task.assigneeId IS NOT NULL')
      .getMany();

    for (const t of taches) {
      await this.notifications.emit(t.assigneeId!, {
        type: 'TASK_DEADLINE',
        message: `Échéance demain : "${t.titre}"`,
        titre: t.titre,
        clientId: t.clientId,
        taskId: t.id,
      });
    }
    this.logger.log(`[J-1] ${taches.length} notification(s) envoyée(s) pour le ${dateStr}`);
    return taches.length;
  }

  // ── Report automatique des tâches en retard (chaque lundi à 7h) ────────────
  @Cron('0 7 * * 1')
  async reporterTachesEnRetard(): Promise<number> {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const retard = await this.repo.createQueryBuilder('task')
      .where('task.dateEcheance < :today', { today: todayStr })
      .andWhere('task.statut NOT IN (:...done)', { done: [TaskStatut.TERMINEE] })
      .andWhere('task.dateEcheance IS NOT NULL')
      .andWhere('task.annee IS NULL')
      .getMany();

    const lundiProchain = new Date(today);
    lundiProchain.setDate(today.getDate() + 7);
    const nouvelleDate = `${lundiProchain.getFullYear()}-${String(lundiProchain.getMonth() + 1).padStart(2, '0')}-${String(lundiProchain.getDate()).padStart(2, '0')}`;

    for (const t of retard) {
      await this.repo.update(t.id, { dateEcheance: nouvelleDate });
    }
    this.logger.log(`[Report] ${retard.length} tâche(s) reportée(s) au ${nouvelleDate}`);
    return retard.length;
  }

  // ── Création automatique des tâches récurrentes (1er du mois à 6h) ────────
  @Cron('0 6 1 * *')
  async creerTachesRecurrentes(): Promise<number> {
    const today = new Date();
    const moisActuel = today.getMonth() + 1;
    const anneeActuelle = today.getFullYear();

    const modeles = await this.repo.createQueryBuilder('task')
      .where('task.recurrenceType IS NOT NULL')
      .andWhere('task.annee IS NULL')
      .getMany();

    let crees = 0;
    for (const modele of modeles) {
      // Vérifier si la tâche de ce mois n'existe pas déjà
      const existe = await this.repo.createQueryBuilder('task')
        .where('task.titre = :titre', { titre: modele.titre })
        .andWhere('task.clientId = :clientId', { clientId: modele.clientId })
        .andWhere('task.mois = :mois', { mois: moisActuel })
        .andWhere('task.annee = :annee', { annee: anneeActuelle })
        .getOne();

      if (existe) continue;

      const jour = modele.recurrenceJour ?? 20;
      const jourPadded = String(Math.min(jour, 28)).padStart(2, '0');
      const dateEcheance = `${anneeActuelle}-${String(moisActuel).padStart(2, '0')}-${jourPadded}`;

      await this.repo.save(this.repo.create({
        titre: modele.titre,
        description: modele.description,
        type: modele.type,
        priorite: modele.priorite,
        clientId: modele.clientId,
        assigneeId: modele.assigneeId || undefined,
        anyoneCanTake: modele.anyoneCanTake,
        dateEcheance,
        mois: moisActuel,
        annee: anneeActuelle,
      }));
      crees++;
    }
    this.logger.log(`[Récurrence] ${crees} tâche(s) créée(s) pour ${moisActuel}/${anneeActuelle}`);
    return crees;
  }
}
