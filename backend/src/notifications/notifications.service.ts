import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private clients = new Map<number, Subject<MessageEvent>[]>();

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

  emit(userId: number, data: Record<string, unknown>) {
    const subjects = this.clients.get(userId) ?? [];
    const event: MessageEvent = { data: JSON.stringify(data) };
    subjects.forEach(s => s.next(event));
  }
}
