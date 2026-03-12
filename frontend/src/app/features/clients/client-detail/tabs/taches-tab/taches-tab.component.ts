import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TasksService, Task, TaskStatut } from '../../../../../core/services/tasks.service';

@Component({
  selector: 'app-taches-tab',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <div class="tab-content">

      <!-- Header -->
      <div class="tab-header">
        <div class="tab-header__info">
          <span class="task-count">{{ tasks.length }} tâche{{ tasks.length !== 1 ? 's' : '' }}</span>
        </div>
        <a mat-flat-button class="btn-manage" routerLink="/tasks">
          <mat-icon>open_in_new</mat-icon> Gérer les tâches
        </a>
      </div>

      <!-- Colonnes Kanban -->
      <div class="kanban">
        @for (col of columns; track col.statut) {
          <div class="kanban-col">
            <div class="kanban-col__header" [class]="'header-' + col.statut.toLowerCase()">
              <mat-icon>{{ col.icon }}</mat-icon>
              <span>{{ col.label }}</span>
              <span class="kanban-count">{{ getByStatut(col.statut).length }}</span>
            </div>
            <div class="kanban-col__body">
              @for (t of getByStatut(col.statut); track t.id) {
                <div class="task-card" [class]="'prio-' + t.priorite.toLowerCase()">
                  <div class="task-card__header">
                    <span class="task-titre">{{ t.titre }}</span>
                    <div class="task-actions">
                      @if (t.statut !== 'TERMINEE') {
                        <button mat-icon-button class="btn-next"
                                [matTooltip]="t.statut === 'A_FAIRE' ? 'Démarrer' : 'Terminer'"
                                (click)="advance(t)">
                          <mat-icon>{{ t.statut === 'A_FAIRE' ? 'play_arrow' : 'check_circle' }}</mat-icon>
                        </button>
                      }
                      <button mat-icon-button class="btn-del" matTooltip="Supprimer" (click)="remove(t)">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </div>
                  @if (t.description) {
                    <p class="task-desc">{{ t.description }}</p>
                  }
                  <div class="task-meta">
                    <span class="prio-badge prio-{{ t.priorite.toLowerCase() }}">{{ prioLabel(t.priorite) }}</span>
                    @if (t.assignee) {
                      <span class="task-assignee">
                        <mat-icon>person</mat-icon>{{ t.assignee.firstName }} {{ t.assignee.lastName }}
                      </span>
                    }
                    @if (t.dateEcheance) {
                      <span class="task-date" [class.overdue]="isOverdue(t)">
                        <mat-icon>event</mat-icon>{{ t.dateEcheance | date:'dd/MM/yy' }}
                      </span>
                    }
                  </div>
                </div>
              }
              @if (getByStatut(col.statut).length === 0) {
                <div class="col-empty">Aucune tâche</div>
              }
            </div>
          </div>
        }
      </div>

      @if (tasks.length === 0) {
        <div class="empty-state">
          <mat-icon>task_alt</mat-icon>
          <p>Aucune tâche pour ce dossier</p>
          <a mat-stroked-button routerLink="/tasks" class="btn-goto">
            <mat-icon>add</mat-icon> Créer une tâche
          </a>
        </div>
      }
    </div>
  `,
  styles: [`
    .tab-content { padding: 24px; }

    .tab-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .task-count { font-size: 13px; color: #64748b; font-weight: 500; }
    .btn-manage { border-radius: 10px !important; font-weight: 600; background: linear-gradient(135deg, #6366f1, #4f46e5) !important; color: white !important; gap: 6px; font-size: 13px; }

    /* Kanban */
    .kanban { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .kanban-col { background: #f8fafc; border-radius: 14px; border: 1px solid #e8ecf0; overflow: hidden; }
    .kanban-col__header { display: flex; align-items: center; gap: 8px; padding: 14px 16px; font-size: 13px; font-weight: 700; }
    .kanban-col__header mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .kanban-count { margin-left: auto; background: rgba(255,255,255,0.5); border-radius: 20px; padding: 1px 8px; font-size: 12px; }
    .header-a_faire { background: #eff6ff; color: #1d4ed8; }
    .header-en_cours { background: #fffbeb; color: #d97706; }
    .header-terminee { background: #f0fdf4; color: #15803d; }
    .kanban-col__body { padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 80px; }
    .col-empty { text-align: center; padding: 24px 0; font-size: 13px; color: #cbd5e1; }

    /* Task card */
    .task-card { background: white; border-radius: 10px; padding: 14px; border: 1px solid #e8ecf0; border-left: 3px solid #e8ecf0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .task-card.prio-haute { border-left-color: #ef4444; }
    .task-card.prio-normale { border-left-color: #f59e0b; }
    .task-card.prio-basse { border-left-color: #22c55e; }
    .task-card__header { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
    .task-titre { font-size: 13px; font-weight: 600; color: #1e293b; flex: 1; line-height: 1.4; }
    .task-actions { display: flex; flex-shrink: 0; }
    .btn-next { color: #6366f1 !important; width: 28px !important; height: 28px !important; }
    .btn-del { color: #cbd5e1 !important; width: 28px !important; height: 28px !important; }
    .btn-del:hover { color: #f87171 !important; }
    ::ng-deep .btn-next .mat-icon, ::ng-deep .btn-del .mat-icon { font-size: 18px !important; width: 18px !important; height: 18px !important; }
    .task-desc { font-size: 12px; color: #64748b; margin: 0 0 8px; line-height: 1.4; }
    .task-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .prio-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
    .prio-badge.prio-haute { background: #fee2e2; color: #dc2626; }
    .prio-badge.prio-normale { background: #fef3c7; color: #d97706; }
    .prio-badge.prio-basse { background: #dcfce7; color: #15803d; }
    .task-assignee, .task-date { display: flex; align-items: center; gap: 3px; font-size: 11px; color: #64748b; }
    .task-assignee mat-icon, .task-date mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .task-date.overdue { color: #dc2626; font-weight: 600; }

    /* Empty state */
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; gap: 12px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: #cbd5e1; }
    .empty-state p { font-size: 14px; color: #94a3b8; margin: 0; }
    .btn-goto { border-radius: 10px !important; color: #6366f1; border-color: #6366f1 !important; }
  `],
})
export class TachesTabComponent implements OnInit {
  @Input() clientId!: number;
  private tasksService = inject(TasksService);
  private snack = inject(MatSnackBar);

  tasks: Task[] = [];

  columns = [
    { statut: 'A_FAIRE' as TaskStatut, label: 'À faire', icon: 'radio_button_unchecked' },
    { statut: 'EN_COURS' as TaskStatut, label: 'En cours', icon: 'timelapse' },
    { statut: 'TERMINEE' as TaskStatut, label: 'Terminées', icon: 'check_circle' },
  ];

  ngOnInit() {
    this.load();
  }

  load() {
    this.tasksService.getAll(this.clientId).subscribe(t => this.tasks = t);
  }

  getByStatut(statut: TaskStatut): Task[] {
    return this.tasks.filter(t => t.statut === statut);
  }

  advance(t: Task) {
    const next = t.statut === 'A_FAIRE' ? 'EN_COURS' : 'TERMINEE';
    this.tasksService.update(this.clientId, t.id, { statut: next }).subscribe(() => this.load());
  }

  remove(t: Task) {
    this.tasksService.delete(this.clientId, t.id).subscribe(() => {
      this.load();
      this.snack.open('Tâche supprimée', 'OK', { duration: 2000 });
    });
  }

  isOverdue(t: Task): boolean {
    if (!t.dateEcheance || t.statut === 'TERMINEE') return false;
    return new Date(t.dateEcheance) < new Date();
  }

  prioLabel(p: string) {
    if (p === 'HAUTE') return '🔴 Haute';
    if (p === 'BASSE') return '🟢 Basse';
    return '🟡 Normale';
  }
}
