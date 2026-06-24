import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskComment } from '../entities/task-comment.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TaskCommentsService {
  constructor(
    @InjectRepository(TaskComment) private repo: Repository<TaskComment>,
    private notifications: NotificationsService,
  ) {}

  findByTask(taskId: number): Promise<TaskComment[]> {
    return this.repo.find({
      where: { taskId },
      relations: ['auteur'],
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    taskId: number,
    dto: { contenu: string; mentions?: number[] },
    auteur: User,
  ): Promise<TaskComment> {
    const comment = this.repo.create({
      contenu: dto.contenu,
      taskId,
      auteurId: auteur.id,
      mentions: dto.mentions ?? [],
    });
    const saved = await this.repo.save(comment);

    for (const userId of dto.mentions ?? []) {
      if (userId !== auteur.id) {
        await this.notifications.emit(userId, {
          type: 'TASK_MENTIONED',
          message: `${auteur.firstName} ${auteur.lastName} vous a mentionné dans un commentaire`,
          titre: 'Mention dans une tâche',
          taskId,
        });
      }
    }

    return this.repo.findOne({ where: { id: saved.id }, relations: ['auteur'] }) as Promise<TaskComment>;
  }

  async remove(commentId: number, currentUser: User): Promise<void> {
    const comment = await this.repo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    if (comment.auteurId !== currentUser.id && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres commentaires');
    }
    await this.repo.remove(comment);
  }
}
