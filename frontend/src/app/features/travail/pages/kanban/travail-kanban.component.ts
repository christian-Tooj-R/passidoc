import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { TasksService, Task } from '../../../../core/services/tasks.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { UsersService } from '../../../../core/services/users.service';
import { Client } from '../../../../core/models/client.model';
import { User } from '../../../../core/models/user.model';
import { TimerService } from '../../../../core/services/saisie-temps.service';

interface KanbanColumn {
  id: string;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const COLUMNS: KanbanColumn[] = [
  { id: 'A_FAIRE',    label: 'À faire',    icon: 'radio_button_unchecked', color: '#2563eb', bgColor: '#eff6ff', borderColor: '#bfdbfe' },
  { id: 'EN_COURS',   label: 'En cours',   icon: 'pending',                color: '#ea580c', bgColor: '#fff7ed', borderColor: '#fed7aa' },
  { id: 'EN_PAUSE',   label: 'En pause',   icon: 'pause_circle',           color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#ddd6fe' },
  { id: 'EN_ATTENTE', label: 'En attente', icon: 'schedule',               color: '#0891b2', bgColor: '#ecfeff', borderColor: '#a5f3fc' },
  { id: 'TERMINEE',   label: 'Terminée',   icon: 'check_circle',           color: '#15803d', bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
  { id: 'NON_FAIT',   label: 'Non fait',   icon: 'cancel',                 color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fecaca' },
];

@Component({
  selector: 'app-travail-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  template: `
<div class="page">

  <!-- ── Header ── -->
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon"><mat-icon>view_kanban</mat-icon></div>
      <div>
        <h1 class="pg-title">Vue Kanban</h1>
        <p class="pg-sub">{{ allTasks().length }} tâche(s) · Glissez pour changer le statut</p>
      </div>
    </div>
    <div class="header-actions">
      <select class="hdr-select" [(ngModel)]="filterCollab" (change)="reload()">
        <option value="">Tous les collaborateurs</option>
        @for (u of users; track u.id) {
          <option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</option>
        }
      </select>
      <select class="hdr-select" [(ngModel)]="filterClient" (change)="reload()">
        <option value="">Tous les clients</option>
        @for (c of clients; track c.id) {
          <option [value]="c.id">{{ c.nom }}</option>
        }
      </select>
      <select class="hdr-select" [(ngModel)]="filterPrio" (change)="reload()">
        <option value="">Toutes priorités</option>
        <option value="HAUTE">Haute</option>
        <option value="NORMALE">Normale</option>
        <option value="BASSE">Basse</option>
      </select>
      <button class="btn-new" (click)="newTask()">
        <mat-icon>add</mat-icon> Nouvelle tâche
      </button>
    </div>
  </div>

  <!-- ── Chargement ── -->
  @if (loading()) {
    <div class="loading-bar"><div class="loading-bar__fill"></div></div>
  }

  <!-- ── Board Kanban ── -->
  <div class="kanban-board">
    @for (col of columns; track col.id) {
      <div class="kanban-col">

        <!-- En-tête colonne -->
        <div class="col-header" [style.border-top-color]="col.color">
          <div class="col-header__left">
            <mat-icon class="col-icon" [style.color]="col.color">{{ col.icon }}</mat-icon>
            <span class="col-label">{{ col.label }}</span>
          </div>
          <span class="col-count" [style.background]="col.bgColor" [style.color]="col.color">
            {{ tasksForCol(col.id).length }}
          </span>
        </div>

        <!-- Zone de dépôt -->
        <div class="col-body"
             [class.col-body--empty]="tasksForCol(col.id).length === 0"
             (dragover)="onDragOver($event)"
             (drop)="onDrop($event, col.id)">

          @for (task of tasksForCol(col.id); track task.id) {
            <div class="kanban-card"
                 draggable="true"
                 (dragstart)="onDragStart($event, task)"
                 [class.kanban-card--haute]="task.priorite === 'HAUTE'">

              <!-- Priorité + type -->
              <div class="card-top">
                <span class="card-prio" [class]="'prio-' + (task.priorite ?? 'NORMALE')">
                  {{ task.priorite ?? 'NORMALE' }}
                </span>
                @if (task.type) {
                  <span class="card-type">{{ task.type }}</span>
                }
                @if (task.estFacturable) {
                  <span class="card-fact" matTooltip="Facturable">€</span>
                }
              </div>

              <!-- Titre -->
              <p class="card-title">{{ task.titre }}</p>

              <!-- Client -->
              @if (task.client?.nom) {
                <div class="card-client">
                  <mat-icon>business</mat-icon>
                  <span>{{ task.client!.nom }}</span>
                </div>
              }

              <!-- Footer : assigné + deadline + temps -->
              <div class="card-footer">
                <div class="card-assignee">
                  @if (task.assignee) {
                    <div class="assignee-avatar" [matTooltip]="task.assignee.firstName + ' ' + task.assignee.lastName">
                      {{ initials(task.assignee.firstName + ' ' + task.assignee.lastName) }}
                    </div>
                  } @else {
                    <div class="assignee-avatar assignee-avatar--none" matTooltip="Non assigné">?</div>
                  }
                </div>
                <div class="card-meta">
                  @if (task.dateEcheance) {
                    <span class="card-date" [class.card-date--late]="isLate(task.dateEcheance)">
                      <mat-icon>event</mat-icon>
                      {{ formatDate(task.dateEcheance) }}
                    </span>
                  }
                  @if (task.tempsExecution) {
                    <span class="card-time">
                      <mat-icon>schedule</mat-icon>
                      {{ task.tempsExecution }}h
                    </span>
                  }
                </div>
              </div>

              <!-- Actions -->
              <div class="card-actions">
                <button class="card-act-btn" matTooltip="Voir détail">
                  <mat-icon>open_in_new</mat-icon>
                </button>
                <button class="card-act-btn" matTooltip="Modifier">
                  <mat-icon>edit</mat-icon>
                </button>
                @if (timerSvc.isRunning() && timerSvc.activeTaskCtx()?.taskId === task.id) {
                  <button class="card-act-btn card-act-btn--timer-on"
                          matTooltip="Minuteur en cours"
                          disabled>
                    <mat-icon>timer</mat-icon>
                  </button>
                } @else {
                  <button class="card-act-btn"
                          matTooltip="Démarrer le minuteur"
                          (click)="startTaskTimer(task)">
                    <mat-icon>play_circle</mat-icon>
                  </button>
                }
              </div>

            </div>
          }

          @if (tasksForCol(col.id).length === 0) {
            <div class="col-empty">
              <mat-icon>inbox</mat-icon>
              <span>Aucune tâche</span>
            </div>
          }

        </div>

        <!-- Ajouter dans cette colonne -->
        <button class="col-add-btn" (click)="newTaskInCol(col.id)">
          <mat-icon>add</mat-icon> Ajouter une tâche
        </button>

      </div>
    }
  </div>

</div>
  `,
  styles: [`
    .page { display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden; }

    /* Header */
    .pg-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:20px 24px 16px; flex-shrink:0;
      border-bottom:1px solid #e2e8f0;
      background:#fff;
    }
    .pg-header__left { display:flex; align-items:center; gap:12px; }
    .pg-icon {
      width:44px; height:44px; border-radius:12px; flex-shrink:0;
      background:linear-gradient(135deg,#0891b2,#0e7490);
      box-shadow:0 4px 14px rgba(8,145,178,.35);
      display:flex; align-items:center; justify-content:center;
    }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub   { font-size:13px; color:#64748b; margin:2px 0 0; }

    .header-actions { display:flex; align-items:center; gap:8px; }
    .hdr-select {
      height:36px; border:1px solid #e2e8f0; border-radius:7px;
      padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none;
    }
    .hdr-select:focus { border-color:#06b6d4; box-shadow:0 0 0 3px rgba(6,182,212,.12); }
    .btn-new {
      display:flex; align-items:center; gap:6px;
      height:36px; padding:0 16px;
      background:linear-gradient(135deg,#0891b2,#0e7490); color:#fff;
      border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;
      box-shadow:0 3px 10px rgba(8,145,178,.35); transition:box-shadow .2s;
    }
    .btn-new:hover { box-shadow:0 5px 18px rgba(8,145,178,.5); }
    .btn-new mat-icon { font-size:18px; width:18px; height:18px; }

    /* Loading bar */
    .loading-bar { height:3px; background:#e2e8f0; flex-shrink:0; overflow:hidden; }
    .loading-bar__fill {
      height:100%; width:40%;
      background:linear-gradient(90deg,#06b6d4,#22d3ee);
      animation:loadSlide 1.2s ease-in-out infinite;
    }
    @keyframes loadSlide { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }

    /* Board */
    .kanban-board {
      display:flex; gap:14px; padding:18px 20px 20px;
      overflow-x:auto; overflow-y:hidden;
      flex:1; min-height:0; align-items:flex-start;
    }
    .kanban-board::-webkit-scrollbar { height:6px; }
    .kanban-board::-webkit-scrollbar-track { background:#f1f5f9; border-radius:3px; }
    .kanban-board::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px; }

    /* Colonne */
    .kanban-col {
      flex-shrink:0; width:270px;
      display:flex; flex-direction:column; gap:0;
      background:#f8fafc; border-radius:12px;
      border:1px solid #e2e8f0;
      max-height:calc(100vh - 180px);
    }
    .col-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 12px 10px;
      border-top:3px solid; border-radius:12px 12px 0 0;
      background:#fff; border-bottom:1px solid #f1f5f9;
      flex-shrink:0;
    }
    .col-header__left { display:flex; align-items:center; gap:6px; }
    .col-icon { font-size:16px; width:16px; height:16px; }
    .col-label { font-size:13px; font-weight:700; color:#0f172a; }
    .col-count {
      font-size:11px; font-weight:700; padding:2px 8px;
      border-radius:20px; min-width:22px; text-align:center;
    }

    /* Corps colonne */
    .col-body {
      flex:1; overflow-y:auto; padding:10px 8px 8px;
      display:flex; flex-direction:column; gap:8px;
      min-height:80px;
    }
    .col-body--empty { border:2px dashed #e2e8f0; border-radius:0 0 12px 12px; margin:6px; }
    .col-body::-webkit-scrollbar { width:4px; }
    .col-body::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:2px; }

    .col-empty {
      display:flex; flex-direction:column; align-items:center;
      padding:24px 12px; color:#cbd5e1; gap:6px;
    }
    .col-empty mat-icon { font-size:28px; width:28px; height:28px; opacity:.5; }
    .col-empty span { font-size:12px; }

    /* Ajouter dans colonne */
    .col-add-btn {
      display:flex; align-items:center; gap:4px; justify-content:center;
      margin:6px 8px 8px; padding:7px 0;
      border:1.5px dashed #cbd5e1; border-radius:8px;
      background:none; color:#94a3b8; font-size:12px; cursor:pointer;
      transition:all .15s; flex-shrink:0;
    }
    .col-add-btn mat-icon { font-size:15px; width:15px; height:15px; }
    .col-add-btn:hover { border-color:#06b6d4; color:#0891b2; background:#ecfeff; }

    /* Carte kanban */
    .kanban-card {
      background:#fff; border:1px solid #e8ecf0; border-radius:10px;
      padding:11px 12px; cursor:grab;
      box-shadow:0 1px 3px rgba(0,0,0,.06);
      transition:box-shadow .15s, transform .12s;
      position:relative;
    }
    .kanban-card:hover { box-shadow:0 4px 12px rgba(0,0,0,.1); transform:translateY(-1px); }
    .kanban-card:active { cursor:grabbing; }
    .kanban-card--haute { border-left:3px solid #ef4444; }

    .card-top { display:flex; align-items:center; gap:5px; margin-bottom:7px; flex-wrap:wrap; }
    .card-prio {
      font-size:10px; font-weight:700; padding:2px 7px; border-radius:20px;
      text-transform:uppercase; letter-spacing:.04em;
    }
    .prio-HAUTE   { background:#fee2e2; color:#dc2626; }
    .prio-NORMALE { background:#f1f5f9; color:#475569; }
    .prio-BASSE   { background:#f0fdf4; color:#15803d; }
    .card-type {
      font-size:10px; padding:2px 6px; border-radius:4px;
      background:#f0f4ff; color:#4f46e5; font-weight:600;
    }
    .card-fact {
      font-size:10px; font-weight:800; color:#15803d;
      background:#dcfce7; padding:1px 5px; border-radius:4px; margin-left:auto;
    }

    .card-title {
      font-size:13px; font-weight:600; color:#0f172a;
      margin:0 0 6px; line-height:1.35;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
    }

    .card-client {
      display:flex; align-items:center; gap:4px;
      font-size:11.5px; color:#64748b; margin-bottom:8px;
    }
    .card-client mat-icon { font-size:12px; width:12px; height:12px; }

    .card-footer { display:flex; align-items:center; justify-content:space-between; margin-top:4px; }
    .card-assignee { display:flex; }
    .assignee-avatar {
      width:26px; height:26px; border-radius:50%;
      background:linear-gradient(135deg,#0891b2,#0e7490);
      color:#fff; font-size:10px; font-weight:700;
      display:flex; align-items:center; justify-content:center;
    }
    .assignee-avatar--none { background:#e2e8f0; color:#94a3b8; }

    .card-meta { display:flex; align-items:center; gap:8px; }
    .card-date {
      display:flex; align-items:center; gap:2px;
      font-size:11px; color:#64748b;
    }
    .card-date mat-icon { font-size:11px; width:11px; height:11px; }
    .card-date--late { color:#dc2626; font-weight:600; }
    .card-time {
      display:flex; align-items:center; gap:2px;
      font-size:11px; color:#7c3aed; font-weight:600; font-family:monospace;
    }
    .card-time mat-icon { font-size:11px; width:11px; height:11px; }

    .card-actions {
      display:none; position:absolute; top:8px; right:8px;
      gap:3px;
    }
    .kanban-card:hover .card-actions { display:flex; }
    .card-act-btn {
      width:24px; height:24px; border:none; border-radius:5px;
      background:#f1f5f9; color:#64748b; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      transition:all .12s;
    }
    .card-act-btn:hover { background:#e0f2fe; color:#0891b2; }
    .card-act-btn mat-icon { font-size:13px; width:13px; height:13px; }
    .card-act-btn--timer-on { background:#fee2e2 !important; color:#ef4444 !important; animation:kpulse 1.5s ease-in-out infinite; }
    @keyframes kpulse { 0%,100%{opacity:1} 50%{opacity:.5} }
  `],
})
export class TravailKanbanComponent implements OnInit, OnDestroy {
  private tasksSvc  = inject(TasksService);
  private clientsSvc = inject(ClientsService);
  private usersSvc  = inject(UsersService);
  readonly timerSvc  = inject(TimerService);
  private _d$ = new Subject<void>();

  loading   = signal(true);
  allTasks  = signal<Task[]>([]);
  clients: Client[] = [];
  users: User[]     = [];
  columns = COLUMNS;

  filterCollab = '';
  filterClient = '';
  filterPrio   = '';

  private draggedTask: Task | null = null;

  ngOnInit() {
    this.clientsSvc.getAll().pipe(takeUntil(this._d$)).subscribe(c => this.clients = c);
    this.usersSvc.getAll().pipe(takeUntil(this._d$)).subscribe(u => this.users = u);
    this.reload();
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }

  reload() {
    this.loading.set(true);
    this.tasksSvc.getAllGlobal().pipe(takeUntil(this._d$)).subscribe({
      next: tasks => {
        let filtered = tasks;
        if (this.filterCollab) filtered = filtered.filter(t => t.assignee?.id === +this.filterCollab);
        if (this.filterClient) filtered = filtered.filter(t => t.clientId     === +this.filterClient);
        if (this.filterPrio)   filtered = filtered.filter(t => t.priorite     === this.filterPrio);
        this.allTasks.set(filtered);
        this.loading.set(false);
      },
      error: () => { this.allTasks.set([]); this.loading.set(false); },
    });
  }

  tasksForCol(colId: string): Task[] {
    return this.allTasks().filter(t => (t.statut ?? 'A_FAIRE') === colId);
  }

  onDragStart(event: DragEvent, task: Task) {
    this.draggedTask = task;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(task.id));
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onDrop(event: DragEvent, newStatut: string) {
    event.preventDefault();
    if (!this.draggedTask || this.draggedTask.statut === newStatut) return;
    const task = this.draggedTask;
    this.draggedTask = null;
    // Optimistic update
    this.allTasks.update(tasks => tasks.map(t => t.id === task.id ? { ...t, statut: newStatut as any } : t));
    this.tasksSvc.update(task.clientId, task.id, { statut: newStatut as any }).pipe(takeUntil(this._d$)).subscribe({
      error: () => this.reload(), // rollback on error
    });
  }

  newTask()            { /* TODO: ouvrir dialog création */ }
  newTaskInCol(statut: string) { /* TODO: ouvrir dialog avec statut pré-rempli */ }

  initials(nom: string): string {
    return nom.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }

  isLate(dateStr: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  formatDate(d: string): string {
    if (!d) return '—';
    const [y, m, day] = d.split('T')[0].split('-');
    return `${day}/${m}`;
  }

  startTaskTimer(task: Task) {
    this.timerSvc.startWithTask({
      taskId:    task.id,
      clientId:  task.client?.id,
      clientNom: task.client?.nom,
      taskTitre: task.titre,
    });
  }
}
