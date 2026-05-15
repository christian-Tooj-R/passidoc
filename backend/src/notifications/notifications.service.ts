import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationsService {
  private clients = new Map<number, Subject<MessageEvent>[]>();

  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
  ) {}

  subscribe(userId: number): { subject: Subject<MessageEvent>; cleanup: () => void } {
    const subject = new Subject<MessageEvent>();
    const existing = this.clients.get(userId) ?? [];
    this.clients.set(userId, [...existing, subject]);

    const cleanup = () => {
      const current = this.clients.get(userId) ?? [];
      this.clients.set(userId, current.filter(s => s !== subject));
      subject.complete();
    };

    return { subject, cleanup };
  }

  async emit(userId: number, data: Record<string, any>) {
    try {
      const notif = this.repo.create({
        userId,
        type: data.type,
        message: data.message,
        titre: data.titre,
        clientId: data.clientId ?? undefined,
      });
      const saved = await this.repo.save(notif);

      // Pousser en temps réel via SSE si l'utilisateur est connecté
      const subjects = this.clients.get(userId) ?? [];
      const event: MessageEvent = { data: JSON.stringify({ ...data, id: saved.id, createdAt: saved.createdAt }) };
      subjects.forEach(s => s.next(event));
    } catch (err) {
      console.error(`[Notifications] Échec emit userId=${userId}:`, err);
    }
  }

  async findForUser(userId: number): Promise<Notification[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAllRead(userId: number) {
    await this.repo.update({ userId, read: false }, { read: true });
  }

  async dismiss(id: number, userId: number) {
    await this.repo.delete({ id, userId });
  }
}
