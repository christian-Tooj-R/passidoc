import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
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
      return assignee?.referentId === assigner.id || assigneeId === assigner.id;
    }
    return assigneeId === assigner.id;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  findAllByClient(clientId: number) {
    return this.repo.find({
      where: { clientId },
      relations: ['assignee', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  findAll(currentUser: User) {
    const qb = this.repo.createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('task.client', 'client')
      .orderBy('task.createdAt', 'DESC');

    if (currentUser.role !== UserRole.ADMIN) {
      qb.where('client.responsableId = :userId', { userId: currentUser.id });
    }

    return qb.getMany();
  }

  async getDashboard(semaine?: number) {
    const qb = this.repo.createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.client', 'client');

    if (semaine) {
      qb.where('task.semaine = :semaine', { semaine });
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
}
