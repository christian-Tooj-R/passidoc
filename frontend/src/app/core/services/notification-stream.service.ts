import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface TaskNotification {
  id: number;
  type: string;
  message: string;
  titre: string;
  clientId: number;
  receivedAt: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationStreamService {
  private auth = inject(AuthService);
  private router = inject(Router);
  private eventSource: EventSource | null = null;
  private idCounter = 0;

  private _notifications = signal<TaskNotification[]>([]);
  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter(n => !n.read).length);

  connect() {
    if (this.eventSource) return;
    const token = this.auth.getToken();
    if (!token) return;

    const url = `${environment.apiUrl}/notifications/stream?token=${token}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleNotification(data);
      } catch { /* ignore */ }
    };

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.eventSource = null;
      // Reconnect after 5s
      setTimeout(() => this.connect(), 5000);
    };
  }

  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
  }

  private handleNotification(data: any) {
    const notif: TaskNotification = {
      id: ++this.idCounter,
      type: data.type,
      message: data.message,
      titre: data.titre,
      clientId: data.clientId,
      receivedAt: new Date(),
      read: false,
    };

    this._notifications.update(n => [notif, ...n].slice(0, 50));
    this.playSound();
    this.updateTabTitle();
  }

  markAllRead() {
    this._notifications.update(n => n.map(notif => ({ ...notif, read: true })));
    this.updateTabTitle();
  }

  navigateTo(notif: TaskNotification) {
    notif.read = true;
    this._notifications.update(n => [...n]);
    this.updateTabTitle();
    this.router.navigate(['/clients', notif.clientId], { queryParams: { tab: 'tasks' } });
  }

  private playSound() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Son "ding" à deux notes
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch { /* Audio non disponible */ }
  }

  private updateTabTitle() {
    const count = this.unreadCount();
    document.title = count > 0 ? `(${count}) Passidoc` : 'Passidoc';
  }
}
