import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface TaskNotification {
  id: number;
  type: string;
  message: string;
  titre: string;
  clientId: number;
  createdAt: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationStreamService {
  private auth = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/notifications`;

  private eventSource: EventSource | null = null;
  private audioCtx: AudioContext | null = null;
  private loaded = false;

  private _notifications = signal<TaskNotification[]>([]);
  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter(n => !n.read).length);

  private _newNotif = new Subject<TaskNotification>();
  /** Émet chaque nouvelle notification reçue en temps réel — abonnez-vous pour rafraîchir l'UI */
  readonly newNotif$ = this._newNotif.asObservable();

  connect() {
    this.initAudioContext();
    if (!this.loaded) {
      this.loadFromApi();
    }
    if (this.eventSource) return;

    const token = this.auth.getToken();
    if (!token) return;

    const url = `${this.api}/stream?token=${token}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.addNotification(data);
      } catch { /* ignore */ }
    };

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.eventSource = null;
      setTimeout(() => this.connectSse(), 5000);
    };
  }

  private connectSse() {
    if (this.eventSource) return;
    const token = this.auth.getToken();
    if (!token) return;
    const url = `${this.api}/stream?token=${token}`;
    this.eventSource = new EventSource(url);
    this.eventSource.onmessage = (event) => {
      try { this.addNotification(JSON.parse(event.data)); } catch { /* ignore */ }
    };
    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.eventSource = null;
      setTimeout(() => this.connectSse(), 5000);
    };
  }

  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
    this.loaded = false;
    this._notifications.set([]);
  }

  private loadFromApi() {
    this.http.get<TaskNotification[]>(this.api).subscribe({
      next: (notifs) => {
        this.loaded = true;
        this._notifications.set(notifs.map(n => ({ ...n, createdAt: new Date(n.createdAt) })));
        this.updateTabTitle();
      },
      error: () => { this.loaded = true; },
    });
  }

  private addNotification(data: any) {
    const notif: TaskNotification = {
      id: data.id,
      type: data.type,
      message: data.message,
      titre: data.titre,
      clientId: data.clientId,
      createdAt: new Date(data.createdAt ?? Date.now()),
      read: false,
    };
    this._notifications.update(n => [notif, ...n].slice(0, 50));
    this._newNotif.next(notif);
    this.playSound();
    this.updateTabTitle();
  }

  markAllRead() {
    this.http.patch(`${this.api}/read-all`, {}).subscribe();
    this._notifications.update(n => n.map(notif => ({ ...notif, read: true })));
    this.updateTabTitle();
  }

  dismiss(id: number) {
    this.http.delete(`${this.api}/${id}`).subscribe();
    this._notifications.update(n => n.filter(notif => notif.id !== id));
    this.updateTabTitle();
  }

  navigateTo(notif: TaskNotification) {
    notif.read = true;
    this._notifications.update(n => [...n]);
    this.updateTabTitle();
    if (notif.clientId) {
      this.router.navigate(['/clients', notif.clientId], { queryParams: { tab: 'tasks' } });
    }
  }

  private initAudioContext() {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const unlock = () => {
        this.audioCtx?.resume().then(() => {
          document.removeEventListener('click', unlock, true);
          document.removeEventListener('keydown', unlock, true);
          document.removeEventListener('touchstart', unlock, true);
        });
      };
      document.addEventListener('click', unlock, true);
      document.addEventListener('keydown', unlock, true);
      document.addEventListener('touchstart', unlock, true);
    } catch { /* Audio non disponible */ }
  }

  private playSound() {
    try {
      const ctx = this.audioCtx;
      if (!ctx || ctx.state === 'suspended') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(1.0, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* Audio non disponible */ }
  }

  private updateTabTitle() {
    const count = this.unreadCount();
    document.title = count > 0 ? `(${count}) Passidoc` : 'Passidoc';
  }
}
