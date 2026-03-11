import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { TasksService, Task, TaskStatut, TaskDashboard } from '../../core/services/tasks.service';
import { ClientsService } from '../../core/services/clients.service';
import { UsersService } from '../../core/services/users.service';
import { Client } from '../../core/models/client.model';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-tasks-global',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSnackBarModule, MatTooltipModule, MatTabsModule,
  ],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-header">
        <div class="page-header__left">
          <mat-icon class="page-icon">task_alt</mat-icon>
          <div>
            <h1>Tâches</h1>
            <p>{{ tasks.length }} tâche{{ tasks.length !== 1 ? 's' : '' }} au total</p>
          </div>
        </div>
        <button mat-flat-button class="btn-new" (click)="showForm = !showForm">
          <mat-icon>{{ showForm ? 'close' : 'add' }}</mat-icon>
          {{ showForm ? 'Annuler' : 'Nouvelle tâche' }}
        </button>
      </div>

      <!-- Formulaire création -->
      @if (showForm) {
        <div class="create-panel">
          <h3><mat-icon>add_task</mat-icon> Nouvelle tâche</h3>
          <form [formGroup]="form" (ngSubmit)="create()" class="create-form">
            <mat-form-field appearance="outline" class="f-client">
              <mat-label>Dossier client</mat-label>
              <mat-select formControlName="clientId">
                @for (c of clients; track c.id) {
                  <mat-option [value]="c.id">{{ c.nom }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="f-type">
              <mat-label>Type</mat-label>
              <mat-select formControlName="type">
                @for (t of taskTypes; track t.value) {
                  <mat-option [value]="t.value">{{ t.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="f-titre">
              <mat-label>Titre / Description courte</mat-label>
              <input matInput formControlName="titre" />
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
            <div class="f-submit">
              <button mat-flat-button class="btn-create" type="submit" [disabled]="form.invalid">
                <mat-icon>add</mat-icon> Créer
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Onglets -->
      <mat-tab-group [(selectedIndex)]="activeTab" class="tabs">

        <!-- Onglet Kanban -->
        <mat-tab label="Kanban">

          <!-- Filtres -->
          <div class="filters">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Dossier</mat-label>
              <mat-select [(ngModel)]="filterClientId" (ngModelChange)="applyFilter()">
                <mat-option [value]="null">Tous</mat-option>
                @for (c of clients; track c.id) {
                  <mat-option [value]="c.id">{{ c.nom }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Assigné à</mat-label>
              <mat-select [(ngModel)]="filterAssigneeId" (ngModelChange)="applyFilter()">
                <mat-option [value]="null">Tous</mat-option>
                @for (u of users; track u.id) {
                  <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="filterType" (ngModelChange)="applyFilter()">
                <mat-option [value]="null">Tous</mat-option>
                @for (t of taskTypes; track t.value) {
                  <mat-option [value]="t.value">{{ t.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            @if (filterClientId || filterAssigneeId || filterType) {
              <button mat-stroked-button class="btn-reset" (click)="resetFilters()">
                <mat-icon>clear</mat-icon> Réinitialiser
              </button>
            }
            <span class="filter-count">{{ filteredTasks.length }} tâche{{ filteredTasks.length !== 1 ? 's' : '' }}</span>
          </div>

          <!-- Kanban 5 colonnes -->
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
                      @if (t.client) {
                        <a class="client-badge" [routerLink]="['/clients', t.client.id]">
                          <mat-icon>folder_open</mat-icon>{{ t.client.nom }}
                        </a>
                      }
                      <div class="task-card__header">
                        <div class="task-top">
                          @if (t.taskId) { <span class="task-id">{{ t.taskId }}</span> }
                          @if (t.type) { <span class="type-badge type-{{ t.type.toLowerCase() }}">{{ t.type }}</span> }
                        </div>
                        <div class="task-actions">
                          @if (t.statut === 'A_FAIRE') {
                            <button mat-icon-button class="btn-next" matTooltip="Démarrer" (click)="changeStatut(t, 'EN_COURS')">
                              <mat-icon>play_arrow</mat-icon>
                            </button>
                          }
                          @if (t.statut === 'EN_COURS') {
                            <button mat-icon-button class="btn-next" matTooltip="Terminer" (click)="changeStatut(t, 'TERMINEE')">
                              <mat-icon>check_circle</mat-icon>
                            </button>
                          }
                          <button mat-icon-button class="btn-del" matTooltip="Supprimer" (click)="remove(t)">
                            <mat-icon>delete_outline</mat-icon>
                          </button>
                        </div>
                      </div>
                      <div class="task-titre">{{ t.titre }}</div>
                      @if (t.description) { <p class="task-desc">{{ t.description }}</p> }
                      <div class="task-meta">
                        <span class="prio-badge prio-{{ t.priorite.toLowerCase() }}">{{ prioLabel(t.priorite) }}</span>
                        @if (t.assignee) {
                          <span class="task-assignee"><mat-icon>person</mat-icon>{{ t.assignee.firstName }} {{ t.assignee.lastName }}</span>
                        }
                        @if (t.dateEcheance) {
                          <span class="task-date" [class.overdue]="isOverdue(t)"><mat-icon>event</mat-icon>{{ t.dateEcheance | date:'dd/MM/yy' }}</span>
                        }
                        @if (t.tempsExecution && t.tempsExecution > 0) {
                          <span class="task-time"><mat-icon>timer</mat-icon>{{ formatTime(t.tempsExecution) }}</span>
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
        </mat-tab>

        <!-- Onglet Dashboard -->
        <mat-tab label="Dashboard">
          <div class="dashboard">
            <!-- Filtre semaine -->
            <div class="dash-filters">
              <mat-form-field appearance="outline" class="filter-field">
                <mat-label>Semaine</mat-label>
                <input matInput type="number" [(ngModel)]="dashSemaine" (ngModelChange)="loadDashboard()" min="1" max="53" />
              </mat-form-field>
              <button mat-stroked-button (click)="dashSemaine = currentWeek; loadDashboard()">
                Semaine actuelle ({{ currentWeek }})
              </button>
            </div>

            @if (dashboard) {
              <!-- KPIs -->
              <div class="kpis">
                <div class="kpi">
                  <div class="kpi__value">{{ dashboard.total }}</div>
                  <div class="kpi__label">Tâches total</div>
                </div>
                <div class="kpi kpi-green">
                  <div class="kpi__value">{{ dashboard.terminees }}</div>
                  <div class="kpi__label">Terminées</div>
                </div>
                <div class="kpi kpi-blue">
                  <div class="kpi__value">{{ dashboard.enCours }}</div>
                  <div class="kpi__label">En cours</div>
                </div>
                <div class="kpi kpi-red">
                  <div class="kpi__value">{{ dashboard.nonFait }}</div>
                  <div class="kpi__label">Non faites</div>
                </div>
                <div class="kpi kpi-orange">
                  <div class="kpi__value">{{ dashboard.tauxCompletion }}%</div>
                  <div class="kpi__label">Taux complétion</div>
                </div>
                <div class="kpi kpi-purple">
                  <div class="kpi__value">{{ dashboard.tempsMoyen }} min</div>
                  <div class="kpi__label">Temps moyen</div>
                </div>
              </div>

              <div class="dash-grid">
                <!-- Par collaborateur -->
                <div class="dash-card">
                  <h3><mat-icon>people</mat-icon> Par collaborateur</h3>
                  <table class="dash-table">
                    <thead><tr><th>Collaborateur</th><th>Total</th><th>Terminées</th><th>Temps total</th></tr></thead>
                    <tbody>
                      @for (c of dashboard.parCollaborateur; track c.name) {
                        <tr>
                          <td>{{ c.name }}</td>
                          <td>{{ c.total }}</td>
                          <td>
                            <span class="completion-bar">
                              <span class="completion-fill" [style.width.%]="c.total > 0 ? (c.terminees / c.total * 100) : 0"></span>
                            </span>
                            {{ c.terminees }}
                          </td>
                          <td>{{ formatTime(c.tempsTotal) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Par type -->
                <div class="dash-card">
                  <h3><mat-icon>category</mat-icon> Par type de tâche</h3>
                  <div class="type-stats">
                    @for (t of dashboard.parType; track t.type) {
                      <div class="type-stat-row">
                        <span class="type-badge type-{{ t.type.toLowerCase() }}">{{ t.type }}</span>
                        <div class="type-bar-wrap">
                          <div class="type-bar" [style.width.%]="dashboard.total > 0 ? (t.count / dashboard.total * 100) : 0"></div>
                        </div>
                        <span class="type-count">{{ t.count }}</span>
                      </div>
                    }
                  </div>
                </div>
              </div>
            } @else {
              <div class="dash-empty">
                <mat-icon>bar_chart</mat-icon>
                <p>Sélectionne une semaine pour voir les statistiques</p>
              </div>
            }
          </div>
        </mat-tab>

      </mat-tab-group>

    </div>
  `,
  styles: [`
    .page { padding: 32px; max-width: 1600px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .page-header__left { display: flex; align-items: center; gap: 16px; }
    .page-icon { font-size: 32px; width: 32px; height: 32px; color: #6366f1; }
    .page-header h1 { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2; }
    .page-header p { font-size: 13px; color: #94a3b8; margin: 0; }
    .btn-new { border-radius: 10px !important; font-weight: 600; background: linear-gradient(135deg, #6366f1, #4f46e5) !important; color: white !important; gap: 6px; }

    /* Create panel */
    .create-panel { background: white; border: 1px solid #e8ecf0; border-radius: 14px; padding: 20px 24px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    .create-panel h3 { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 16px; }
    .create-panel h3 mat-icon { color: #6366f1; font-size: 18px; width: 18px; height: 18px; }
    .create-form { display: grid; grid-template-columns: 1.2fr 0.8fr 2fr 1fr 0.8fr 0.9fr 0.7fr; gap: 12px; align-items: start; }
    .f-client { grid-column: 1; }
    .f-type { grid-column: 2; }
    .f-titre { grid-column: 3; }
    .f-assignee { grid-column: 4; }
    .f-priorite { grid-column: 5; }
    .f-echeance { grid-column: 6; }
    .f-submit { grid-column: 7; padding-top: 4px; }
    .btn-create { width: 100%; border-radius: 10px !important; font-weight: 600; background: linear-gradient(135deg, #6366f1, #4f46e5) !important; color: white !important; }

    /* Tabs */
    .tabs { margin-top: 0; }

    /* Filters */
    .filters { display: flex; align-items: center; gap: 10px; padding: 16px 0 8px; flex-wrap: wrap; }
    .filter-field { max-width: 180px; }
    .btn-reset { border-radius: 8px !important; font-size: 13px; color: #64748b; border-color: #e2e8f0 !important; }
    .filter-count { margin-left: auto; font-size: 13px; color: #94a3b8; font-weight: 500; }

    /* Kanban */
    .kanban { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; padding: 8px 0 24px; }
    .kanban-col { background: #f8fafc; border-radius: 14px; border: 1px solid #e8ecf0; overflow: hidden; min-width: 0; }
    .kanban-col__header { display: flex; align-items: center; gap: 6px; padding: 12px 14px; font-size: 12px; font-weight: 700; }
    .kanban-col__header mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .kanban-count { margin-left: auto; background: rgba(255,255,255,0.6); border-radius: 20px; padding: 1px 7px; font-size: 11px; }
    .header-a_faire { background: #eff6ff; color: #1d4ed8; }
    .header-en_cours { background: #fffbeb; color: #d97706; }
    .header-terminee { background: #f0fdf4; color: #15803d; }
    .header-non_fait { background: #fff1f2; color: #e11d48; }
    .header-en_attente { background: #f5f3ff; color: #7c3aed; }
    .kanban-col__body { padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 80px; }
    .col-empty { text-align: center; padding: 20px 0; font-size: 12px; color: #cbd5e1; }

    /* Task card */
    .task-card { background: white; border-radius: 10px; padding: 10px 12px; border: 1px solid #e8ecf0; border-left: 3px solid #e8ecf0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .task-card.prio-haute { border-left-color: #ef4444; }
    .task-card.prio-normale { border-left-color: #f59e0b; }
    .task-card.prio-basse { border-left-color: #22c55e; }
    .client-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; color: #6366f1; background: #eef2ff; padding: 1px 7px; border-radius: 20px; margin-bottom: 5px; text-decoration: none; }
    .client-badge mat-icon { font-size: 10px; width: 10px; height: 10px; }
    .task-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 4px; margin-bottom: 4px; }
    .task-top { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; flex: 1; }
    .task-id { font-size: 10px; color: #94a3b8; font-family: monospace; }
    .task-actions { display: flex; flex-shrink: 0; }
    .btn-next { color: #6366f1 !important; width: 26px !important; height: 26px !important; }
    .btn-del { color: #cbd5e1 !important; width: 26px !important; height: 26px !important; }
    .btn-del:hover { color: #f87171 !important; }
    ::ng-deep .btn-next .mat-icon, ::ng-deep .btn-del .mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; }
    .task-titre { font-size: 12px; font-weight: 600; color: #1e293b; line-height: 1.4; margin-bottom: 4px; }
    .task-desc { font-size: 11px; color: #64748b; margin: 0 0 6px; line-height: 1.4; }
    .task-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
    .prio-badge { font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 20px; }
    .prio-badge.prio-haute { background: #fee2e2; color: #dc2626; }
    .prio-badge.prio-normale { background: #fef3c7; color: #d97706; }
    .prio-badge.prio-basse { background: #dcfce7; color: #15803d; }
    .task-assignee, .task-date, .task-time { display: flex; align-items: center; gap: 2px; font-size: 10px; color: #64748b; }
    .task-assignee mat-icon, .task-date mat-icon, .task-time mat-icon { font-size: 11px; width: 11px; height: 11px; }
    .task-date.overdue { color: #dc2626; font-weight: 600; }

    /* Type badges */
    .type-badge { font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 4px; }
    .type-tva { background: #fef9c3; color: #854d0e; }
    .type-paie { background: #dbeafe; color: #1e40af; }
    .type-achats { background: #fce7f3; color: #9d174d; }
    .type-ventes { background: #dcfce7; color: #14532d; }
    .type-rb { background: #f0fdf4; color: #15803d; }
    .type-gv { background: #ede9fe; color: #5b21b6; }
    .type-dr { background: #fff7ed; color: #c2410c; }
    .type-autre { background: #f1f5f9; color: #475569; }

    /* Dashboard */
    .dashboard { padding: 16px 0 24px; }
    .dash-filters { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 24px; }
    .kpi { background: white; border: 1px solid #e8ecf0; border-radius: 14px; padding: 18px 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .kpi__value { font-size: 28px; font-weight: 800; color: #1e293b; }
    .kpi__label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .kpi-green .kpi__value { color: #15803d; }
    .kpi-blue .kpi__value { color: #1d4ed8; }
    .kpi-red .kpi__value { color: #dc2626; }
    .kpi-orange .kpi__value { color: #d97706; }
    .kpi-purple .kpi__value { color: #7c3aed; }
    .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .dash-card { background: white; border: 1px solid #e8ecf0; border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .dash-card h3 { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #1e293b; margin: 0 0 16px; }
    .dash-card h3 mat-icon { font-size: 18px; width: 18px; height: 18px; color: #6366f1; }
    .dash-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .dash-table th { text-align: left; font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; padding: 0 0 10px; letter-spacing: 0.5px; }
    .dash-table td { padding: 8px 0; border-top: 1px solid #f1f5f9; color: #1e293b; }
    .completion-bar { display: inline-block; width: 60px; height: 6px; background: #e8ecf0; border-radius: 3px; vertical-align: middle; margin-right: 6px; overflow: hidden; }
    .completion-fill { display: block; height: 100%; background: #22c55e; border-radius: 3px; }
    .type-stats { display: flex; flex-direction: column; gap: 10px; }
    .type-stat-row { display: flex; align-items: center; gap: 10px; }
    .type-bar-wrap { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .type-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 4px; min-width: 2px; }
    .type-count { font-size: 13px; font-weight: 600; color: #1e293b; min-width: 20px; text-align: right; }
    .dash-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 0; color: #94a3b8; gap: 12px; }
    .dash-empty mat-icon { font-size: 48px; width: 48px; height: 48px; }
  `],
})
export class TasksGlobalComponent implements OnInit {
  private tasksService = inject(TasksService);
  private clientsService = inject(ClientsService);
  private usersService = inject(UsersService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  clients: Client[] = [];
  users: User[] = [];
  dashboard: TaskDashboard | null = null;

  showForm = false;
  activeTab = 0;
  filterClientId: number | null = null;
  filterAssigneeId: number | null = null;
  filterType: string | null = null;
  dashSemaine: number | null = null;

  get currentWeek(): number {
    const d = new Date();
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  taskTypes = [
    { value: 'TVA', label: 'TVA' },
    { value: 'PAIE', label: 'Paie' },
    { value: 'ACHATS', label: 'Achats' },
    { value: 'VENTES', label: 'Ventes' },
    { value: 'RB', label: 'Relevé Bancaire' },
    { value: 'GV', label: 'GV' },
    { value: 'DR', label: 'Dossier Révision' },
    { value: 'AUTRE', label: 'Autre' },
  ];

  columns = [
    { statut: 'A_FAIRE' as TaskStatut, label: 'À faire', icon: 'radio_button_unchecked' },
    { statut: 'EN_COURS' as TaskStatut, label: 'En cours', icon: 'timelapse' },
    { statut: 'TERMINEE' as TaskStatut, label: 'Terminées', icon: 'check_circle' },
    { statut: 'NON_FAIT' as TaskStatut, label: 'Non fait', icon: 'cancel' },
    { statut: 'EN_ATTENTE' as TaskStatut, label: 'En attente', icon: 'pause_circle' },
  ];

  form = this.fb.group({
    clientId: [null as number | null, Validators.required],
    titre: ['', Validators.required],
    type: ['AUTRE'],
    priorite: ['NORMALE'],
    dateEcheance: [''],
    assigneeId: [null as number | null],
  });

  ngOnInit() {
    this.load();
    this.clientsService.getAll().subscribe(c => this.clients = c);
    this.usersService.getAssignable().subscribe(u => this.users = u);
    this.dashSemaine = this.currentWeek;
    this.loadDashboard();
  }

  load() {
    this.tasksService.getAllGlobal().subscribe(t => {
      this.tasks = t;
      this.applyFilter();
    });
  }

  loadDashboard() {
    if (!this.dashSemaine) return;
    this.tasksService.getDashboard(this.dashSemaine).subscribe(d => this.dashboard = d);
  }

  applyFilter() {
    this.filteredTasks = this.tasks.filter(t => {
      if (this.filterClientId && t.clientId !== this.filterClientId) return false;
      if (this.filterAssigneeId && t.assignee?.id !== this.filterAssigneeId) return false;
      if (this.filterType && t.type !== this.filterType) return false;
      return true;
    });
  }

  resetFilters() {
    this.filterClientId = null;
    this.filterAssigneeId = null;
    this.filterType = null;
    this.applyFilter();
  }

  getByStatut(statut: TaskStatut): Task[] {
    return this.filteredTasks.filter(t => t.statut === statut);
  }

  create() {
    if (this.form.invalid) return;
    const v = this.form.value;
    this.tasksService.create(v.clientId!, {
      titre: v.titre!,
      type: v.type as any,
      priorite: v.priorite as any,
      dateEcheance: v.dateEcheance || undefined,
      assigneeId: v.assigneeId || undefined,
    }).subscribe(() => {
      this.load();
      this.form.reset({ priorite: 'NORMALE', type: 'AUTRE', assigneeId: null, clientId: null });
      this.showForm = false;
      this.snack.open('Tâche créée', 'OK', { duration: 2000 });
    });
  }

  changeStatut(t: Task, statut: TaskStatut) {
    this.tasksService.update(t.clientId, t.id, { statut }).subscribe(() => this.load());
  }

  remove(t: Task) {
    this.tasksService.delete(t.clientId, t.id).subscribe(() => {
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

  formatTime(minutes: number): string {
    if (!minutes || minutes <= 0) return '-';
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }
}
