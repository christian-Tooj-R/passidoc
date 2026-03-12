import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as XLSX from 'xlsx';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TasksService, Task, TaskStatut, TaskDashboard } from '../../core/services/tasks.service';
import { ClientsService } from '../../core/services/clients.service';
import { UsersService } from '../../core/services/users.service';
import { Client } from '../../core/models/client.model';
import { User } from '../../core/models/user.model';

// ─── Dialog Synthèse hebdomadaire ────────────────────────────────────────────
@Component({
  selector: 'app-synthese-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatDialogModule],
  template: `
    <div class="sd-header">
      <div class="sd-title">
        <mat-icon>insert_chart</mat-icon>
        <span>Rapport hebdomadaire — Semaine {{ semaine }}</span>
      </div>
      <div class="sd-week">
        <button mat-icon-button matTooltip="Semaine précédente" (click)="semaine = semaine - 1; load()">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="sd-week-num">S{{ semaine }}</span>
        <button mat-icon-button matTooltip="Semaine suivante" (click)="semaine = semaine + 1; load()" [disabled]="semaine >= currentWeek">
          <mat-icon>chevron_right</mat-icon>
        </button>
        <button mat-stroked-button class="sd-cur" (click)="semaine = currentWeek; load()">
          Actuelle
        </button>
      </div>
      <button mat-stroked-button class="sd-export" (click)="exportExcel()" [disabled]="!dashboard" matTooltip="Exporter en Excel">
        <mat-icon>download</mat-icon> Export Excel
      </button>
      <button mat-icon-button (click)="dialogRef.close()" class="sd-close">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="sd-body">
      @if (dashboard) {
        <!-- KPIs -->
        <div class="sd-kpis">
          <div class="sd-kpi">
            <span class="sd-kpi__val">{{ dashboard.total }}</span>
            <span class="sd-kpi__lbl">Tâches</span>
          </div>
          <div class="sd-kpi sd-green">
            <span class="sd-kpi__val">{{ dashboard.terminees }}</span>
            <span class="sd-kpi__lbl">Terminées</span>
          </div>
          <div class="sd-kpi sd-blue">
            <span class="sd-kpi__val">{{ dashboard.enCours }}</span>
            <span class="sd-kpi__lbl">En cours</span>
          </div>
          <div class="sd-kpi sd-red">
            <span class="sd-kpi__val">{{ dashboard.nonFait }}</span>
            <span class="sd-kpi__lbl">Non faites</span>
          </div>
          <div class="sd-kpi sd-orange">
            <span class="sd-kpi__val">{{ dashboard.tauxCompletion }}%</span>
            <span class="sd-kpi__lbl">Complétion</span>
          </div>
          <div class="sd-kpi sd-purple">
            <span class="sd-kpi__val">{{ formatTime(dashboard.tempsMoyen) }}</span>
            <span class="sd-kpi__lbl">Temps moyen</span>
          </div>
        </div>

        <div class="sd-grid">
          <!-- Par collaborateur -->
          <div class="sd-card">
            <h4><mat-icon>people</mat-icon> Par collaborateur</h4>
            <table class="sd-table">
              <thead><tr><th>Collaborateur</th><th>Total</th><th>Terminées</th><th>Temps</th></tr></thead>
              <tbody>
                @for (c of dashboard.parCollaborateur; track c.name) {
                  <tr>
                    <td>{{ c.name }}</td>
                    <td class="n">{{ c.total }}</td>
                    <td>
                      <span class="prog"><span class="prog-fill" [style.width.%]="c.total > 0 ? (c.terminees / c.total * 100) : 0"></span></span>
                      <span class="n">{{ c.terminees }}</span>
                    </td>
                    <td class="n">{{ formatTime(c.tempsTotal) }}</td>
                  </tr>
                }
                @if (dashboard.parCollaborateur.length === 0) {
                  <tr><td colspan="4" class="sd-empty-row">Aucune donnée</td></tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Par type -->
          <div class="sd-card">
            <h4><mat-icon>category</mat-icon> Par type de tâche</h4>
            <div class="type-rows">
              @for (t of dashboard.parType; track t.type) {
                <div class="type-row">
                  <span class="type-badge type-{{ t.type.toLowerCase() }}">{{ t.type }}</span>
                  <div class="type-bar-wrap">
                    <div class="type-bar" [style.width.%]="dashboard.total > 0 ? (t.count / dashboard.total * 100) : 0"></div>
                  </div>
                  <span class="n">{{ t.count }}</span>
                </div>
              }
              @if (dashboard.parType.length === 0) {
                <p class="sd-empty-row">Aucune donnée</p>
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="sd-loading">
          <mat-icon>hourglass_empty</mat-icon>
          <p>Chargement…</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; max-height: 90vh; }
    .sd-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid #e8ecf0; flex-shrink: 0; }
    .sd-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: #1e293b; flex: 1; }
    .sd-title mat-icon { color: #6366f1; font-size: 20px; width: 20px; height: 20px; }
    .sd-week { display: flex; align-items: center; gap: 4px; }
    .sd-week-num { font-size: 13px; font-weight: 700; color: #475569; min-width: 28px; text-align: center; }
    .sd-cur { font-size: 12px !important; border-color: #e2e8f0 !important; color: #64748b; border-radius: 8px !important; height: 32px; line-height: 32px; }
    .sd-export { font-size: 12px !important; border-color: #bbf7d0 !important; color: #15803d !important; border-radius: 8px !important; height: 32px; line-height: 32px; gap: 4px; }
    .sd-export mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .sd-close { color: #94a3b8 !important; }
    .sd-body { padding: 20px; overflow-y: auto; flex: 1; }
    .sd-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 20px; }
    .sd-kpi { background: #f8fafc; border: 1px solid #e8ecf0; border-radius: 10px; padding: 12px 14px; text-align: center; }
    .sd-kpi__val { display: block; font-size: 22px; font-weight: 800; color: #1e293b; line-height: 1.1; }
    .sd-kpi__lbl { display: block; font-size: 10.5px; color: #94a3b8; margin-top: 3px; }
    .sd-green .sd-kpi__val { color: #15803d; }
    .sd-blue  .sd-kpi__val { color: #1d4ed8; }
    .sd-red   .sd-kpi__val { color: #dc2626; }
    .sd-orange .sd-kpi__val { color: #d97706; }
    .sd-purple .sd-kpi__val { color: #7c3aed; }
    .sd-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
    .sd-card { background: #f8fafc; border: 1px solid #e8ecf0; border-radius: 10px; padding: 16px 18px; }
    .sd-card h4 { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; color: #1e293b; margin: 0 0 12px; }
    .sd-card h4 mat-icon { font-size: 16px; width: 16px; height: 16px; color: #6366f1; }
    .sd-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .sd-table th { text-align: left; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; padding: 0 8px 8px 0; letter-spacing: .4px; }
    .sd-table td { padding: 6px 8px 6px 0; border-top: 1px solid #e8ecf0; color: #1e293b; }
    .n { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    .prog { display: inline-block; width: 44px; height: 5px; background: #e8ecf0; border-radius: 3px; vertical-align: middle; margin-right: 6px; overflow: hidden; }
    .prog-fill { display: block; height: 100%; background: #22c55e; border-radius: 3px; }
    .type-rows { display: flex; flex-direction: column; gap: 8px; }
    .type-row { display: flex; align-items: center; gap: 8px; }
    .type-bar-wrap { flex: 1; height: 6px; background: #e8ecf0; border-radius: 3px; overflow: hidden; }
    .type-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 3px; min-width: 2px; }
    .type-badge { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; white-space: nowrap; min-width: 38px; text-align: center; }
    .type-tva    { background: #fef9c3; color: #854d0e; }
    .type-paie   { background: #dbeafe; color: #1e40af; }
    .type-achats { background: #fce7f3; color: #9d174d; }
    .type-ventes { background: #dcfce7; color: #14532d; }
    .type-rb     { background: #f0fdf4; color: #15803d; }
    .type-gv     { background: #ede9fe; color: #5b21b6; }
    .type-dr     { background: #fff7ed; color: #c2410c; }
    .type-autre  { background: #f1f5f9; color: #475569; }
    .sd-empty-row { text-align: center; color: #cbd5e1; font-size: 12px; padding: 12px 0; }
    .sd-loading { display: flex; flex-direction: column; align-items: center; padding: 48px; color: #94a3b8; gap: 8px; }
    .sd-loading mat-icon { font-size: 40px; width: 40px; height: 40px; }
  `],
})
export class SyntheseDialogComponent implements OnInit {
  private tasksService = inject(TasksService);
  dialogRef = inject(MatDialogRef<SyntheseDialogComponent>);

