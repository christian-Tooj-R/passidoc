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
    // Collaborateur Madagascar : uniquement lui-même
    return assigneeId === assigner.id;
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

  async create(clientId: number, dto: CreateTaskDto, currentUser: User) {
    if (dto.assigneeId) {
      const allowed = await this.canAssignTo(currentUser, dto.assigneeId);
      if (!allowed) throw new ForbiddenException('Vous ne pouvez pas assigner cette tâche à cet utilisateur');
    }

    const task = this.repo.create({ ...dto, clientId, createdBy: currentUser });
    const saved = await this.repo.save(task);

    // Notifier l'assigné si ce n'est pas soi-même
    if (dto.assigneeId && dto.assigneeId !== currentUser.id) {
      this.notifications.emit(dto.assigneeId, {
        type: 'TASK_ASSIGNED',
        message: `${currentUser.firstName} ${currentUser.lastName} vous a assigné une tâche`,
        titre: dto.titre,
        clientId,
        taskId: saved.id,
      });
    }

    return saved;
  }

  async update(id: number, dto: UpdateTaskDto, currentUser?: User) {
    const task = await this.repo.findOne({ where: { id }, relations: ['assignee', 'createdBy'] });
    if (!task) throw new NotFoundException('Tâche introuvable');

    if (dto.assigneeId && currentUser) {
      const allowed = await this.canAssignTo(currentUser, dto.assigneeId);
      if (!allowed) throw new ForbiddenException('Vous ne pouvez pas assigner cette tâche à cet utilisateur');
    }

    // Notifier si l'assigné change
    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
      this.notifications.emit(dto.assigneeId, {
        type: 'TASK_ASSIGNED',
        message: `Une tâche vous a été assignée`,
        titre: task.titre,
        clientId: task.clientId,
        taskId: id,
      });
    }

    await this.repo.update(id, dto);
    return this.repo.findOne({ where: { id }, relations: ['assignee', 'createdBy'] });
  }

  async remove(id: number) {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tâche introuvable');
    await this.repo.remove(task);
    return { message: 'Tâche supprimée' };
  }
}
