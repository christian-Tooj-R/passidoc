import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as XLSX from 'xlsx';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToastService } from '../../core/services/toast.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TasksService, Task, TaskStatut, TaskDashboard } from '../../core/services/tasks.service';
import { ClientsService } from '../../core/services/clients.service';
import { UsersService } from '../../core/services/users.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { Client } from '../../core/models/client.model';
import { User } from '../../core/models/user.model';
import { LocalDatePipe } from '../../core/pipes/local-date.pipe';

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

// ─── Dialog Détail / Édition tâche ───────────────────────────────────────────
@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatTooltipModule, MatDialogModule, LocalDatePipe],
  template: `
    <div class="td-wrap">
      <!-- En-tête -->
      <div class="td-header">
        <div class="td-header__left">
          <span class="td-id">{{ task.taskId ?? '—' }}</span>
          <div class="td-meta">
            <span class="td-titre">{{ task.titre }}</span>
            <span class="td-date">Créée le {{ task.createdAt | localDate:'dd/MM/yyyy' }}</span>
          </div>
        </div>
        <div class="td-header__right">
          <select class="statut-select statut-{{ currentStatut.toLowerCase() }}"
                  [value]="currentStatut"
                  [disabled]="!canChangeStatut"
                  (change)="onStatutChange($any($event.target).value)">
            <option value="A_FAIRE">À faire</option>
            <option value="EN_COURS">En cours</option>
            <option value="TERMINEE">Terminée</option>
            <option value="NON_FAIT">Non fait</option>
            <option value="EN_ATTENTE">En attente</option>
          </select>
          <button mat-icon-button (click)="dialogRef.close()" class="td-close"><mat-icon>close</mat-icon></button>
        </div>
      </div>

      <div class="td-body">
        <!-- Infos fixes -->
        <div class="td-info-grid">
          <div class="td-info-item">
            <span class="td-lbl">Client</span>
            @if (task.client) {
              <a class="td-client-link" [routerLink]="['/clients', task.client.id]" (click)="dialogRef.close()">
                <mat-icon>folder_shared</mat-icon>{{ task.client.nom }}
              </a>
            } @else { <span class="none">—</span> }
          </div>
          <div class="td-info-item">
            <span class="td-lbl">Attribué par</span>
            <span class="td-val">{{ task.createdBy ? (task.createdBy.firstName + ' ' + task.createdBy.lastName) : '—' }}</span>
          </div>
          <div class="td-info-item">
            <span class="td-lbl">Temps d'exéc.</span>
            <span class="td-val">{{ task.tempsExecution && task.tempsExecution > 0 ? formatTime(task.tempsExecution) : '—' }}</span>
          </div>
          <div class="td-info-item">
            <span class="td-lbl">Horaires</span>
            <span class="td-val">
              @if (task.heureDebut && task.heureFin) {
                {{ task.heureDebut | localDate:'HH:mm' }} → {{ task.heureFin | localDate:'HH:mm' }}
              } @else { — }
            </span>
          </div>
        </div>

        @if (!canEdit) {
          <div class="td-readonly-banner">
            <mat-icon>lock_outline</mat-icon>
            @if (canChangeStatut) {
              Vous pouvez uniquement modifier le statut
            } @else {
              Lecture seule — seul <strong>{{ task.createdBy?.firstName }} {{ task.createdBy?.lastName }}</strong> peut modifier cette tâche
            }
          </div>
        }

        <div class="td-divider"></div>

        <!-- Formulaire édition -->
        <form [formGroup]="form" class="td-form">

          <mat-form-field appearance="outline" class="td-field-full">
            <mat-label>Titre</mat-label>
            <input matInput formControlName="titre" [readonly]="!canEdit" />
          </mat-form-field>

          <div class="td-row">
            <mat-form-field appearance="outline" class="td-field">
              <mat-label>Priorité</mat-label>
              <mat-select formControlName="priorite" [disabled]="!canEdit">
                <mat-option value="BASSE">Basse</mat-option>
                <mat-option value="NORMALE">Normale</mat-option>
                <mat-option value="HAUTE">Haute</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="td-field">
              <mat-label>Type</mat-label>
              <mat-select formControlName="type" [disabled]="!canEdit">
                <mat-option value="TVA">TVA</mat-option>
                <mat-option value="PAIE">Paie</mat-option>
                <mat-option value="ACHATS">Achats</mat-option>
                <mat-option value="VENTES">Ventes</mat-option>
                <mat-option value="RB">Relevé Bancaire</mat-option>
                <mat-option value="GV">GV</mat-option>
                <mat-option value="DR">Dossier Révision</mat-option>
                <mat-option value="AUTRE">Autre</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="td-row">
            <mat-form-field appearance="outline" class="td-field">
              <mat-label>Assigné à</mat-label>
              <mat-select formControlName="assigneeId" [disabled]="!canEdit">
                <mat-option [value]="null">— Non assignée —</mat-option>
                @for (u of data.users; track u.id) {
                  <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="td-field">
              <mat-label>Échéance</mat-label>
              <input matInput type="date" formControlName="dateEcheance" [readonly]="!canEdit" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="td-field">
              <mat-label>H. Sup</mat-label>
              <input matInput type="number" formControlName="heuresSup" [readonly]="!canEdit" min="0" step="0.5" />
            </mat-form-field>
          </div>

        </form>
      </div>

      <!-- Footer -->
      <div class="td-footer">
        @if (canEdit) {
          <button mat-stroked-button class="td-btn-del" (click)="delete()">
            <mat-icon>delete_outline</mat-icon> Supprimer
          </button>
        }
        <span class="td-spacer"></span>
        <button mat-stroked-button (click)="dialogRef.close()">Annuler</button>
        @if (canChangeStatut) {
        <button mat-flat-button class="td-btn-save" (click)="save()" [disabled]="form.invalid || (form.pristine && currentStatut === task.statut)">
          <mat-icon>save</mat-icon> Enregistrer
        </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .td-wrap { display: flex; flex-direction: column; max-height: 90vh; width: 680px; }
    .td-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 18px 20px 14px; border-bottom: 1px solid #e8ecf0; gap: 12px; flex-shrink: 0; }
    .td-header__left { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
    .td-header__right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .td-id { font-family: monospace; font-size: 11px; color: #94a3b8; background: #f1f5f9; padding: 3px 8px; border-radius: 5px; white-space: nowrap; margin-top: 2px; }
    .td-meta { display: flex; flex-direction: column; min-width: 0; }
    .td-titre { font-size: 15px; font-weight: 700; color: #1e293b; line-height: 1.3; }
    .td-date { font-size: 11px; color: #94a3b8; margin-top: 3px; }
    .td-close { color: #94a3b8 !important; }
    .td-body { padding: 18px 20px; overflow-y: auto; flex: 1; }
    .td-info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .td-info-item { display: flex; flex-direction: column; gap: 3px; }
    .td-lbl { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .4px; }
    .td-val { font-size: 13px; color: #1e293b; font-weight: 500; }
    .td-client-link { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: #6366f1; text-decoration: none; }
    .td-client-link:hover { text-decoration: underline; }
    .td-client-link mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .td-readonly-banner { display: flex; align-items: center; gap: 7px; background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #92400e; margin-bottom: 12px; }
    .td-readonly-banner mat-icon { font-size: 15px; width: 15px; height: 15px; color: #d97706; flex-shrink: 0; }
    .statut-select { border: none; outline: none; border-radius: 20px; padding: 4px 22px 4px 10px; font-size: 12px; font-weight: 700; cursor: pointer; appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 7px center; transition: opacity .15s; }
    .statut-select:hover { opacity: .85; }
    .statut-select:disabled { opacity: .6; cursor: default; }
    .statut-a_faire   { background-color: #eff6ff; color: #1d4ed8; }
    .statut-en_cours  { background-color: #fffbeb; color: #d97706; }
    .statut-terminee  { background-color: #f0fdf4; color: #15803d; }
    .statut-non_fait  { background-color: #fff1f2; color: #e11d48; }
    .statut-en_attente { background-color: #f5f3ff; color: #7c3aed; }
    .td-divider { height: 1px; background: #f1f5f9; margin-bottom: 16px; }
    .td-form { display: flex; flex-direction: column; gap: 4px; }
    .td-field-full { width: 100%; }
    .td-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .td-field { width: 100%; }
    .td-footer { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-top: 1px solid #e8ecf0; flex-shrink: 0; }
    .td-spacer { flex: 1; }
    .td-btn-del { color: #ef4444 !important; border-color: #fecaca !important; border-radius: 8px !important; }
    .td-btn-del mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .td-btn-save { background: linear-gradient(135deg, #6366f1, #4f46e5) !important; color: white !important; border-radius: 8px !important; gap: 4px; }
    .td-btn-save mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .statut-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .statut-a_faire   { background: #eff6ff; color: #1d4ed8; }
    .statut-en_cours  { background: #fffbeb; color: #d97706; }
    .statut-terminee  { background: #f0fdf4; color: #15803d; }
    .statut-non_fait  { background: #fff1f2; color: #e11d48; }
    .statut-en_attente { background: #f5f3ff; color: #7c3aed; }
    .none { color: #cbd5e1; font-size: 13px; }
  `],
})
export class TaskDetailDialogComponent {
  private tasksService = inject(TasksService);
  private toast = inject(ToastService);
  dialogRef = inject(MatDialogRef<TaskDetailDialogComponent>);
  data: { task: Task; users: User[]; currentUserId: number; currentUserIsAdmin: boolean } = inject(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);

