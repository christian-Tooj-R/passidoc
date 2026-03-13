import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatut } from '../entities/task.entity';
import { User, UserRole, UserSite } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private repo: Repository<Task>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notifications: NotificationsService,
  ) {}

  private async canAssignTo(assigner: User, assigneeId: number): Promise<boolean> {
    if (assigner.role === UserRole.ADMIN) return true;
    if (assigner.site === UserSite.REUNION) {
      const assignee = await this.userRepo.findOne({ where: { id: assigneeId } });
      return assignee?.site === UserSite.MADAGASCAR || assigneeId === assigner.id;
    }
    return assigneeId === assigner.id;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  findMesTaches(userId: number) {
    return this.repo.createQueryBuilder('task')
      .leftJoinAndSelect('task.client', 'client')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('task.assigneeId = :userId', { userId })
      .andWhere('task.annee IS NULL')
      .andWhere('task.statut NOT IN (:...done)', { done: ['TERMINEE', 'NON_FAIT'] })
      .orderBy('task.createdAt', 'DESC')
      .getMany();
  }

  findAllByClient(clientId: number) {
    return this.repo.createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('task.clientId = :clientId', { clientId })
      .andWhere('task.annee IS NULL')
      .orderBy('task.createdAt', 'DESC')
      .getMany();
  }

  findAll(currentUser: User) {
    const qb = this.repo.createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('task.client', 'client')
      .where('task.annee IS NULL')
      .orderBy('task.createdAt', 'DESC');

    if (currentUser.role !== UserRole.ADMIN) {
      qb.andWhere('(client.responsableId = :userId OR task.assigneeId = :userId)', { userId: currentUser.id });
    }

    return qb.getMany();
  }

  async getDashboard(semaine?: number) {
    const qb = this.repo.createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.client', 'client')
      .where('task.annee IS NULL');

    if (semaine) {
      qb.andWhere('task.semaine = :semaine', { semaine });
    }

    const tasks = await qb.getMany();

    const total = tasks.length;
    const terminees = tasks.filter(t => t.statut === 'TERMINEE').length;
    const enCours = tasks.filter(t => t.statut === 'EN_COURS').length;
    const nonFait = tasks.filter(t => t.statut === 'NON_FAIT').length;
    const enAttente = tasks.filter(t => t.statut === 'EN_ATTENTE').length;
    const tauxCompletion = total > 0 ? Math.round((terminees / total) * 100) : 0;

    const tempsMoyen = tasks.filter(t => t.tempsExecution > 0).length > 0
      ? tasks.filter(t => t.tempsExecution > 0).reduce((a, t) => a + t.tempsExecution, 0) /
        tasks.filter(t => t.tempsExecution > 0).length
      : 0;

    // Stats par collaborateur
    const byCollab: Record<string, any> = {};
    for (const t of tasks) {
      const name = t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : 'Non assigné';
      if (!byCollab[name]) byCollab[name] = { name, total: 0, terminees: 0, tempsTotal: 0 };
      byCollab[name].total++;
      if (t.statut === 'TERMINEE') byCollab[name].terminees++;
      byCollab[name].tempsTotal += t.tempsExecution || 0;
    }

    // Stats par type
    const byType: Record<string, number> = {};
    for (const t of tasks) {
      const type = t.type || 'AUTRE';
      byType[type] = (byType[type] || 0) + 1;
    }

    return {
      semaine,
      total,
      terminees,
      enCours,
      nonFait,
      enAttente,
      tauxCompletion,
      tempsMoyen: Math.round(tempsMoyen * 10) / 10,
      parCollaborateur: Object.values(byCollab),
      parType: Object.entries(byType).map(([type, count]) => ({ type, count })),
    };
  }

  async create(clientId: number, dto: CreateTaskDto, currentUser: User) {
    if (dto.assigneeId) {
      const allowed = await this.canAssignTo(currentUser, dto.assigneeId);
      if (!allowed) throw new ForbiddenException('Vous ne pouvez pas assigner cette tâche à cet utilisateur');
    }

    const now = new Date();
    const semaine = dto.semaine || this.getWeekNumber(now);

    const task = this.repo.create({
      ...dto,
      clientId,
      createdBy: currentUser,
      semaine,
      heureDebut: now,
    });
    const saved = await this.repo.save(task);

    // Générer le taskId : T-YYYY-XXX
    const year = now.getFullYear();
    const taskId = `T-${year}-${saved.id.toString().padStart(3, '0')}`;
    await this.repo.update(saved.id, { taskId });

    if (dto.assigneeId && dto.assigneeId !== currentUser.id) {
      this.notifications.emit(dto.assigneeId, {
        type: 'TASK_ASSIGNED',
        message: `${currentUser.firstName} ${currentUser.lastName} vous a assigné une tâche`,
        titre: dto.titre,
        clientId,
        taskId: saved.id,
      });
    }

    return this.repo.findOne({ where: { id: saved.id }, relations: ['assignee', 'createdBy', 'client'] });
  }

  async update(id: number, dto: UpdateTaskDto, currentUser?: User) {
    const task = await this.repo.findOne({ where: { id }, relations: ['assignee', 'createdBy'] });
    if (!task) throw new NotFoundException('Tâche introuvable');

    if (dto.assigneeId && currentUser) {
      const allowed = await this.canAssignTo(currentUser, dto.assigneeId);
      if (!allowed) throw new ForbiddenException('Vous ne pouvez pas assigner cette tâche à cet utilisateur');
    }

    // Si passage à TERMINEE, enregistrer heure fin
    const updates: Partial<Task> = { ...dto } as any;
    if (dto.statut === 'TERMINEE' && task.statut !== 'TERMINEE') {
      updates.heureFin = new Date();
      if (task.heureDebut) {
        updates.tempsExecution = (new Date().getTime() - new Date(task.heureDebut).getTime()) / 60000;
      }
    }

    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
      this.notifications.emit(dto.assigneeId, {
        type: 'TASK_ASSIGNED',
        message: `Une tâche vous a été assignée`,
        titre: task.titre,
        clientId: task.clientId,
        taskId: id,
      });
    }

    await this.repo.update(id, updates);
    return this.repo.findOne({ where: { id }, relations: ['assignee', 'createdBy', 'client'] });
  }

  async remove(id: number) {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tâche introuvable');
    await this.repo.remove(task);
    return { message: 'Tâche supprimée' };
  }

  // ─── Grille mensuelle ───────────────────────────────────────────────────────

  readonly TYPES_MENSUELS = ['TVA', 'PAIE', 'ACHATS', 'VENTES', 'RB', 'GV'] as const;
  readonly DR_ETAPES = [
    'Régularité formelle',
    'Trésorerie / Emprunt',
    'Chiffre d\'Affaires / Clients',
    'Contrôle CA',
    'Analyse solde client',
    'Charges / Fournisseurs',
    'Analyse solde fournisseurs',
    'Clients douteux',
    'Stock',
    'Immobilisations',
    'Personnel',
    'État',
    'Cadrage TVA',
    'Capitaux propres',
    'Autres comptes',
    'Calcul IS',
  ] as const;

  async findGrille(clientId: number, annee: number) {
    const tasks = await this.repo.find({
      where: { clientId, annee },
      relations: ['assignee'],
      order: { mois: 'ASC' },
    });

    // Grille mensuelle : { type -> { mois -> Task } }
    const grille: Record<string, Record<number, any>> = {};
    for (const type of this.TYPES_MENSUELS) {
      grille[type] = {};
      for (let m = 1; m <= 12; m++) {
        grille[type][m] = tasks.find(t => t.type === type && t.mois === m) ?? null;
      }
    }

    // DR : liste des étapes (mois=null)
    const drTaches = tasks.filter(t => t.type === 'DR');

    // S'assurer que toutes les étapes existent (init auto si besoin)
    const etapesExistantes = drTaches.map(t => t.titre);
    const etapesManquantes = this.DR_ETAPES.filter(e => !etapesExistantes.includes(e));
    if (etapesManquantes.length > 0) {
      const now = new Date();
      const nouvelles = etapesManquantes.map(e => this.repo.create({
          titre: e,
          type: 'DR' as any,
          statut: TaskStatut.A_FAIRE,
          priorite: 'NORMALE' as any,
          clientId,
          annee,
          mois: undefined,
        }));
      const saved = await this.repo.save(nouvelles);
      drTaches.push(...saved);
    }

    // Ordonner les étapes DR selon l'ordre défini
    const drOrdonnees = this.DR_ETAPES.map(e => drTaches.find(t => t.titre === e)).filter(Boolean);

    // Commentaires (tâches sentinelles mois=0)
    const commentaires = await this.getCommentaires(clientId, annee);

    return { grille, drEtapes: drOrdonnees, annee, commentaires };
  }

  async toggleMensuel(
    clientId: number,
    dto: { type: string; mois: number; annee: number },
    currentUser: User,
  ) {
    const existing = await this.repo.findOne({
      where: { clientId, type: dto.type as any, mois: dto.mois, annee: dto.annee },
    });

    if (!existing) {
      // Créer directement en TERMINEE (clic = cocher)
      const now = new Date();
      const task = this.repo.create({
        titre: `${dto.type} — ${dto.mois}/${dto.annee}`,
        type: dto.type as any,
        statut: TaskStatut.TERMINEE,
        priorite: 'NORMALE' as any,
        clientId,
        mois: dto.mois,
        annee: dto.annee,
        semaine: this.getWeekNumber(now),
        heureDebut: now,
        heureFin: now,
        createdBy: currentUser,
      });
      const saved = await this.repo.save(task);
      const year = now.getFullYear();
      await this.repo.update(saved.id, { taskId: `T-${year}-${saved.id.toString().padStart(3, '0')}` });
      return this.repo.findOne({ where: { id: saved.id } });
    }

    // TERMINEE → NON_FAIT → suppression (retour à vide)
    if (existing.statut === TaskStatut.TERMINEE) {
      await this.repo.update(existing.id, { statut: TaskStatut.NON_FAIT });
      return this.repo.findOne({ where: { id: existing.id } });
    } else {
      await this.repo.remove(existing);
      return null;
    }
  }

  async toggleDrEtape(id: number) {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Étape introuvable');
    const newStatut = task.statut === TaskStatut.TERMINEE ? TaskStatut.A_FAIRE : TaskStatut.TERMINEE;
    await this.repo.update(id, { statut: newStatut });
    return this.repo.findOne({ where: { id } });
  }

  async updateCommentaire(clientId: number, type: string, annee: number, commentaire: string) {
    // Le commentaire est stocké sur une tâche sentinelle mois=0
    let sentinel = await this.repo.findOne({
      where: { clientId, type: type as any, annee, mois: 0 },
    });
    if (!sentinel) {
      sentinel = this.repo.create({
        titre: `__commentaire__${type}`,
        type: type as any,
        statut: TaskStatut.A_FAIRE,
        priorite: 'NORMALE' as any,
        clientId,
        annee,
        mois: 0,
        commentaire,
      });
    } else {
      sentinel.commentaire = commentaire;
    }
    return this.repo.save(sentinel);
  }

  async getCommentaires(clientId: number, annee: number) {
    const sentinels = await this.repo.find({
      where: { clientId, annee, mois: 0 },
    });
    const map: Record<string, string> = {};
    for (const s of sentinels) map[s.type] = s.commentaire ?? '';
    return map;
  }
}
