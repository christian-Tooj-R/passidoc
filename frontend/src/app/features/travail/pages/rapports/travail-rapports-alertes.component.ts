import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { TasksService, Task } from '../../../../core/services/tasks.service';

@Component({
  selector: 'app-travail-rapports-alertes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
<div class="page">
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--red"><mat-icon>notifications_active</mat-icon></div>
      <div>
        <h1 class="pg-title">Alertes & Notifications</h1>
        <p class="pg-sub">{{ totalAlertes() }} alerte(s) active(s) · Mis à jour à {{ now }}</p>
      </div>
    </div>
    <button class="btn-refresh" (click)="load()">
      <mat-icon [class.spin]="loading()">refresh</mat-icon> Actualiser
    </button>
  </div>

  <!-- Compteurs rapides -->
  <div class="counter-bar">
    <div class="counter counter--red">
      <mat-icon>schedule</mat-icon>
      <span class="counter-val">{{ lateTasksCount() }}</span>
      <span class="counter-lbl">en retard</span>
    </div>
    <div class="counter counter--orange">
      <mat-icon>person_off</mat-icon>
      <span class="counter-val">{{ unassignedCount() }}</span>
      <span class="counter-lbl">non assignées</span>
    </div>
    <div class="counter counter--blue">
      <mat-icon>swap_horiz</mat-icon>
      <span class="counter-val">{{ pendingInterServiceCount() }}</span>
      <span class="counter-lbl">inter-service</span>
    </div>
  </div>

  @if (loading()) {
    <div class="loading-state">
      <mat-icon class="spin">refresh</mat-icon>
      <span>Chargement des alertes…</span>
    </div>
  } @else {
    <div class="alerts-wrap">

      <!-- Section 1 : Retard -->
      <div class="alert-section">
        <div class="alert-section__header alert-section__header--red">
          <mat-icon>schedule</mat-icon>
          <span>Tâches en retard ({{ lateTasksCount() }})</span>
        </div>
        @for (t of lateTasks(); track t.id) {
          <div class="alert-item alert-item--red">
            <mat-icon>warning</mat-icon>
            <div class="alert-body">
              <p class="alert-title">{{ t.titre }}</p>
              <p class="alert-meta">{{ t.client?.nom ?? '—' }} · Échéance : {{ formatDate(t.dateEcheance!) }} · {{ t.assignee?.firstName ?? 'Non assigné' }} {{ t.assignee?.lastName ?? '' }}</p>
            </div>
            <span class="alert-badge badge-retard">Retard</span>
          </div>
        }
        @if (lateTasksCount() === 0) {
          <div class="alert-empty"><mat-icon>check_circle</mat-icon> Aucune tâche en retard</div>
        }
      </div>

      <!-- Section 2 : Non assignées -->
      <div class="alert-section">
        <div class="alert-section__header alert-section__header--orange">
          <mat-icon>person_off</mat-icon>
          <span>Tâches non assignées ({{ unassignedCount() }})</span>
        </div>
        @for (t of unassigned(); track t.id) {
          <div class="alert-item alert-item--orange">
            <mat-icon>person_off</mat-icon>
            <div class="alert-body">
              <p class="alert-title">{{ t.titre }}</p>
              <p class="alert-meta">{{ t.client?.nom ?? '—' }} · Statut : {{ t.statut }} · Priorité : {{ t.priorite }}</p>
            </div>
            <span class="alert-badge badge-unassigned">Non assigné</span>
          </div>
        }
        @if (unassignedCount() === 0) {
          <div class="alert-empty"><mat-icon>check_circle</mat-icon> Toutes les tâches sont assignées</div>
        }
      </div>

      <!-- Section 3 : Inter-service -->
      <div class="alert-section">
        <div class="alert-section__header alert-section__header--blue">
          <mat-icon>swap_horiz</mat-icon>
          <span>En attente inter-service ({{ pendingInterServiceCount() }})</span>
        </div>
        @for (t of pendingIS(); track t.id) {
          <div class="alert-item alert-item--blue">
            <mat-icon>swap_horiz</mat-icon>
            <div class="alert-body">
              <p class="alert-title">{{ t.titre }}</p>
              <p class="alert-meta">{{ t.client?.nom ?? '—' }} · Service attendu : {{ t.serviceAttendu ?? '—' }} · {{ t.assignee?.firstName ?? 'Non assigné' }}</p>
            </div>
            <span class="alert-badge badge-interservice">Inter-service</span>
          </div>
        }
        @if (pendingInterServiceCount() === 0) {
          <div class="alert-empty"><mat-icon>check_circle</mat-icon> Aucune tâche en attente inter-service</div>
        }
      </div>

    </div>
  }
</div>
  `,
  styles: [`
    .page { display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden; }
    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px 16px; background:#fff; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .pg-header__left { display:flex; align-items:center; gap:12px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; }
    .pg-icon--red { background:linear-gradient(135deg,#ef4444,#dc2626); box-shadow:0 4px 14px rgba(239,68,68,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }

    .btn-refresh { display:flex; align-items:center; gap:6px; height:34px; padding:0 14px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; color:#374151; font-size:12px; font-weight:600; cursor:pointer; }
    .btn-refresh mat-icon { font-size:16px; width:16px; height:16px; }
    .btn-refresh:hover { background:#f1f5f9; }

    .counter-bar { display:flex; gap:12px; padding:12px 24px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .counter { display:flex; align-items:center; gap:8px; padding:8px 16px; border-radius:10px; font-size:13px; }
    .counter mat-icon { font-size:18px; width:18px; height:18px; }
    .counter--red    { background:#fee2e2; color:#dc2626; }
    .counter--orange { background:#ffedd5; color:#c2410c; }
    .counter--blue   { background:#dbeafe; color:#1d4ed8; }
    .counter-val { font-size:18px; font-weight:800; }
    .counter-lbl { font-size:12px; font-weight:500; }

    .loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:60px; color:#94a3b8; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .alerts-wrap { flex:1; overflow:auto; padding:20px 24px; display:flex; flex-direction:column; gap:0; }

    .alert-section { margin-bottom:20px; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; }
    .alert-section__header { display:flex; align-items:center; gap:8px; padding:12px 16px; font-size:13px; font-weight:700; }
    .alert-section__header mat-icon { font-size:18px; width:18px; height:18px; }
    .alert-section__header--red    { background:#fee2e2; color:#dc2626; }
    .alert-section__header--orange { background:#ffedd5; color:#c2410c; }
    .alert-section__header--blue   { background:#dbeafe; color:#1d4ed8; }

    .alert-item { display:flex; align-items:center; gap:12px; padding:12px 16px; border-top:1px solid #f1f5f9; background:#fff; }
    .alert-item mat-icon { font-size:18px; width:18px; height:18px; flex-shrink:0; }
    .alert-item--red    mat-icon { color:#ef4444; }
    .alert-item--orange mat-icon { color:#f97316; }
    .alert-item--blue   mat-icon { color:#3b82f6; }

    .alert-body { flex:1; min-width:0; }
    .alert-title { font-size:13px; font-weight:600; color:#0f172a; margin:0 0 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .alert-meta  { font-size:11.5px; color:#64748b; margin:0; }

    .alert-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; white-space:nowrap; flex-shrink:0; }
    .badge-retard      { background:#fee2e2; color:#dc2626; }
    .badge-unassigned  { background:#ffedd5; color:#c2410c; }
    .badge-interservice { background:#dbeafe; color:#1d4ed8; }

    .alert-empty { display:flex; align-items:center; gap:8px; padding:14px 16px; font-size:13px; color:#64748b; background:#fff; border-top:1px solid #f1f5f9; }
    .alert-empty mat-icon { color:#10b981; font-size:18px; width:18px; height:18px; }
  `],
})
export class TravailRapportsAlertesComponent implements OnInit, OnDestroy {
  private tasksSvc = inject(TasksService);
  private _d$ = new Subject<void>();

  loading = signal(true);
  allTasks = signal<Task[]>([]);
  now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  lateTasks = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.allTasks().filter(t =>
      t.dateEcheance &&
      t.dateEcheance < today &&
      t.statut !== 'TERMINEE' &&
      t.statut !== 'NON_FAIT'
    );
  });
  lateTasksCount = computed(() => this.lateTasks().length);

  unassigned = computed(() =>
    this.allTasks().filter(t => !t.assignee && t.statut !== 'TERMINEE')
  );
  unassignedCount = computed(() => this.unassigned().length);

  pendingIS = computed(() =>
    this.allTasks().filter(t => t.enAttenteService)
  );
  pendingInterServiceCount = computed(() => this.pendingIS().length);

  totalAlertes = computed(() =>
    this.lateTasksCount() + this.unassignedCount() + this.pendingInterServiceCount()
  );

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.tasksSvc.getAllGlobal().pipe(takeUntil(this._d$)).subscribe({
      next: tasks => {
        this.allTasks.set(tasks);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  formatDate(s: string): string {
    if (!s) return '—';
    const d = new Date(s);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }
}