  task = this.data.task;
  currentStatut: TaskStatut = this.data.task.statut;

  get canEdit(): boolean {
    return this.data.currentUserIsAdmin || this.data.currentUserId === this.task.createdBy?.id;
  }
  get canChangeStatut(): boolean {
    return this.canEdit || this.data.currentUserId === this.task.assignee?.id;
  }

  onStatutChange(statut: TaskStatut) {
    this.currentStatut = statut;
    this.form.markAsDirty();
  }

  form = this.fb.group({
    titre:        [this.task.titre, Validators.required],
    priorite:     [this.task.priorite ?? 'NORMALE'],
    type:         [this.task.type ?? null],
    assigneeId:   [this.task.assignee?.id ?? null],
    dateEcheance: [this.task.dateEcheance ? this.task.dateEcheance.substring(0, 10) : ''],
    heuresSup:    [this.task.heuresSup ?? null],
  });

  save() {
    if (this.form.invalid || this.form.pristine) return;
    const v = this.form.value;
    this.tasksService.update(this.task.clientId, this.task.id, {
      titre:        v.titre!,
      statut:       this.currentStatut,
      priorite:     v.priorite as any,
      type:         v.type as any,
      assigneeId:   v.assigneeId ?? undefined,
      dateEcheance: v.dateEcheance || undefined,
      heuresSup:    v.heuresSup ?? undefined,
    }).subscribe(() => {
      this.toast.success('Tâche mise à jour');
      this.dialogRef.close('updated');
    });
  }

