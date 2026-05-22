import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatRippleModule } from '@angular/material/core';
import { PointageService } from '../../core/services/pointage.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-pointage-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatSnackBarModule, MatRippleModule],
  template: `
<div class="pm-wrap">

  <!-- Fond décoratif -->
  <div class="pm-bg"></div>

  <div class="pm-content">

    <!-- Heure en direct -->
    <div class="pm-time">{{ heure() }}</div>
    <div class="pm-date">{{ dateLabel() }}</div>

    <!-- Avatar + message -->
    <div class="pm-avatar">{{ initiales() }}</div>
    <h2 class="pm-title">{{ greet() }}, {{ prenom() }} !</h2>
    <p class="pm-sub">Pointez votre arrivée pour commencer la journée</p>

    <!-- Bouton -->
    <button class="pm-btn" matRipple [disabled]="loading()" (click)="pointer()">
      <mat-icon>fingerprint</mat-icon>
      <span>{{ loading() ? 'Enregistrement…' : 'Je suis arrivé' }}</span>
    </button>

  </div>
</div>
  `,
  styles: [`
    .pm-wrap {
      position: relative;
      width: 360px;
      border-radius: 24px;
      overflow: hidden;
      background: linear-gradient(145deg, #1e3a5f 0%, #1D4ED8 100%);
      color: #fff;
    }

    .pm-bg {
      position: absolute; inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='250' cy='50' r='120' fill='rgba(255,255,255,.06)'/%3E%3Ccircle cx='30' cy='260' r='90' fill='rgba(255,255,255,.04)'/%3E%3C/svg%3E") no-repeat right top;
      pointer-events: none;
    }

    .pm-content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 32px 36px;
      gap: 10px;
      text-align: center;
    }

    .pm-time {
      font-size: 3rem;
      font-weight: 800;
      letter-spacing: -2px;
      line-height: 1;
    }

    .pm-date {
      font-size: 0.82rem;
      opacity: .7;
      text-transform: capitalize;
      margin-bottom: 8px;
    }

    .pm-avatar {
      width: 64px; height: 64px;
      border-radius: 50%;
      background: rgba(255,255,255,.2);
      border: 3px solid rgba(255,255,255,.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem; font-weight: 700;
      margin: 4px 0;
    }

    .pm-title {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 700;
    }

    .pm-sub {
      margin: 0;
      font-size: 0.85rem;
      opacity: .75;
      max-width: 240px;
      line-height: 1.4;
    }

    .pm-btn {
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 36px;
      border-radius: 50px;
      background: rgba(255,255,255,.2);
      border: 2px solid rgba(255,255,255,.5);
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background .2s, transform .1s;
      backdrop-filter: blur(4px);

      &:hover:not(:disabled) {
        background: rgba(255,255,255,.3);
        transform: translateY(-1px);
      }

      &:disabled { opacity: .5; cursor: not-allowed; }

      mat-icon { font-size: 1.3rem; width: 1.3rem; height: 1.3rem; }
    }
  `],
})
export class PointageModalComponent implements OnInit, OnDestroy {
  loading = signal(false);
  heure   = signal('');
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private dialogRef: MatDialogRef<PointageModalComponent>,
    private svc: PointageService,
    private auth: AuthService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy() { clearInterval(this.timer); }

  private tick() {
    this.heure.set(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  }

  dateLabel() {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  prenom()   { return this.auth.currentUser()?.firstName ?? ''; }
  initiales() {
    const u = this.auth.currentUser();
    return u ? (u.firstName[0] + u.lastName[0]).toUpperCase() : '?';
  }

  greet() {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  }

  pointer() {
    this.loading.set(true);
    this.svc.pointer().subscribe({
      next: () => this.dialogRef.close(true),
      error: (e) => {
        this.snack.open(e.error?.message ?? 'Erreur', undefined, { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}
