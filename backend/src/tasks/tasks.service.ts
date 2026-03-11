import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private repo: Repository<Task>,
    private notifications: NotificationsService,
  ) {}

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

  async update(id: number, dto: UpdateTaskDto) {
    const task = await this.repo.findOne({ where: { id }, relations: ['assignee', 'createdBy'] });
    if (!task) throw new NotFoundException('Tâche introuvable');

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