  delete() {
    this.tasksService.delete(this.task.clientId, this.task.id).subscribe(() => {
      this.toast.success('Tâche supprimée');
      this.dialogRef.close('deleted');
    });
  }

  statutLabel(s: string): string {
    const m: Record<string, string> = {
      A_FAIRE: 'À faire', EN_COURS: 'En cours', TERMINEE: 'Terminée',
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
    MatInputModule, MatSelectModule, MatTooltipModule, MatDialogModule,
    LocalDatePipe, TaskDetailDialogComponent,
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
        <button class="btn-mes-taches" [class.btn-mes-taches--active]="mesTachesOnly" (click)="toggleMesTaches()">
          <mat-icon>person</mat-icon>
          Mes tâches
          @if (myTaskCount > 0) {
            <span class="mes-badge">{{ myTaskCount }}</span>
          }
        </button>
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
        @if (mesTachesOnly || filterClientId || filterAssigneeId || filterType) {
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
              <th class="col-prio">Priorité</th>
              <th class="col-collab">Collaborateur</th>
              <th class="col-attrib">Attribué par</th>
              <th class="col-statut">Statut</th>
              <th class="col-temps">Exéc.</th>
              <th class="col-sup">H. Sup</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (t of filteredTasks; track t.id) {
              <tr [class.row-terminee]="t.statut === 'TERMINEE'" [class.row-nonfait]="t.statut === 'NON_FAIT'"
                  class="row-clickable" (click)="openDetail(t)">
                <td class="col-id">
                  <span class="task-id-badge">{{ t.taskId ?? '—' }}</span>
                </td>
                <td class="col-date">{{ t.createdAt | localDate:'dd/MM/yy' }}</td>
                <td class="col-client">
                  @if (t.client) {
                    <a class="client-link" [routerLink]="['/clients', t.client.id]">{{ t.client.nom }}</a>
                  } @else { <span class="none">—</span> }
                </td>
                <td class="col-tache">
                  <span class="task-titre-cell">{{ t.titre }}</span>
                  @if (t.dateEcheance) {
                    <span class="echeance" [class.overdue]="isOverdue(t)">
                      <mat-icon>event</mat-icon>{{ t.dateEcheance | localDate:'dd/MM' }}
                    </span>
                  }
                </td>
                <td class="col-type">
                  @if (t.type) {
                    <span class="type-badge type-{{ t.type.toLowerCase() }}">{{ t.type }}</span>
                  } @else { <span class="none">—</span> }
                </td>
                <td class="col-prio">
                  <span class="prio-badge prio-{{ t.priorite?.toLowerCase() }}"
                        [matTooltip]="t.priorite === 'HAUTE' ? 'Priorité haute' : t.priorite === 'BASSE' ? 'Priorité basse' : 'Priorité normale'">
                    {{ t.priorite === 'HAUTE' ? '↑' : t.priorite === 'BASSE' ? '↓' : '—' }}
                  </span>
                </td>
                <td class="col-collab">
                  {{ t.assignee ? (t.assignee.firstName + ' ' + t.assignee.lastName) : '' }}
                  @if (!t.assignee) { <span class="none">—</span> }
                </td>
                <td class="col-attrib">
                  {{ t.createdBy ? (t.createdBy.firstName + ' ' + t.createdBy.lastName) : '' }}
                  @if (!t.createdBy) { <span class="none">—</span> }
                </td>
                <td class="col-statut" (click)="$event.stopPropagation()">
                  <select class="statut-select statut-{{ t.statut.toLowerCase() }}"
                          [value]="t.statut"
                          (change)="changeStatut(t, $any($event.target).value)">
                    <option value="A_FAIRE">À faire</option>
                    <option value="EN_COURS">En cours</option>
                    <option value="TERMINEE">Terminée</option>
                    <option value="NON_FAIT">Non fait</option>
                    <option value="EN_ATTENTE">En attente</option>
                  </select>
                </td>
                <td class="col-temps"
                    [matTooltip]="t.heureDebut && t.heureFin ? 'De ' + (t.heureDebut | localDate:'HH:mm') + ' à ' + (t.heureFin | localDate:'HH:mm') : ''">
                  {{ t.tempsExecution && t.tempsExecution > 0 ? formatTime(t.tempsExecution) : '—' }}
                </td>
                <td class="col-sup">
                  @if (t.heuresSup && t.heuresSup > 0) {
                    <span class="sup-badge" [matTooltip]="'Heures sup : ' + formatTime(t.heuresSup * 60)">
                      +{{ formatTime(t.heuresSup * 60) }}
                    </span>
                  } @else { <span class="none">—</span> }
                </td>
                <td class="col-actions" (click)="$event.stopPropagation()">
                  <button mat-icon-button class="act-btn act-del" matTooltip="Supprimer" (click)="remove(t)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </td>
              </tr>
            }
            @if (filteredTasks.length === 0) {
              <tr><td colspan="12" class="table-empty">Aucune tâche trouvée</td></tr>
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
    .btn-mes-taches {
      display: flex; align-items: center; gap: 6px;
      padding: 0 12px; height: 36px; border-radius: 8px;
      border: 1.5px solid #e2e8f0; background: white;
      font-size: 12.5px; font-weight: 600; color: #64748b;
      cursor: pointer; transition: all .15s; white-space: nowrap;
    }
    .btn-mes-taches mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .btn-mes-taches:hover { border-color: #c7d2fe; color: #6366f1; background: #f8f8ff; }
    .btn-mes-taches--active { border-color: #6366f1; background: #eef2ff; color: #4f46e5; }
    .mes-badge { background: #6366f1; color: white; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 20px; }

    /* Tableau */
    .table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #e8ecf0; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 24px; }
    .tasks-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .tasks-table thead tr { background: #f8fafc; border-bottom: 2px solid #e8ecf0; }
    .tasks-table th { padding: 10px 12px; text-align: left; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; }
    .tasks-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .1s; }
    .tasks-table tbody tr.row-clickable { cursor: pointer; }
    .tasks-table tbody tr.row-clickable:hover { background: #f5f3ff; }
    .tasks-table tbody tr:last-child { border-bottom: none; }
    .tasks-table td { padding: 9px 12px; color: #1e293b; vertical-align: middle; }
    .row-terminee td { color: #94a3b8; }
    .row-nonfait td { color: #b0bec5; }
    .col-id { width: 90px; }
    .col-date { width: 70px; white-space: nowrap; }
    .col-client { max-width: 150px; }
    .col-type { width: 68px; }
    .col-prio { width: 52px; text-align: center; }
    .col-collab, .col-attrib { width: 120px; }
    .col-statut { width: 100px; }
    .col-temps { width: 58px; text-align: right; font-variant-numeric: tabular-nums; font-size: 11.5px; color: #64748b; cursor: default; }
    .col-sup { width: 60px; text-align: right; }
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
    .statut-select {
      border: none; outline: none; border-radius: 20px;
      padding: 3px 10px; font-size: 11px; font-weight: 700;
      cursor: pointer; appearance: none; -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 7px center;
      padding-right: 22px; transition: opacity .15s;
    }
    .statut-select:hover { opacity: .85; }
    .statut-a_faire   { background-color: #eff6ff; color: #1d4ed8; }
    .statut-en_cours  { background-color: #fffbeb; color: #d97706; }
    .statut-terminee  { background-color: #f0fdf4; color: #15803d; }
    .statut-non_fait  { background-color: #fff1f2; color: #e11d48; }
    .statut-en_attente { background-color: #f5f3ff; color: #7c3aed; }
    .act-btn { width: 28px !important; height: 28px !important; line-height: 28px !important; }
    .act-del  { color: #cbd5e1 !important; }
    .act-del:hover { color: #f87171 !important; }
    ::ng-deep .act-btn .mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; }
    .prio-badge { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; font-size: 13px; font-weight: 800; }
    .prio-haute  { background: #fee2e2; color: #dc2626; }
    .prio-normale { background: transparent; color: #cbd5e1; font-size: 11px; }
    .prio-basse  { background: #f0fdf4; color: #16a34a; }
    .sup-badge { font-size: 11px; font-weight: 700; color: #d97706; background: #fff7ed; padding: 1px 5px; border-radius: 4px; white-space: nowrap; }
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
export class TasksGlobalComponent implements OnInit, OnDestroy {
  private tasksService = inject(TasksService);
  private clientsService = inject(ClientsService);
  private usersService = inject(UsersService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private notifStream = inject(NotificationStreamService);
  private sub = new Subscription();

  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  clients: Client[] = [];
  users: User[] = [];

  showForm = false;
  mesTachesOnly = false;
  filterClientId: number | null = null;
  filterAssigneeId: number | null = null;
  filterType: string | null = null;
  filterStatut: TaskStatut | null = null;

  private auth = inject(AuthService);
  get currentUserId(): number | null { return this.auth.currentUser()?.id ?? null; }
  get myTaskCount(): number { return this.tasks.filter(t => t.assignee?.id === this.currentUserId && !['TERMINEE','NON_FAIT'].includes(t.statut)).length; }

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
    this.sub.add(
      this.notifStream.newNotif$.pipe(filter(n => n.type === 'TASK_ASSIGNED')).subscribe(() => this.load())
    );
  }

  ngOnDestroy() { this.sub.unsubscribe(); }

  load() {
    this.tasksService.getAllGlobal().subscribe(t => {
      this.tasks = t;
      this.applyFilter();
    });
  }

  openDetail(task: Task) {
    const ref = this.dialog.open(TaskDetailDialogComponent, {
      width: '700px',
      maxWidth: '96vw',
      data: { task, users: this.users, currentUserId: this.auth.currentUser()?.id, currentUserIsAdmin: this.auth.isAdmin() },
    });
    ref.afterClosed().subscribe(result => {
      if (result === 'updated' || result === 'deleted') this.load();
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
      if (this.mesTachesOnly    && t.assignee?.id  !== this.currentUserId)    return false;
      if (this.filterClientId   && t.clientId      !== this.filterClientId)   return false;
      if (this.filterAssigneeId && t.assignee?.id  !== this.filterAssigneeId) return false;
      if (this.filterType       && t.type          !== this.filterType)       return false;
      if (this.filterStatut     && t.statut        !== this.filterStatut)     return false;
      return true;
    });
  }

  toggleMesTaches() {
    this.mesTachesOnly = !this.mesTachesOnly;
    this.applyFilter();
  }

  resetFilters() {
    this.mesTachesOnly = false;
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
      this.toast.success('Tâche créée');
    });
  }

  changeStatut(t: Task, statut: TaskStatut) {
    const prev = t.statut;
    t.statut = statut; // mise à jour optimiste
    this.tasksService.update(t.clientId, t.id, { statut }).subscribe({
      next: () => this.applyFilter(),
      error: () => { t.statut = prev; }, // rollback si erreur
    });
  }


  remove(t: Task) {
    this.tasksService.delete(t.clientId, t.id).subscribe(() => {
      this.load();
      this.toast.success('Tâche supprimée');
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
