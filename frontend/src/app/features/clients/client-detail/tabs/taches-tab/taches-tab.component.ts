import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TasksService, Task, TaskStatut } from '../../../../../core/services/tasks.service';
import { UsersService } from '../../../../../core/services/users.service';
import { User } from '../../../../../core/models/user.model';

@Component({
  selector: 'app-taches-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <div class="tab-content">

      <!-- Formulaire création -->
      <div class="create-card">
        <h3><mat-icon>add_task</mat-icon> Nouvelle tâche</h3>
        <form [formGroup]="form" (ngSubmit)="create()" class="create-form">
          <mat-form-field appearance="outline" class="f-titre">
            <mat-label>Titre de la tâche</mat-label>
            <input matInput formControlName="titre" placeholder="Ex: Relancer le client pour le relevé de mars" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="f-assignee">
            <mat-label>Assigner à</mat-label>
            <mat-select formControlName="assigneeId">
              <mat-option [value]="null">— Non assignée —</mat-option>
              @for (u of users; track u.id) {
                <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="f-priorite">
            <mat-label>Priorité</mat-label>
            <mat-select formControlName="priorite">
              <mat-option value="BASSE">🟢 Basse</mat-option>
              <mat-option value="NORMALE">🟡 Normale</mat-option>
              <mat-option value="HAUTE">🔴 Haute</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="f-echeance">
            <mat-label>Échéance</mat-label>
            <input matInput type="date" formControlName="dateEcheance" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="f-desc">
            <mat-label>Description (optionnel)</mat-label>
            <textarea matInput formControlName="description" rows="2"></textarea>
          </mat-form-field>
          <div class="f-submit">
            <button mat-flat-button class="btn-create" type="submit" [disabled]="form.invalid">
              <mat-icon>add</mat-icon> Créer
            </button>
          </div>
        </form>
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
                        <button mat-icon-button class="btn-next" [matTooltip]="t.statut === 'A_FAIRE' ? 'Démarrer' : 'Terminer'"
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
                  @if (t.createdBy) {
                    <div class="task-created-by">Créée par {{ t.createdBy.firstName }} {{ t.createdBy.lastName }}</div>
                  }
                </div>
              }
              @if (getByStatut(col.statut).length === 0) {
                <div class="col-empty">Aucune tâche</div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .tab-content { padding: 24px; }

    /* Create form */
    .create-card { background: white; border: 1px solid #e8ecf0; border-radius: 14px; padding: 20px 24px; margin-bottom: 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    .create-card h3 { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 16px; }
    .create-card h3 mat-icon { color: #6366f1; font-size: 18px; width: 18px; height: 18px; }
    .create-form { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; align-items: start; }
    .f-titre { grid-column: 1 / 2; }
    .f-assignee { grid-column: 2 / 3; }
    .f-priorite { grid-column: 3 / 4; }
    .f-echeance { grid-column: 4 / 5; }
    .f-desc { grid-column: 1 / 4; }
    .f-submit { grid-column: 4 / 5; padding-top: 4px; }
    .btn-create { width: 100%; border-radius: 10px !important; font-weight: 600; background: linear-gradient(135deg, #6366f1, #4f46e5) !important; color: white !important; }

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
    .task-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px; }
    .prio-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
    .prio-badge.prio-haute { background: #fee2e2; color: #dc2626; }
    .prio-badge.prio-normale { background: #fef3c7; color: #d97706; }
    .prio-badge.prio-basse { background: #dcfce7; color: #15803d; }
    .task-assignee, .task-date { display: flex; align-items: center; gap: 3px; font-size: 11px; color: #64748b; }
    .task-assignee mat-icon, .task-date mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .task-date.overdue { color: #dc2626; font-weight: 600; }
    .task-created-by { font-size: 10px; color: #94a3b8; }
  `],
})
export class TachesTabComponent implements OnInit {
  @Input() clientId!: number;
  private tasksService = inject(TasksService);
  private usersService = inject(UsersService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  tasks: Task[] = [];
  users: User[] = [];

  columns = [
    { statut: 'A_FAIRE' as TaskStatut, label: 'À faire', icon: 'radio_button_unchecked' },
    { statut: 'EN_COURS' as TaskStatut, label: 'En cours', icon: 'timelapse' },
    { statut: 'TERMINEE' as TaskStatut, label: 'Terminées', icon: 'check_circle' },
  ];

  form = this.fb.group({
    titre: ['', Validators.required],
    description: [''],
    priorite: ['NORMALE'],
    dateEcheance: [''],
    assigneeId: [null as number | null],
  });

  ngOnInit() {
    this.load();
    this.usersService.getAll().subscribe(u => this.users = u);
  }

  load() {
    this.tasksService.getAll(this.clientId).subscribe(t => this.tasks = t);
  }

  getByStatut(statut: TaskStatut): Task[] {
    return this.tasks.filter(t => t.statut === statut);
  }

  create() {
    if (this.form.invalid) return;
    const v = this.form.value;
    this.tasksService.create(this.clientId, {
      titre: v.titre!,
      description: v.description || undefined,
      priorite: v.priorite as any,
      dateEcheance: v.dateEcheance || undefined,
      assigneeId: v.assigneeId || undefined,
    }).subscribe(() => {
      this.load();
      this.form.reset({ priorite: 'NORMALE', assigneeId: null });
      this.snack.open('Tâche créée', 'OK', { duration: 2000 });
    });
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