  dashboard: TaskDashboard | null = null;
  semaine!: number;

  get currentWeek(): number {
    const d = new Date();
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
    const ys = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return Math.ceil((((dt.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  }

  ngOnInit() {
    this.semaine = this.currentWeek;
    this.load();
  }

  load() {
    this.dashboard = null;
    this.tasksService.getDashboard(this.semaine).subscribe(d => this.dashboard = d);
  }

  exportExcel() {
    if (!this.dashboard) return;

    this.tasksService.getAllGlobal().subscribe(allTasks => {
      const tasks = allTasks.filter(t => t.semaine === this.semaine);
      const wb = XLSX.utils.book_new();
      const rows: any[][] = [];

      // ── Titre ──
      rows.push([`Rapport hebdomadaire – Semaine : ${this.semaine}`]);
      rows.push([]);

      // ── Tableau des tâches ──
      rows.push(['ID', 'DATE', 'HEURE DEBUT', 'COLLAB MADA', 'CLIENT', 'TACHE', 'TYPE', 'ATTRIBUE PAR', 'STATUT', 'HEURE FIN', 'TEMPS D\'EXECUTION (min)', 'SEMAINE']);
      for (const t of tasks) {
        rows.push([
          t.taskId ?? '',
          t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : '',
          t.heureDebut ?? '',
          t.assignee  ? `${t.assignee.firstName} ${t.assignee.lastName}` : '',
          t.client?.nom ?? '',
          t.titre,
          t.type ?? '',
          t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : '',
          this.statutLabelFr(t.statut),
          t.heureFin ?? '',
          t.tempsExecution ?? '',
          t.semaine ?? this.semaine,
        ]);
      }

      rows.push([]);

      // ── Indicateurs hebdomadaires ──
      rows.push(['Indicateurs hebdomadaires']);
      rows.push(['Total des tâches',    this.dashboard!.total]);
      rows.push(['Tâches terminées',    this.dashboard!.terminees]);
      rows.push(['Taux de complétion',  `${this.dashboard!.tauxCompletion}%`]);
      rows.push(['Temps moyen (min)',   this.dashboard!.tempsMoyen]);
      rows.push([]);

      // ── Par collaborateur ──
      rows.push(['Par collaborateur']);
      rows.push(['Collaborateur', 'Total', 'Terminées', 'Temps total (min)']);
      for (const c of this.dashboard!.parCollaborateur) {
        rows.push([c.name, c.total, c.terminees, c.tempsTotal]);
      }
      rows.push([]);

      // ── Par type ──
      rows.push(['Par type de tâche']);
      rows.push(['Type', 'Nombre']);
      for (const t of this.dashboard!.parType) {
        rows.push([t.type, t.count]);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 28 },
        { wch: 30 }, { wch: 8  }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 8 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, `Semaine ${this.semaine}`);
      XLSX.writeFile(wb, `Rapport_hebdo_S${this.semaine}.xlsx`);
    });
  }

  private statutLabelFr(s: string): string {
    const m: Record<string, string> = {
      A_FAIRE: 'À faire', EN_COURS: 'En cours', TERMINEE: 'Terminé',
      NON_FAIT: 'Non fait', EN_ATTENTE: 'En attente',
    };
    return m[s] ?? s;
  }

  formatTime(minutes: number): string {
    if (!minutes || minutes <= 0) return '—';
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }
}

// ─── Page principale Tâches ───────────────────────────────────────────────────
@Component({
  selector: 'app-tasks-global',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSnackBarModule, MatTooltipModule, MatDialogModule,
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
        <div class="header-actions">
          <button mat-stroked-button class="btn-rapport" (click)="openRapport()">
            <mat-icon>insert_chart</mat-icon>
            Rapport hebdomadaire
          </button>
          <button mat-flat-button class="btn-new" (click)="showForm = !showForm">
            <mat-icon>{{ showForm ? 'close' : 'add' }}</mat-icon>
            {{ showForm ? 'Annuler' : 'Nouvelle tâche' }}
          </button>
        </div>
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
                <mat-option value="BASSE">Basse</mat-option>
                <mat-option value="NORMALE">Normale</mat-option>
                <mat-option value="HAUTE">Haute</mat-option>
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

      <!-- Barre KPIs cliquables -->
      <div class="kpi-bar">
        <button class="kpi-card" [class.kpi-active]="filterStatut === null" (click)="setStatut(null)">
          <span class="kpi-val">{{ tasks.length }}</span>
          <span class="kpi-lbl">Toutes</span>
        </button>
        @for (col of columns; track col.statut) {
          <button class="kpi-card kpi-{{ col.statut.toLowerCase() }}"
            [class.kpi-active]="filterStatut === col.statut"
            (click)="setStatut(col.statut)">
            <span class="kpi-val">{{ getByStatut(col.statut).length }}</span>
            <span class="kpi-lbl">{{ col.label }}</span>
          </button>
        }
      </div>

      <!-- Filtres secondaires -->
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
          <button mat-icon-button class="btn-reset" matTooltip="Réinitialiser" (click)="resetFilters()">
            <mat-icon>filter_alt_off</mat-icon>
          </button>
        }
        <span class="filter-count">{{ filteredTasks.length }} résultat{{ filteredTasks.length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Tableau -->
      <div class="table-wrap">
        <table class="tasks-table">
          <thead>
            <tr>
              <th class="col-id">ID</th>
              <th class="col-date">Date</th>
              <th class="col-client">Client</th>
              <th class="col-tache">Tâche</th>
              <th class="col-type">Type</th>
              <th class="col-collab">Collaborateur</th>
              <th class="col-attrib">Attribué par</th>
              <th class="col-statut">Statut</th>
              <th class="col-temps">Temps</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (t of filteredTasks; track t.id) {
              <tr [class.row-terminee]="t.statut === 'TERMINEE'" [class.row-nonfait]="t.statut === 'NON_FAIT'">
                <td class="col-id">
                  <span class="task-id-badge">{{ t.taskId ?? '—' }}</span>
                </td>
                <td class="col-date">{{ t.createdAt | date:'dd/MM/yy' }}</td>
                <td class="col-client">
                  @if (t.client) {
                    <a class="client-link" [routerLink]="['/clients', t.client.id]">{{ t.client.nom }}</a>
                  } @else { <span class="none">—</span> }
                </td>
                <td class="col-tache">
                  <span class="task-titre-cell">{{ t.titre }}</span>
                  @if (t.dateEcheance) {
                    <span class="echeance" [class.overdue]="isOverdue(t)">
                      <mat-icon>event</mat-icon>{{ t.dateEcheance | date:'dd/MM' }}
                    </span>
                  }
                </td>
                <td class="col-type">
                  @if (t.type) {
                    <span class="type-badge type-{{ t.type.toLowerCase() }}">{{ t.type }}</span>
                  } @else { <span class="none">—</span> }
                </td>
                <td class="col-collab">
                  {{ t.assignee ? (t.assignee.firstName + ' ' + t.assignee.lastName) : '' }}
                  @if (!t.assignee) { <span class="none">—</span> }
                </td>
                <td class="col-attrib">
                  {{ t.createdBy ? (t.createdBy.firstName + ' ' + t.createdBy.lastName) : '' }}
                  @if (!t.createdBy) { <span class="none">—</span> }
                </td>
                <td class="col-statut">
                  <span class="statut-badge statut-{{ t.statut.toLowerCase() }}">{{ statutLabel(t.statut) }}</span>
                </td>
                <td class="col-temps">{{ t.tempsExecution && t.tempsExecution > 0 ? formatTime(t.tempsExecution) : '—' }}</td>
                <td class="col-actions">
                  @if (t.statut === 'A_FAIRE') {
                    <button mat-icon-button class="act-btn act-play" matTooltip="Démarrer" (click)="changeStatut(t, 'EN_COURS')">
                      <mat-icon>play_arrow</mat-icon>
                    </button>
                  }
                  @if (t.statut === 'EN_COURS') {
                    <button mat-icon-button class="act-btn act-done" matTooltip="Terminer" (click)="changeStatut(t, 'TERMINEE')">
                      <mat-icon>check_circle</mat-icon>
                    </button>
                  }
                  <button mat-icon-button class="act-btn act-del" matTooltip="Supprimer" (click)="remove(t)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </td>
              </tr>
            }
            @if (filteredTasks.length === 0) {
              <tr><td colspan="10" class="table-empty">Aucune tâche trouvée</td></tr>
            }
          </tbody>
        </table>
      </div>

    </div>
  `,
  styles: [`
    .page { padding: 24px 28px; max-width: 1600px; margin: 0 auto; }

    /* Header */
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .page-header__left { display: flex; align-items: center; gap: 14px; }
    .page-icon { font-size: 30px; width: 30px; height: 30px; color: #6366f1; }
    .page-header h1 { font-size: 20px; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2; }
    .page-header p { font-size: 12px; color: #94a3b8; margin: 0; }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .btn-rapport { border-radius: 10px !important; font-weight: 600; color: #6366f1 !important; border-color: #c7d2fe !important; gap: 6px; }
    .btn-rapport mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .btn-new { border-radius: 10px !important; font-weight: 600; background: linear-gradient(135deg, #6366f1, #4f46e5) !important; color: white !important; gap: 6px; }

    /* Create panel */
    .create-panel { background: white; border: 1px solid #e8ecf0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    .create-panel h3 { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #1e293b; margin: 0 0 12px; }
    .create-panel h3 mat-icon { color: #6366f1; font-size: 17px; width: 17px; height: 17px; }
    .create-form { display: grid; grid-template-columns: 1.2fr 0.9fr 1.3fr 1fr; gap: 10px 12px; align-items: start; }
    .f-client { grid-column: 1; }
    .f-type { grid-column: 2; }
    .f-titre { grid-column: 3 / span 2; }
    .f-assignee { grid-column: 1; }
    .f-priorite { grid-column: 2; }
    .f-echeance { grid-column: 3; }
    .f-submit { grid-column: 4; padding-top: 4px; }
    .btn-create { width: 100%; border-radius: 10px !important; font-weight: 600; background: linear-gradient(135deg, #6366f1, #4f46e5) !important; color: white !important; }

    /* Barre KPIs */
    .kpi-bar { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi-card { background: white; border: 1.5px solid #e8ecf0; border-radius: 12px; padding: 14px 16px; text-align: center; cursor: pointer; transition: all .15s; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .kpi-card:hover { border-color: #c7d2fe; background: #f8f8ff; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(99,102,241,.08); }
    .kpi-val { font-size: 26px; font-weight: 800; color: #1e293b; line-height: 1; }
    .kpi-lbl { font-size: 11px; color: #94a3b8; font-weight: 500; }

    /* KPI actif — "Toutes" */
    .kpi-card.kpi-active { border-color: #6366f1; background: #eef2ff; box-shadow: 0 2px 8px rgba(99,102,241,.15); }
    .kpi-card.kpi-active .kpi-val { color: #4f46e5; }
    .kpi-card.kpi-active .kpi-lbl { color: #6366f1; }

    /* KPI par statut — couleurs au survol et actif */
    .kpi-a_faire:hover, .kpi-a_faire.kpi-active { border-color: #93c5fd; background: #eff6ff; }
    .kpi-a_faire.kpi-active .kpi-val, .kpi-a_faire:hover .kpi-val { color: #1d4ed8; }
    .kpi-en_cours:hover, .kpi-en_cours.kpi-active { border-color: #fcd34d; background: #fffbeb; }
    .kpi-en_cours.kpi-active .kpi-val, .kpi-en_cours:hover .kpi-val { color: #d97706; }
    .kpi-terminee:hover, .kpi-terminee.kpi-active { border-color: #86efac; background: #f0fdf4; }
    .kpi-terminee.kpi-active .kpi-val, .kpi-terminee:hover .kpi-val { color: #15803d; }
    .kpi-non_fait:hover, .kpi-non_fait.kpi-active { border-color: #fca5a5; background: #fff1f2; }
    .kpi-non_fait.kpi-active .kpi-val, .kpi-non_fait:hover .kpi-val { color: #e11d48; }
    .kpi-en_attente:hover, .kpi-en_attente.kpi-active { border-color: #c4b5fd; background: #f5f3ff; }
    .kpi-en_attente.kpi-active .kpi-val, .kpi-en_attente:hover .kpi-val { color: #7c3aed; }

    /* Filtres */
    .filters { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .filter-field { max-width: 160px; }
    .btn-reset { color: #94a3b8 !important; }
    .btn-reset:hover { color: #ef4444 !important; }
    .filter-count { margin-left: auto; font-size: 12px; color: #94a3b8; font-weight: 500; }

    /* Tableau */
    .table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #e8ecf0; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 24px; }
    .tasks-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .tasks-table thead tr { background: #f8fafc; border-bottom: 2px solid #e8ecf0; }
    .tasks-table th { padding: 10px 12px; text-align: left; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; }
    .tasks-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .1s; }
    .tasks-table tbody tr:hover { background: #fafbfc; }
    .tasks-table tbody tr:last-child { border-bottom: none; }
    .tasks-table td { padding: 9px 12px; color: #1e293b; vertical-align: middle; }
    .row-terminee td { color: #94a3b8; }
    .row-nonfait td { color: #b0bec5; }
    .col-id { width: 90px; }
    .col-date { width: 70px; white-space: nowrap; }
    .col-client { max-width: 150px; }
    .col-type { width: 78px; }
    .col-collab, .col-attrib { width: 130px; }
    .col-statut { width: 110px; }
    .col-temps { width: 68px; text-align: right; font-variant-numeric: tabular-nums; font-size: 11.5px; color: #64748b; }
    .col-actions { width: 72px; white-space: nowrap; }
    .table-empty { text-align: center; padding: 48px; color: #94a3b8; font-size: 13px; }
    .task-id-badge { font-family: monospace; font-size: 11px; color: #94a3b8; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
    .client-link { color: #6366f1; font-weight: 600; text-decoration: none; font-size: 12px; }
    .client-link:hover { text-decoration: underline; }
    .task-titre-cell { font-weight: 600; display: block; line-height: 1.35; }
    .echeance { display: inline-flex; align-items: center; gap: 2px; font-size: 10.5px; color: #94a3b8; margin-top: 2px; }
    .echeance mat-icon { font-size: 11px; width: 11px; height: 11px; }
    .echeance.overdue { color: #dc2626; font-weight: 600; }
    .none { color: #cbd5e1; }
    .statut-badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
    .statut-a_faire   { background: #eff6ff; color: #1d4ed8; }
    .statut-en_cours  { background: #fffbeb; color: #d97706; }
    .statut-terminee  { background: #f0fdf4; color: #15803d; }
    .statut-non_fait  { background: #fff1f2; color: #e11d48; }
    .statut-en_attente { background: #f5f3ff; color: #7c3aed; }
    .act-btn { width: 28px !important; height: 28px !important; line-height: 28px !important; }
    .act-play { color: #6366f1 !important; }
    .act-done { color: #15803d !important; }
    .act-del  { color: #cbd5e1 !important; }
    .act-del:hover { color: #f87171 !important; }
    ::ng-deep .act-btn .mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; }
    .type-badge { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
    .type-tva    { background: #fef9c3; color: #854d0e; }
    .type-paie   { background: #dbeafe; color: #1e40af; }
    .type-achats { background: #fce7f3; color: #9d174d; }
    .type-ventes { background: #dcfce7; color: #14532d; }
    .type-rb     { background: #f0fdf4; color: #15803d; }
    .type-gv     { background: #ede9fe; color: #5b21b6; }
    .type-dr     { background: #fff7ed; color: #c2410c; }
    .type-autre  { background: #f1f5f9; color: #475569; }
  `],
})
export class TasksGlobalComponent implements OnInit {
  private tasksService = inject(TasksService);
  private clientsService = inject(ClientsService);
  private usersService = inject(UsersService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  clients: Client[] = [];
  users: User[] = [];

  showForm = false;
  filterClientId: number | null = null;
  filterAssigneeId: number | null = null;
  filterType: string | null = null;
  filterStatut: TaskStatut | null = null;

  get currentWeek(): number {
    const d = new Date();
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
    const ys = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return Math.ceil((((dt.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  }

  taskTypes = [
    { value: 'TVA',    label: 'TVA' },
    { value: 'PAIE',   label: 'Paie' },
    { value: 'ACHATS', label: 'Achats' },
    { value: 'VENTES', label: 'Ventes' },
    { value: 'RB',     label: 'Relevé Bancaire' },
    { value: 'GV',     label: 'GV' },
    { value: 'DR',     label: 'Dossier Révision' },
    { value: 'AUTRE',  label: 'Autre' },
  ];

  columns = [
    { statut: 'A_FAIRE'    as TaskStatut, label: 'À faire' },
    { statut: 'EN_COURS'   as TaskStatut, label: 'En cours' },
    { statut: 'TERMINEE'   as TaskStatut, label: 'Terminées' },
    { statut: 'NON_FAIT'   as TaskStatut, label: 'Non fait' },
    { statut: 'EN_ATTENTE' as TaskStatut, label: 'En attente' },
  ];

  form = this.fb.group({
    clientId:     [null as number | null, Validators.required],
    titre:        ['', Validators.required],
    type:         ['AUTRE'],
    priorite:     ['NORMALE'],
    dateEcheance: [''],
    assigneeId:   [null as number | null],
  });

  ngOnInit() {
    this.load();
    this.clientsService.getAll().subscribe(c => this.clients = c);
    this.usersService.getAssignable().subscribe(u => this.users = u);
  }

  load() {
    this.tasksService.getAllGlobal().subscribe(t => {
      this.tasks = t;
      this.applyFilter();
    });
  }

  openRapport() {
    this.dialog.open(SyntheseDialogComponent, {
      width: '860px',
      maxWidth: '96vw',
      panelClass: 'synthese-dialog-panel',
    });
  }

  setStatut(s: TaskStatut | null) {
    this.filterStatut = this.filterStatut === s ? null : s;
    this.applyFilter();
  }

  applyFilter() {
    this.filteredTasks = this.tasks.filter(t => {
      if (this.filterClientId   && t.clientId      !== this.filterClientId)   return false;
      if (this.filterAssigneeId && t.assignee?.id  !== this.filterAssigneeId) return false;
      if (this.filterType       && t.type          !== this.filterType)       return false;
      if (this.filterStatut     && t.statut        !== this.filterStatut)     return false;
      return true;
    });
  }

  resetFilters() {
    this.filterClientId = this.filterAssigneeId = this.filterType = null;
    this.applyFilter();
  }

  getByStatut(statut: TaskStatut): Task[] {
    return this.tasks.filter(t => t.statut === statut);
  }

  statutLabel(s: TaskStatut): string {
    const map: Record<TaskStatut, string> = {
      A_FAIRE: 'À faire', EN_COURS: 'En cours', TERMINEE: 'Terminé',
      NON_FAIT: 'Non fait', EN_ATTENTE: 'En attente',
    };
    return map[s] ?? s;
  }

  create() {
    if (this.form.invalid) return;
    const v = this.form.value;
    this.tasksService.create(v.clientId!, {
      titre:        v.titre!,
      type:         v.type as any,
      priorite:     v.priorite as any,
      dateEcheance: v.dateEcheance || undefined,
      assigneeId:   v.assigneeId  || undefined,
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

  formatTime(minutes: number): string {
    if (!minutes || minutes <= 0) return '—';
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }
}
