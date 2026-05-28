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
import { ConfirmService } from '../../core/services/confirm.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
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

// ─── Rapport hebdomadaire ─────────────────────────────────────────────────────
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
        <button mat-icon-button (click)="semaine = semaine - 1; load()"><mat-icon>chevron_left</mat-icon></button>
        <span class="sd-week-num">S{{ semaine }}</span>
        <button mat-icon-button (click)="semaine = semaine + 1; load()" [disabled]="semaine >= currentWeek"><mat-icon>chevron_right</mat-icon></button>
        <button mat-stroked-button class="sd-cur" (click)="semaine = currentWeek; load()">Actuelle</button>
      </div>
      <button mat-stroked-button class="sd-export" (click)="exportExcel()" [disabled]="!dashboard">
        <mat-icon>download</mat-icon> Export Excel
      </button>
      <button mat-icon-button (click)="dialogRef.close()" class="sd-close"><mat-icon>close</mat-icon></button>
    </div>
    <div class="sd-body">
      @if (dashboard) {
        <div class="sd-kpis">
          <div class="sd-kpi"><span class="sd-kpi__val">{{ dashboard.total }}</span><span class="sd-kpi__lbl">Tâches</span></div>
          <div class="sd-kpi sd-green"><span class="sd-kpi__val">{{ dashboard.terminees }}</span><span class="sd-kpi__lbl">Terminées</span></div>
          <div class="sd-kpi sd-blue"><span class="sd-kpi__val">{{ dashboard.enCours }}</span><span class="sd-kpi__lbl">En cours</span></div>
          <div class="sd-kpi sd-red"><span class="sd-kpi__val">{{ dashboard.nonFait }}</span><span class="sd-kpi__lbl">Non faites</span></div>
          <div class="sd-kpi sd-orange"><span class="sd-kpi__val">{{ dashboard.tauxCompletion }}%</span><span class="sd-kpi__lbl">Complétion</span></div>
          <div class="sd-kpi sd-purple"><span class="sd-kpi__val">{{ formatTime(dashboard.tempsMoyen) }}</span><span class="sd-kpi__lbl">Temps moyen</span></div>
        </div>
        <div class="sd-grid">
          <div class="sd-card">
            <h4><mat-icon>people</mat-icon> Par collaborateur</h4>
            <table class="sd-table">
              <thead><tr><th>Collaborateur</th><th>Total</th><th>Terminées</th><th>Temps</th></tr></thead>
              <tbody>
                @for (c of dashboard.parCollaborateur; track c.name) {
                  <tr>
                    <td>{{ c.name }}</td><td class="n">{{ c.total }}</td>
                    <td><span class="prog"><span class="prog-fill" [style.width.%]="c.total > 0 ? (c.terminees / c.total * 100) : 0"></span></span><span class="n">{{ c.terminees }}</span></td>
                    <td class="n">{{ formatTime(c.tempsTotal) }}</td>
                  </tr>
                }
                @if (dashboard.parCollaborateur.length === 0) { <tr><td colspan="4" class="sd-empty-row">Aucune donnée</td></tr> }
              </tbody>
            </table>
          </div>
          <div class="sd-card">
            <h4><mat-icon>category</mat-icon> Par type de tâche</h4>
            <div class="type-rows">
              @for (t of dashboard.parType; track t.type) {
                <div class="type-row">
                  <span class="type-badge type-{{ t.type.toLowerCase() }}">{{ t.type }}</span>
                  <div class="type-bar-wrap"><div class="type-bar" [style.width.%]="dashboard.total > 0 ? (t.count / dashboard.total * 100) : 0"></div></div>
                  <span class="n">{{ t.count }}</span>
                </div>
              }
              @if (dashboard.parType.length === 0) { <p class="sd-empty-row">Aucune donnée</p> }
            </div>
          </div>
        </div>
      } @else {
        <div class="sd-loading"><mat-icon>hourglass_empty</mat-icon><p>Chargement…</p></div>
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
    .sd-green .sd-kpi__val { color: #15803d; } .sd-blue .sd-kpi__val { color: #1d4ed8; }
    .sd-red .sd-kpi__val { color: #dc2626; } .sd-orange .sd-kpi__val { color: #d97706; } .sd-purple .sd-kpi__val { color: #7c3aed; }
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
    .type-tva { background: #fef9c3; color: #854d0e; } .type-paie { background: #dbeafe; color: #1e40af; }
    .type-achats { background: #fce7f3; color: #9d174d; } .type-ventes { background: #dcfce7; color: #14532d; }
    .type-rb { background: #f0fdf4; color: #15803d; } .type-gv { background: #ede9fe; color: #5b21b6; }
    .type-dr { background: #fff7ed; color: #c2410c; } .type-autre { background: #f1f5f9; color: #475569; }
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

  ngOnInit() { this.semaine = this.currentWeek; this.load(); }
  load() { this.dashboard = null; this.tasksService.getDashboard(this.semaine).subscribe(d => this.dashboard = d); }

  exportExcel() {
    if (!this.dashboard) return;
    this.tasksService.getAllGlobal().subscribe(allTasks => {
      const tasks = allTasks.filter(t => t.semaine === this.semaine);
      const wb = XLSX.utils.book_new();
      const rows: any[][] = [];
      rows.push([`Rapport hebdomadaire – Semaine : ${this.semaine}`]); rows.push([]);
      rows.push(['ID', 'DATE', 'HEURE DEBUT', 'COLLAB MADA', 'CLIENT', 'TACHE', 'TYPE', 'ATTRIBUE PAR', 'STATUT', 'HEURE FIN', 'TEMPS D\'EXECUTION (min)', 'SEMAINE']);
      for (const t of tasks) {
        rows.push([t.taskId ?? '', t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : '',
          t.heureDebut ?? '', t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : '',
          t.client?.nom ?? '', t.titre, t.type ?? '',
          t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : '',
          this.statutLabelFr(t.statut), t.heureFin ?? '', t.tempsExecution ?? '', t.semaine ?? this.semaine]);
      }
      rows.push([]); rows.push(['Indicateurs hebdomadaires']);
      rows.push(['Total des tâches', this.dashboard!.total]); rows.push(['Tâches terminées', this.dashboard!.terminees]);
      rows.push(['Taux de complétion', `${this.dashboard!.tauxCompletion}%`]); rows.push(['Temps moyen (min)', this.dashboard!.tempsMoyen]);
      rows.push([]); rows.push(['Par collaborateur']); rows.push(['Collaborateur', 'Total', 'Terminées', 'Temps total (min)']);
      for (const c of this.dashboard!.parCollaborateur) rows.push([c.name, c.total, c.terminees, c.tempsTotal]);
      rows.push([]); rows.push(['Par type de tâche']); rows.push(['Type', 'Nombre']);
      for (const t of this.dashboard!.parType) rows.push([t.type, t.count]);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 28 }, { wch: 30 }, { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, ws, `Semaine ${this.semaine}`);
      XLSX.writeFile(wb, `Rapport_hebdo_S${this.semaine}.xlsx`);
    });
  }

  private statutLabelFr(s: string): string {
    const m: Record<string, string> = { A_FAIRE: 'À faire', EN_COURS: 'En cours', TERMINEE: 'Terminé', NON_FAIT: 'Non fait', EN_ATTENTE: 'En attente' };
    return m[s] ?? s;
  }
  formatTime(minutes: number): string {
    if (!minutes || minutes <= 0) return '—';
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const h = Math.floor(minutes / 60); const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }
}

// ─── Dialog Création Tâche — style Jira/Linear ───────────────────────────────
@Component({
  selector: 'app-create-task-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule, MatDialogModule],
  template: `
    <div class="ct-wrap">
      <!-- Header -->
      <div class="ct-header">
        <div class="ct-header__icon"><mat-icon>add_task</mat-icon></div>
        <span class="ct-header__title">Nouvelle tâche</span>
        <button mat-icon-button class="ct-close" (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>

      <div class="ct-body">
        <!-- Type selector -->
        <div class="ct-section-label">Type de tâche</div>
        <div class="type-picker">
          @for (t of taskTypes; track t.value) {
            <button class="type-chip"
                    [class.type-chip--active]="selectedType === t.value"
                    [style.--chip-color]="t.color"
                    [style.--chip-bg]="t.bg"
                    (click)="selectedType = t.value">
              <mat-icon>{{ t.icon }}</mat-icon>
              <span>{{ t.label }}</span>
            </button>
          }
        </div>

        <!-- Titre -->
        <div class="ct-section-label">Titre <span class="required">*</span></div>
        <input class="ct-title-input" [(ngModel)]="titre" placeholder="Décrivez la tâche en quelques mots..." />

        <!-- Ligne client + assigné -->
        <div class="ct-row">
          <div class="ct-field">
            <div class="ct-section-label">Dossier client <span class="required">*</span></div>
            <select class="ct-select" [(ngModel)]="clientId">
              <option [value]="null" disabled>— Sélectionner —</option>
              @for (c of data.clients; track c.id) {
                <option [value]="c.id">{{ c.nom }}</option>
              }
            </select>
          </div>
          <div class="ct-field">
            <div class="ct-section-label">Assigner à</div>
            <select class="ct-select" [(ngModel)]="assigneeId">
              <option [value]="null">— Non assignée —</option>
              @for (u of data.users; track u.id) {
                <option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</option>
              }
            </select>
          </div>
        </div>

        <!-- Priorité + échéance -->
        <div class="ct-row">
          <div class="ct-field">
            <div class="ct-section-label">Priorité</div>
            <div class="prio-picker">
              <button class="prio-btn" [class.prio-btn--active]="priorite === 'BASSE'" (click)="priorite = 'BASSE'">
                <mat-icon class="prio-low">arrow_downward</mat-icon> Basse
              </button>
              <button class="prio-btn" [class.prio-btn--active]="priorite === 'NORMALE'" (click)="priorite = 'NORMALE'">
                <mat-icon class="prio-mid">remove</mat-icon> Normale
              </button>
              <button class="prio-btn" [class.prio-btn--active]="priorite === 'HAUTE'" (click)="priorite = 'HAUTE'">
                <mat-icon class="prio-high">arrow_upward</mat-icon> Haute
              </button>
            </div>
          </div>
          <div class="ct-field">
            <div class="ct-section-label">Échéance</div>
            <input class="ct-date-input" type="date" [(ngModel)]="dateEcheance" />
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="ct-footer">
        <button mat-stroked-button class="ct-btn-cancel" (click)="dialogRef.close()">Annuler</button>
        <button class="ct-btn-create" [disabled]="!titre.trim() || !clientId" (click)="create()">
          <mat-icon>add</mat-icon> Créer la tâche
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ct-wrap { display: flex; flex-direction: column; width: 580px; max-height: 90vh; }

    /* Header */
    .ct-header {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 20px 16px; border-bottom: 1px solid #f1f5f9;
    }
    .ct-header__icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      display: flex; align-items: center; justify-content: center;
    }
    .ct-header__icon mat-icon { color: white; font-size: 18px; width: 18px; height: 18px; }
    .ct-header__title { font-size: 16px; font-weight: 700; color: #0f172a; flex: 1; }
    .ct-close { color: #94a3b8 !important; }

    /* Body */
    .ct-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; flex: 1; }
    .ct-section-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
    .required { color: #ef4444; }

    /* Type picker */
    .type-picker { display: flex; flex-wrap: wrap; gap: 6px; }
    .type-chip {
      display: flex; align-items: center; gap: 5px;
      padding: 5px 10px; border-radius: 8px; border: 1.5px solid #e2e8f0;
      background: white; font-size: 12px; font-weight: 600; color: #475569;
      cursor: pointer; transition: all .12s;
    }
    .type-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .type-chip:hover { border-color: var(--chip-color); color: var(--chip-color); background: var(--chip-bg); }
    .type-chip--active { border-color: var(--chip-color) !important; color: var(--chip-color) !important; background: var(--chip-bg) !important; font-weight: 700; }

    /* Title input */
    .ct-title-input {
      width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0;
      border-radius: 10px; font-size: 15px; font-weight: 500; color: #1e293b;
      font-family: inherit; transition: border-color .15s; box-sizing: border-box;
    }
    .ct-title-input:focus { outline: none; border-color: #6366f1; }
    .ct-title-input::placeholder { color: #94a3b8; font-weight: 400; }

    /* Row */
    .ct-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .ct-field { display: flex; flex-direction: column; }

    /* Select */
    .ct-select {
      width: 100%; padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px;
      font-size: 13px; color: #1e293b; font-family: inherit; background: white;
      cursor: pointer; transition: border-color .15s;
    }
    .ct-select:focus { outline: none; border-color: #6366f1; }

    /* Date input */
    .ct-date-input {
      width: 100%; padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px;
      font-size: 13px; color: #1e293b; font-family: inherit; transition: border-color .15s;
      box-sizing: border-box;
    }
    .ct-date-input:focus { outline: none; border-color: #6366f1; }

    /* Priority picker */
    .prio-picker { display: flex; gap: 6px; }
    .prio-btn {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
      padding: 7px 4px; border-radius: 8px; border: 1.5px solid #e2e8f0;
      background: white; font-size: 12px; font-weight: 600; color: #64748b;
      cursor: pointer; transition: all .12s;
    }
    .prio-btn mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .prio-btn:hover { border-color: #cbd5e1; background: #f8fafc; }
    .prio-low  { color: #16a34a; }
    .prio-mid  { color: #94a3b8; }
    .prio-high { color: #dc2626; }
    .prio-btn--active:has(.prio-low)  { border-color: #86efac; background: #f0fdf4; color: #15803d; }
    .prio-btn--active:has(.prio-mid)  { border-color: #cbd5e1; background: #f8fafc; color: #475569; }
    .prio-btn--active:has(.prio-high) { border-color: #fca5a5; background: #fff1f2; color: #dc2626; }

    /* Footer */
    .ct-footer {
      display: flex; align-items: center; justify-content: flex-end; gap: 10px;
      padding: 14px 20px; border-top: 1px solid #f1f5f9;
    }
    .ct-btn-cancel { border-radius: 8px !important; color: #64748b !important; border-color: #e2e8f0 !important; }
    .ct-btn-create {
      display: flex; align-items: center; gap: 6px;
      padding: 9px 20px; border-radius: 8px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white; font-size: 13.5px; font-weight: 600;
      box-shadow: 0 2px 8px rgba(99,102,241,.30);
      transition: transform .12s, box-shadow .12s;
    }
    .ct-btn-create:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,.40); }
    .ct-btn-create:disabled { opacity: .5; cursor: not-allowed; }
    .ct-btn-create mat-icon { font-size: 17px; width: 17px; height: 17px; }
  `],
})
export class CreateTaskDialogComponent {
  private tasksService = inject(TasksService);
  private toast = inject(ToastService);
  dialogRef = inject(MatDialogRef<CreateTaskDialogComponent>);
  data: { clients: Client[]; users: User[] } = inject(MAT_DIALOG_DATA);

  titre = '';
  selectedType = 'AUTRE';
  clientId: number | null = null;
  assigneeId: number | null = null;
  priorite = 'NORMALE';
  dateEcheance = '';

  taskTypes = [
    { value: 'TVA',    label: 'TVA',    icon: 'receipt_long',    color: '#854d0e', bg: '#fef9c3' },
    { value: 'PAIE',   label: 'Paie',   icon: 'people',          color: '#1e40af', bg: '#dbeafe' },
    { value: 'ACHATS', label: 'Achats', icon: 'shopping_cart',   color: '#9d174d', bg: '#fce7f3' },
    { value: 'VENTES', label: 'Ventes', icon: 'trending_up',     color: '#14532d', bg: '#dcfce7' },
    { value: 'RB',     label: 'Relevé', icon: 'account_balance', color: '#15803d', bg: '#f0fdf4' },
    { value: 'GV',     label: 'GV',     icon: 'bar_chart',       color: '#5b21b6', bg: '#ede9fe' },
    { value: 'DR',     label: 'Dossier',icon: 'folder_open',     color: '#c2410c', bg: '#fff7ed' },
    { value: 'AUTRE',  label: 'Autre',  icon: 'more_horiz',      color: '#475569', bg: '#f1f5f9' },
  ];

  create() {
    if (!this.titre.trim() || !this.clientId) return;
    this.tasksService.create(this.clientId!, {
      titre:        this.titre,
      type:         this.selectedType as any,
      priorite:     this.priorite as any,
      dateEcheance: this.dateEcheance || undefined,
      assigneeId:   this.assigneeId  || undefined,
    }).subscribe(() => {
      this.toast.success('Tâche créée');
      this.dialogRef.close('created');
    });
  }
}

// ─── Dialog Détail Tâche — style Linear/Jira ─────────────────────────────────
@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatTooltipModule, MatDialogModule, LocalDatePipe],
  template: `
    <div class="td-wrap">
      <!-- Header -->
      <div class="td-header">
        <div class="td-header__left">
          <span class="td-id">{{ task.taskId ?? '—' }}</span>
          <span class="type-badge type-{{ (task.type ?? 'autre').toLowerCase() }}">{{ task.type ?? 'AUTRE' }}</span>
        </div>
        <div class="td-header__right">
          <span class="td-date-created">Créée le {{ task.createdAt | localDate:'dd/MM/yyyy' }}</span>
          <button mat-icon-button class="td-close" (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
        </div>
      </div>

      <!-- Title area -->
      <div class="td-title-area">
        @if (canEdit) {
          <input class="td-title-input" [formControl]="titleCtrl" placeholder="Titre de la tâche..." />
        } @else {
          <h2 class="td-title-static">{{ task.titre }}</h2>
        }
        @if (task.client) {
          <a class="td-client-chip" [routerLink]="['/clients', task.client.id]" (click)="dialogRef.close()">
            <mat-icon>folder_shared</mat-icon>{{ task.client.nom }}
          </a>
        }
      </div>

      @if (!canEdit) {
        <div class="td-readonly-banner">
          <mat-icon>lock_outline</mat-icon>
          @if (canChangeStatut) {
            Vous pouvez uniquement modifier le statut
          } @else {
            Lecture seule — seul <strong>{{ task.createdBy?.firstName }} {{ task.createdBy?.lastName }}</strong> peut modifier
          }
        </div>
      }

      <!-- Two-column body -->
      <div class="td-body">

        <!-- Left: static info -->
        <div class="td-left">
          <div class="td-prop-row">
            <span class="td-prop-lbl">Créée par</span>
            <div class="td-assignee-display">
              <div class="td-av">{{ initials(task.createdBy) }}</div>
              <span>{{ task.createdBy ? (task.createdBy.firstName + ' ' + task.createdBy.lastName) : '—' }}</span>
            </div>
          </div>
          <div class="td-prop-row">
            <span class="td-prop-lbl">Temps exéc.</span>
            <span class="td-prop-val">
              @if (task.tempsExecution && task.tempsExecution > 0) {
                <span class="time-badge">{{ formatTime(task.tempsExecution) }}</span>
              } @else { <span class="none">—</span> }
            </span>
          </div>
          @if (task.heureDebut && task.heureFin) {
            <div class="td-prop-row">
              <span class="td-prop-lbl">Horaires</span>
              <span class="td-prop-val">{{ task.heureDebut | localDate:'HH:mm' }} → {{ task.heureFin | localDate:'HH:mm' }}</span>
            </div>
          }
        </div>

        <!-- Right: editable properties -->
        <div class="td-right">

          <!-- Status -->
          <div class="td-prop-row">
            <span class="td-prop-lbl">Statut</span>
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
          </div>

          <!-- Priorité -->
          <div class="td-prop-row">
            <span class="td-prop-lbl">Priorité</span>
            @if (canEdit) {
              <div class="prio-picker">
                @for (p of priorities; track p.value) {
                  <button class="prio-chip"
                          [class.prio-chip--active]="currentPrio === p.value"
                          [style.--pc]="p.color" [style.--pbg]="p.bg"
                          (click)="currentPrio = p.value; form.markAsDirty()">
                    <mat-icon>{{ p.icon }}</mat-icon>{{ p.label }}
                  </button>
                }
              </div>
            } @else {
              <span class="prio-static prio-{{ (form.value.priorite ?? 'normale').toLowerCase() }}">
                {{ form.value.priorite ?? 'NORMALE' }}
              </span>
            }
          </div>

          <!-- Assigné -->
          <div class="td-prop-row">
            <span class="td-prop-lbl">Assigné à</span>
            @if (canEdit) {
              <select class="td-prop-select" [formControl]="assigneeCtrl">
                <option [value]="null">— Non assignée —</option>
                @for (u of data.users; track u.id) {
                  <option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</option>
                }
              </select>
            } @else {
              <div class="td-assignee-display">
                @if (task.assignee) {
                  <div class="td-av">{{ initials(task.assignee) }}</div>
                  <span>{{ task.assignee.firstName }} {{ task.assignee.lastName }}</span>
                } @else { <span class="none">—</span> }
              </div>
            }
          </div>

          <!-- Échéance -->
          <div class="td-prop-row">
            <span class="td-prop-lbl">Échéance</span>
            @if (canEdit) {
              <input class="td-prop-date" type="date" [formControl]="echeanceCtrl" />
            } @else {
              <span class="td-prop-val" [class.overdue]="isOverdue()">
                {{ task.dateEcheance ? (task.dateEcheance | localDate:'dd MMM yyyy') : '—' }}
              </span>
            }
          </div>

          <!-- H. Sup -->
          @if (canEdit) {
            <div class="td-prop-row">
              <span class="td-prop-lbl">H. Sup</span>
              <input class="td-prop-input" type="number" [formControl]="heuresSupCtrl" min="0" step="0.5" placeholder="0" />
            </div>
          }

        </div>
      </div>

      <!-- Footer -->
      <div class="td-footer">
        @if (canEdit) {
          <button class="td-btn-del" (click)="delete()">
            <mat-icon>delete_outline</mat-icon> Supprimer
          </button>
        }
        <span class="td-spacer"></span>
        <button mat-stroked-button class="td-btn-cancel" (click)="dialogRef.close()">Annuler</button>
        @if (canChangeStatut) {
          <button class="td-btn-save" (click)="save()" [disabled]="!isDirty()">
            <mat-icon>check</mat-icon> Enregistrer
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .td-wrap { display: flex; flex-direction: column; width: 720px; max-height: 90vh; }

    /* Header */
    .td-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px 10px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
    .td-header__left { display: flex; align-items: center; gap: 8px; }
    .td-header__right { display: flex; align-items: center; gap: 8px; }
    .td-id { font-family: monospace; font-size: 11px; color: #94a3b8; background: #f1f5f9; padding: 3px 8px; border-radius: 5px; }
    .td-date-created { font-size: 11px; color: #94a3b8; }
    .td-close { color: #94a3b8 !important; }

    /* Type badge */
    .type-badge { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
    .type-tva { background: #fef9c3; color: #854d0e; } .type-paie { background: #dbeafe; color: #1e40af; }
    .type-achats { background: #fce7f3; color: #9d174d; } .type-ventes { background: #dcfce7; color: #14532d; }
    .type-rb { background: #f0fdf4; color: #15803d; } .type-gv { background: #ede9fe; color: #5b21b6; }
    .type-dr { background: #fff7ed; color: #c2410c; } .type-autre { background: #f1f5f9; color: #475569; }

    /* Title */
    .td-title-area { padding: 16px 20px 10px; border-bottom: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
    .td-title-input {
      font-size: 19px; font-weight: 700; color: #0f172a; border: none; background: transparent;
      font-family: inherit; padding: 0; width: 100%; line-height: 1.3;
    }
    .td-title-input:focus { outline: none; }
    .td-title-input::placeholder { color: #94a3b8; font-weight: 400; }
    .td-title-static { font-size: 19px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.3; }
    .td-client-chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px 3px 6px; border-radius: 20px;
      background: #eef2ff; color: #4f46e5; font-size: 12px; font-weight: 600;
      text-decoration: none; width: fit-content;
      transition: background .12s;
    }
    .td-client-chip:hover { background: #e0e7ff; }
    .td-client-chip mat-icon { font-size: 13px; width: 13px; height: 13px; }

    /* Readonly banner */
    .td-readonly-banner { display: flex; align-items: center; gap: 7px; background: #fefce8; border-bottom: 1px solid #fde68a; padding: 8px 20px; font-size: 12px; color: #92400e; flex-shrink: 0; }
    .td-readonly-banner mat-icon { font-size: 15px; width: 15px; height: 15px; color: #d97706; flex-shrink: 0; }

    /* Body */
    .td-body { display: grid; grid-template-columns: 1fr 1.4fr; gap: 0; flex: 1; overflow-y: auto; }
    .td-left { padding: 18px 16px 18px 20px; border-right: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 4px; }
    .td-right { padding: 18px 20px 18px 18px; display: flex; flex-direction: column; gap: 4px; }

    /* Property rows */
    .td-prop-row { display: flex; align-items: center; gap: 12px; min-height: 38px; }
    .td-prop-lbl { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .4px; min-width: 80px; flex-shrink: 0; }
    .td-prop-val { font-size: 13px; color: #1e293b; font-weight: 500; }
    .td-prop-val.overdue { color: #dc2626; font-weight: 600; }
    .none { color: #cbd5e1; font-size: 13px; }
    .time-badge { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 6px; font-family: monospace; }

    /* Assignee */
    .td-assignee-display { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #1e293b; font-weight: 500; }
    .td-av { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #4f46e5); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: white; flex-shrink: 0; }

    /* Status select */
    .statut-select {
      border: 1.5px solid transparent; outline: none; border-radius: 20px;
      padding: 4px 26px 4px 10px; font-size: 12px; font-weight: 700; cursor: pointer;
      appearance: none; -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 7px center;
      transition: opacity .15s;
    }
    .statut-select:disabled { opacity: .7; cursor: default; }
    .statut-a_faire   { background-color: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .statut-en_cours  { background-color: #fffbeb; color: #d97706; border-color: #fcd34d; }
    .statut-terminee  { background-color: #f0fdf4; color: #15803d; border-color: #86efac; }
    .statut-non_fait  { background-color: #fff1f2; color: #e11d48; border-color: #fda4af; }
    .statut-en_attente { background-color: #f5f3ff; color: #7c3aed; border-color: #c4b5fd; }

    /* Priority picker */
    .prio-picker { display: flex; gap: 5px; }
    .prio-chip {
      display: flex; align-items: center; gap: 3px;
      padding: 4px 9px; border-radius: 7px; border: 1.5px solid #e2e8f0;
      background: white; font-size: 11.5px; font-weight: 600; color: #64748b;
      cursor: pointer; transition: all .12s;
    }
    .prio-chip mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .prio-chip:hover { border-color: #cbd5e1; background: #f8fafc; }
    .prio-chip--active { border-color: var(--pc) !important; background: var(--pbg) !important; color: var(--pc) !important; }
    .prio-static { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: #f1f5f9; color: #475569; }
    .prio-static.prio-haute  { background: #fee2e2; color: #dc2626; }
    .prio-static.prio-basse  { background: #f0fdf4; color: #16a34a; }

    /* Prop inputs */
    .td-prop-select, .td-prop-date, .td-prop-input {
      flex: 1; padding: 5px 10px; border: 1.5px solid #e2e8f0; border-radius: 8px;
      font-size: 13px; color: #1e293b; font-family: inherit; background: white;
      transition: border-color .15s;
    }
    .td-prop-select:focus, .td-prop-date:focus, .td-prop-input:focus { outline: none; border-color: #6366f1; }

    /* Footer */
    .td-footer { display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-top: 1px solid #f1f5f9; flex-shrink: 0; }
    .td-spacer { flex: 1; }
    .td-btn-del {
      display: flex; align-items: center; gap: 5px;
      padding: 6px 14px; border-radius: 8px; border: 1.5px solid #fecaca;
      background: white; color: #ef4444; font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background .12s;
    }
    .td-btn-del:hover { background: #fff1f2; }
    .td-btn-del mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .td-btn-cancel { border-radius: 8px !important; color: #64748b !important; border-color: #e2e8f0 !important; }
    .td-btn-save {
      display: flex; align-items: center; gap: 5px;
      padding: 7px 18px; border-radius: 8px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white; font-size: 13px; font-weight: 600;
      box-shadow: 0 2px 8px rgba(99,102,241,.25);
      transition: transform .12s, box-shadow .12s;
    }
    .td-btn-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,.35); }
    .td-btn-save:disabled { opacity: .4; cursor: not-allowed; }
    .td-btn-save mat-icon { font-size: 15px; width: 15px; height: 15px; }
  `],
})
export class TaskDetailDialogComponent {
  private tasksService = inject(TasksService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  dialogRef = inject(MatDialogRef<TaskDetailDialogComponent>);
  data: { task: Task; users: User[]; currentUserId: number; currentUserIsAdmin: boolean } = inject(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);

  task = this.data.task;
  currentStatut: TaskStatut = this.data.task.statut;
  currentPrio: string = this.data.task.priorite ?? 'NORMALE';
  private _initialStatut = this.data.task.statut;
  private _initialPrio = this.data.task.priorite ?? 'NORMALE';

  titleCtrl    = this.fb.control(this.task.titre, Validators.required);
  assigneeCtrl = this.fb.control(this.task.assignee?.id ?? null);
  echeanceCtrl = this.fb.control(this.task.dateEcheance ? this.task.dateEcheance.substring(0, 10) : '');
  heuresSupCtrl = this.fb.control(this.task.heuresSup ?? null);

  // legacy form kept minimal (unused visually but needed for isDirty check)
  form = this.fb.group({ priorite: [this.currentPrio] });

  priorities = [
    { value: 'BASSE',   label: 'Basse',   icon: 'arrow_downward', color: '#16a34a', bg: '#f0fdf4' },
    { value: 'NORMALE', label: 'Normale', icon: 'remove',         color: '#64748b', bg: '#f8fafc' },
    { value: 'HAUTE',   label: 'Haute',   icon: 'arrow_upward',   color: '#dc2626', bg: '#fee2e2' },
  ];

  get canEdit(): boolean {
    return this.data.currentUserIsAdmin || this.data.currentUserId === this.task.createdBy?.id;
  }
  get canChangeStatut(): boolean {
    return this.canEdit || this.data.currentUserId === this.task.assignee?.id;
  }

  isDirty(): boolean {
    return this.titleCtrl.dirty || this.assigneeCtrl.dirty || this.echeanceCtrl.dirty ||
           this.heuresSupCtrl.dirty || this.currentStatut !== this._initialStatut || this.currentPrio !== this._initialPrio;
  }

  onStatutChange(statut: TaskStatut) { this.currentStatut = statut; }

  save() {
    this.tasksService.update(this.task.clientId, this.task.id, {
      titre:        this.titleCtrl.value!,
      statut:       this.currentStatut,
      priorite:     this.currentPrio as any,
      assigneeId:   this.assigneeCtrl.value ?? undefined,
      dateEcheance: this.echeanceCtrl.value || undefined,
      heuresSup:    this.heuresSupCtrl.value ?? undefined,
    }).subscribe(() => {
      this.toast.success('Tâche mise à jour');
      this.dialogRef.close('updated');
    });
  }

  delete() {
    this.confirm.confirm('Supprimer cette tâche ?').subscribe(ok => {
      if (!ok) return;
      this.tasksService.delete(this.task.clientId, this.task.id).subscribe(() => {
        this.toast.success('Tâche supprimée');
        this.dialogRef.close('deleted');
      });
    });
  }

  initials(u: any): string {
    return u ? (u.firstName?.[0] || '') + (u.lastName?.[0] || '') : '?';
  }

  isOverdue(): boolean {
    if (!this.task.dateEcheance || this.task.statut === 'TERMINEE') return false;
    return new Date(this.task.dateEcheance) < new Date();
  }

  formatTime(minutes: number): string {
    if (!minutes || minutes <= 0) return '—';
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const h = Math.floor(minutes / 60); const m = Math.round(minutes % 60);
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
    LocalDatePipe, DragDropModule,
  ],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-header">
        <div class="page-header__left">
          <div class="page-icon-wrap"><mat-icon>task_alt</mat-icon></div>
          <div>
            <h1>Tâches</h1>
            <p>{{ tasks.length }} tâche{{ tasks.length !== 1 ? 's' : '' }} au total</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="btn-rapport" (click)="openRapport()">
            <mat-icon>insert_chart</mat-icon> Rapport hebdomadaire
          </button>
          <button class="btn-new" (click)="openCreate()">
            <mat-icon>add</mat-icon> Nouvelle tâche
          </button>
        </div>
      </div>

      <!-- ── Filter bar ── -->
      <div class="filter-bar">

        <div class="filter-bar__chips">

          <!-- Mes tâches -->
          <button class="fchip" [class.fchip--active]="mesTachesOnly" (click)="toggleMesTaches()">
            <mat-icon>person</mat-icon>
            <span>Mes tâches</span>
            @if (myTaskCount > 0) {
              <span class="fchip__badge">{{ myTaskCount }}</span>
            }
          </button>

          <!-- Séparateur -->
          <div class="filter-sep"></div>

          <!-- Dossier -->
          <label class="fchip fchip--select" [class.fchip--active]="filterClientId !== null">
            <mat-icon>folder_open</mat-icon>
            <span>{{ filterClientId ? (getClientName(filterClientId)) : 'Dossier' }}</span>
            <mat-icon class="fchip__caret">expand_more</mat-icon>
            <select [(ngModel)]="filterClientId" (ngModelChange)="applyFilter()">
              <option [ngValue]="null">Tous les dossiers</option>
              @for (c of clients; track c.id) {
                <option [ngValue]="c.id">{{ c.nom }}</option>
              }
            </select>
          </label>

          <!-- Assigné -->
          <label class="fchip fchip--select" [class.fchip--active]="filterAssigneeId !== null">
            <mat-icon>people</mat-icon>
            <span>{{ filterAssigneeId ? getUserName(filterAssigneeId) : 'Assigné à' }}</span>
            <mat-icon class="fchip__caret">expand_more</mat-icon>
            <select [(ngModel)]="filterAssigneeId" (ngModelChange)="applyFilter()">
              <option [ngValue]="null">Tous</option>
              @for (u of users; track u.id) {
                <option [ngValue]="u.id">{{ u.firstName }} {{ u.lastName }}</option>
              }
            </select>
          </label>

          <!-- Type -->
          <label class="fchip fchip--select" [class.fchip--active]="filterType !== null">
            <mat-icon>label_outline</mat-icon>
            <span>{{ filterType ?? 'Type' }}</span>
            <mat-icon class="fchip__caret">expand_more</mat-icon>
            <select [(ngModel)]="filterType" (ngModelChange)="applyFilter()">
              <option [ngValue]="null">Tous les types</option>
              @for (t of taskTypes; track t.value) {
                <option [ngValue]="t.value">{{ t.label }}</option>
              }
            </select>
          </label>

          <!-- Reset -->
          @if (mesTachesOnly || filterClientId !== null || filterAssigneeId !== null || filterType !== null) {
            <button class="fchip fchip--reset" (click)="resetFilters()">
              <mat-icon>close</mat-icon>
              <span>Effacer</span>
            </button>
          }
        </div>

        <!-- Compteur -->
        <div class="filter-bar__count">
          <span class="filter-bar__num">{{ filteredTasks.length }}</span>
          <span>tâche{{ filteredTasks.length !== 1 ? 's' : '' }}</span>
        </div>

      </div>

      <!-- ── Kanban Board ── -->
      <div class="kanban-board" cdkDropListGroup>
        @for (col of kanbanCols; track col.statut) {
          <div class="kanban-col">

            <!-- Header colonne -->
            <div class="kanban-col__header kanban-col__header--{{ col.statut.toLowerCase() }}">
              <span class="kanban-col__dot"></span>
              <span class="kanban-col__label">{{ col.label }}</span>
              <span class="kanban-col__count">{{ col.tasks.length }}</span>
            </div>

            <!-- Drop zone -->
            <div class="kanban-col__body"
                 cdkDropList
                 [id]="col.statut"
                 [cdkDropListData]="col.tasks"
                 [cdkDropListConnectedTo]="colIds"
                 (cdkDropListDropped)="onDrop($event, col.statut)">

              @for (t of col.tasks; track t.id) {
                <div class="task-card"
                     [class.task-card--done]="t.statut === 'TERMINEE' || t.statut === 'NON_FAIT'"
                     cdkDrag
                     (click)="openDetail(t)">

                  <!-- Drag handle -->
                  <div class="card-drag-handle" cdkDragHandle>
                    <mat-icon>drag_indicator</mat-icon>
                  </div>

                  <!-- Accent priorité -->
                  <div class="card-prio-bar card-prio-bar--{{ (t.priorite ?? 'normale').toLowerCase() }}"></div>

                  <!-- Corps de la carte -->
                  <div class="card-body">

                    <!-- Ligne 1 : type + ID -->
                    <div class="card-meta">
                      @if (t.type) {
                        <span class="type-chip type-{{ t.type.toLowerCase() }}">{{ t.type }}</span>
                      }
                      <span class="card-id">{{ t.taskId ?? '' }}</span>
                    </div>

                    <!-- Titre -->
                    <p class="card-title">{{ t.titre }}</p>

                    <!-- Client -->
                    @if (t.client) {
                      <a class="card-client" [routerLink]="['/clients', t.client.id]" (click)="$event.stopPropagation()">
                        <mat-icon>folder_shared</mat-icon>{{ t.client.nom }}
                      </a>
                    }

                    <!-- Footer carte -->
                    <div class="card-footer">
                      <div class="card-footer__left">
                        @if (t.dateEcheance) {
                          <span class="card-due" [class.card-due--overdue]="isOverdue(t)">
                            <mat-icon>event</mat-icon>{{ t.dateEcheance | localDate:'dd MMM' }}
                          </span>
                        }
                        @if (t.tempsExecution && t.tempsExecution > 0) {
                          <span class="card-time"><mat-icon>schedule</mat-icon>{{ formatTime(t.tempsExecution) }}</span>
                        }
                        @if (t.heuresSup && t.heuresSup > 0) {
                          <span class="card-sup">+{{ formatTime(t.heuresSup * 60) }}</span>
                        }
                      </div>
                      <div class="card-footer__right">
                        @if (t.assignee) {
                          <div class="card-av" [matTooltip]="t.assignee.firstName + ' ' + t.assignee.lastName">
                            {{ t.assignee.firstName[0] }}{{ t.assignee.lastName[0] }}
                          </div>
                        }
                        <button mat-icon-button class="card-del" matTooltip="Supprimer"
                                (click)="$event.stopPropagation(); remove(t)">
                          <mat-icon>delete_outline</mat-icon>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Ghost de drag -->
                  <div *cdkDragPlaceholder class="card-drag-placeholder"></div>
                </div>
              }

              @if (col.tasks.length === 0) {
                <div class="kanban-empty">
                  <mat-icon>inbox</mat-icon>
                  <span>Aucune tâche</span>
                </div>
              }
            </div>
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    .page { padding: 32px 36px; }

    /* Header */
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .page-header__left { display: flex; align-items: center; gap: 14px; }
    .page-icon-wrap {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 3px 10px rgba(99,102,241,.25);
    }
    .page-icon-wrap mat-icon { color: white; font-size: 22px; width: 22px; height: 22px; }
    .page-header h1 { font-size: 20px; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2; }
    .page-header p { font-size: 12px; color: #94a3b8; margin: 0; }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .btn-rapport { border-radius: 10px !important; font-weight: 600; color: #6366f1 !important; border-color: #c7d2fe !important; gap: 6px; }
    .btn-rapport mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .btn-new {
      display: flex; align-items: center; gap: 6px;
      padding: 9px 18px; border-radius: 10px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white; font-size: 13.5px; font-weight: 600;
      box-shadow: 0 2px 8px rgba(99,102,241,.30);
      transition: transform .12s, box-shadow .12s;
    }
    .btn-new:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,.40); }
    .btn-new mat-icon { font-size: 17px; width: 17px; height: 17px; }

    /* ── Filter bar ─────────────────────────────────────── */
    .filter-bar {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; margin-bottom: 16px;
      background: white; border: 1px solid #e5e7eb; border-radius: 12px;
      padding: 8px 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,.04);
    }
    .filter-bar__chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

    .filter-sep { width: 1px; height: 22px; background: #e5e7eb; flex-shrink: 0; }

    /* Filter chip base */
    .fchip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 11px; border-radius: 20px; border: 1.5px solid #e5e7eb;
      background: #f9fafb; font-size: 12.5px; font-weight: 600; color: #4b5563;
      cursor: pointer; transition: all .13s; white-space: nowrap;
      position: relative; user-select: none;
    }
    .fchip mat-icon { font-size: 14px; width: 14px; height: 14px; flex-shrink: 0; }
    .fchip:hover { border-color: #c7d2fe; color: #4f46e5; background: #eef2ff; }
    .fchip--active {
      border-color: #6366f1; background: #eef2ff; color: #4338ca;
    }
    .fchip__badge {
      background: #6366f1; color: white; font-size: 10px; font-weight: 700;
      padding: 0 6px; border-radius: 20px; min-width: 18px; text-align: center;
    }
    .fchip__caret { color: #9ca3af; margin-left: -2px; transition: transform .15s; }
    .fchip--select { overflow: visible; }
    .fchip--select:hover .fchip__caret { transform: rotate(180deg); }

    /* Native select hidden under chip */
    .fchip--select select {
      position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer;
      font-size: 13px;
    }

    /* Reset chip */
    .fchip--reset {
      border-color: #fca5a5; background: #fff1f2; color: #dc2626;
    }
    .fchip--reset:hover { border-color: #f87171; background: #fee2e2; color: #b91c1c; }
    .fchip--reset mat-icon { color: #dc2626; }

    /* Count */
    .filter-bar__count {
      display: flex; align-items: center; gap: 5px;
      font-size: 12.5px; color: #6b7280; flex-shrink: 0;
    }
    .filter-bar__num { font-size: 18px; font-weight: 800; color: #1f2937; line-height: 1; }

    /* ── Kanban Board ──────────────────────────────────────── */
    .kanban-board {
      display: flex; gap: 14px;
      overflow-x: auto; padding-bottom: 20px; align-items: flex-start;
      min-height: calc(100vh - 280px);
    }
    .kanban-board::-webkit-scrollbar { height: 6px; }
    .kanban-board::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
    .kanban-board::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

    /* ── Colonne ─────────────────────────────────────────── */
    .kanban-col {
      min-width: 272px; max-width: 272px; flex-shrink: 0;
      display: flex; flex-direction: column; border-radius: 14px; overflow: hidden;
      background: #F3F4F6;
    }

    .kanban-col__header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; font-size: 12.5px; font-weight: 700;
      border-bottom: 2px solid transparent; flex-shrink: 0;
    }
    .kanban-col__dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .kanban-col__label { flex: 1; }
    .kanban-col__count {
      font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 20px;
      background: rgba(0,0,0,.08);
    }

    /* Couleurs par statut */
    .kanban-col__header--a_faire   { background: #EFF6FF; color: #1e40af; border-color: #93c5fd; }
    .kanban-col__header--a_faire .kanban-col__dot { background: #3b82f6; }
    .kanban-col__header--en_cours  { background: #FFFBEB; color: #92400e; border-color: #fcd34d; }
    .kanban-col__header--en_cours .kanban-col__dot { background: #f59e0b; }
    .kanban-col__header--terminee  { background: #F0FDF4; color: #14532d; border-color: #86efac; }
    .kanban-col__header--terminee .kanban-col__dot { background: #22c55e; }
    .kanban-col__header--non_fait  { background: #FFF1F2; color: #9f1239; border-color: #fca5a5; }
    .kanban-col__header--non_fait .kanban-col__dot { background: #ef4444; }
    .kanban-col__header--en_attente { background: #F5F3FF; color: #4c1d95; border-color: #c4b5fd; }
    .kanban-col__header--en_attente .kanban-col__dot { background: #8b5cf6; }

    .kanban-col__body {
      flex: 1; padding: 8px; display: flex; flex-direction: column; gap: 8px;
      overflow-y: auto; min-height: 80px;
    }
    .kanban-col__body::-webkit-scrollbar { width: 4px; }
    .kanban-col__body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }

    /* CDK drag-drop */
    .cdk-drop-list-dragging .task-card:not(.cdk-drag-placeholder) { transition: transform .25s cubic-bezier(.2,0,0,1); }
    .cdk-drag-animating { transition: transform .3s cubic-bezier(.2,0,0,1); }

    .card-drag-placeholder {
      height: 80px; border: 2px dashed #c7d2fe; border-radius: 10px;
      background: #eef2ff;
    }

    /* ── Carte tâche ─────────────────────────────────────── */
    .task-card {
      background: white; border-radius: 10px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
      cursor: pointer; transition: box-shadow .15s, transform .12s, border-color .15s;
      display: flex; overflow: hidden; position: relative;
    }
    .task-card:hover {
      box-shadow: 0 4px 16px rgba(0,0,0,.10);
      border-color: #c7d2fe; transform: translateY(-2px);
    }
    .task-card--done { opacity: .5; }
    .task-card--done:hover { opacity: .75; }

    /* Drag handle */
    .card-drag-handle {
      display: flex; align-items: center; justify-content: center;
      width: 18px; flex-shrink: 0; background: #f9fafb;
      border-right: 1px solid #f1f5f9; color: #d1d5db; cursor: grab;
      transition: background .12s, color .12s;
    }
    .card-drag-handle:active { cursor: grabbing; }
    .task-card:hover .card-drag-handle { background: #f1f5f9; color: #9ca3af; }
    .card-drag-handle mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Priority bar (gauche) */
    .card-prio-bar { width: 4px; flex-shrink: 0; }
    .card-prio-bar--haute   { background: linear-gradient(180deg, #f87171, #dc2626); }
    .card-prio-bar--normale { background: #e5e7eb; }
    .card-prio-bar--basse   { background: linear-gradient(180deg, #4ade80, #16a34a); }

    /* Card body */
    .card-body { flex: 1; padding: 11px 12px 10px; display: flex; flex-direction: column; gap: 7px; min-width: 0; }

    .card-meta { display: flex; align-items: center; gap: 6px; }
    .card-id { font-family: monospace; font-size: 10px; color: #9ca3af; background: #f9fafb; padding: 1px 5px; border-radius: 4px; }

    .card-title {
      font-size: 13px; font-weight: 600; color: #111827; line-height: 1.4;
      margin: 0; display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden;
    }
    .task-card--done .card-title { text-decoration: line-through; color: #9ca3af; }

    .card-client {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 600; color: #4f46e5;
      background: #eef2ff; padding: 2px 8px 2px 5px; border-radius: 20px;
      text-decoration: none; width: fit-content; transition: background .12s;
    }
    .card-client:hover { background: #e0e7ff; }
    .card-client mat-icon { font-size: 11px; width: 11px; height: 11px; }

    /* Card footer */
    .card-footer { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-top: 2px; }
    .card-footer__left { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .card-footer__right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

    .card-due {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 10.5px; color: #6b7280; white-space: nowrap;
    }
    .card-due mat-icon { font-size: 11px; width: 11px; height: 11px; }
    .card-due--overdue { color: #dc2626; font-weight: 700; }
    .card-due--overdue mat-icon { color: #dc2626; }

    .card-time {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 10.5px; color: #9ca3af; font-variant-numeric: tabular-nums;
    }
    .card-time mat-icon { font-size: 11px; width: 11px; height: 11px; }

    .card-sup { font-size: 10px; font-weight: 700; color: #d97706; background: #fef3c7; padding: 1px 5px; border-radius: 4px; }

    .card-av {
      width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700; color: white;
    }

    .card-del {
      width: 24px !important; height: 24px !important;
      color: #d1d5db !important; opacity: 0; transition: opacity .12s, color .12s;
    }
    .task-card:hover .card-del { opacity: 1; }
    .card-del:hover { color: #ef4444 !important; }
    .card-del mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Type chips */
    .type-chip { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 5px; white-space: nowrap; flex-shrink: 0; }
    .type-tva { background: #fef9c3; color: #854d0e; } .type-paie { background: #dbeafe; color: #1e40af; }
    .type-achats { background: #fce7f3; color: #9d174d; } .type-ventes { background: #dcfce7; color: #14532d; }
    .type-rb { background: #f0fdf4; color: #15803d; } .type-gv { background: #ede9fe; color: #5b21b6; }
    .type-dr { background: #fff7ed; color: #c2410c; } .type-autre { background: #f1f5f9; color: #475569; }

    /* Empty column */
    .kanban-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      padding: 28px 16px; color: #d1d5db; font-size: 12px; border: 2px dashed #e5e7eb;
      border-radius: 10px; text-align: center;
    }
    .kanban-empty mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .none { color: #d1d5db; }
  `],
})
export class TasksGlobalComponent implements OnInit, OnDestroy {
  private tasksService = inject(TasksService);
  private clientsService = inject(ClientsService);
  private usersService = inject(UsersService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private dialog = inject(MatDialog);
  private notifStream = inject(NotificationStreamService);
  private sub = new Subscription();
  private auth = inject(AuthService);

  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  clients: Client[] = [];
  users: User[] = [];

  mesTachesOnly = false;
  filterClientId: number | null = null;
  filterAssigneeId: number | null = null;
  filterType: string | null = null;

  kanbanCols: { statut: TaskStatut; label: string; tasks: Task[] }[] = [];
  colIds: string[] = [];

  get currentUserId(): number | null { return this.auth.currentUser()?.id ?? null; }
  get myTaskCount(): number { return this.tasks.filter(t => t.assignee?.id === this.currentUserId && !['TERMINEE','NON_FAIT'].includes(t.statut)).length; }

  taskTypes = [
    { value: 'TVA', label: 'TVA' }, { value: 'PAIE', label: 'Paie' },
    { value: 'ACHATS', label: 'Achats' }, { value: 'VENTES', label: 'Ventes' },
    { value: 'RB', label: 'Relevé Bancaire' }, { value: 'GV', label: 'GV' },
    { value: 'DR', label: 'Dossier Révision' }, { value: 'AUTRE', label: 'Autre' },
  ];

  columns = [
    { statut: 'A_FAIRE'    as TaskStatut, label: 'À faire' },
    { statut: 'EN_COURS'   as TaskStatut, label: 'En cours' },
    { statut: 'TERMINEE'   as TaskStatut, label: 'Terminées' },
    { statut: 'NON_FAIT'   as TaskStatut, label: 'Non fait' },
    { statut: 'EN_ATTENTE' as TaskStatut, label: 'En attente' },
  ];

  ngOnInit() {
    this.load();
    this.clientsService.getAll().subscribe(c => this.clients = c);
    this.usersService.getAssignable().subscribe(u => this.users = u);
    this.sub.add(this.notifStream.newNotif$.pipe(filter(n => n.type === 'TASK_ASSIGNED')).subscribe(() => this.load()));
  }

  ngOnDestroy() { this.sub.unsubscribe(); }

  load() {
    this.tasksService.getAllGlobal().subscribe(t => { this.tasks = t; this.applyFilter(); });
  }

  openCreate() {
    const ref = this.dialog.open(CreateTaskDialogComponent, {
      width: '600px', maxWidth: '96vw',
      data: { clients: this.clients, users: this.users },
    });
    ref.afterClosed().subscribe(result => { if (result === 'created') this.load(); });
  }

  openDetail(task: Task) {
    const ref = this.dialog.open(TaskDetailDialogComponent, {
      width: '760px', maxWidth: '96vw',
      data: { task, users: this.users, currentUserId: this.auth.currentUser()?.id, currentUserIsAdmin: this.auth.isAdmin() },
    });
    ref.afterClosed().subscribe(result => { if (result === 'updated' || result === 'deleted') this.load(); });
  }

  openRapport() {
    this.dialog.open(SyntheseDialogComponent, { width: '860px', maxWidth: '96vw', panelClass: 'synthese-dialog-panel' });
  }

  applyFilter() {
    this.filteredTasks = this.tasks.filter(t => {
      if (this.mesTachesOnly    && t.assignee?.id  !== this.currentUserId)    return false;
      if (this.filterClientId   && t.clientId      !== this.filterClientId)   return false;
      if (this.filterAssigneeId && t.assignee?.id  !== this.filterAssigneeId) return false;
      if (this.filterType       && t.type          !== this.filterType)       return false;
      return true;
    });
    this.buildKanban();
  }

  buildKanban() {
    this.kanbanCols = this.columns.map(col => ({
      ...col,
      tasks: this.filteredTasks.filter(t => t.statut === col.statut),
    }));
    this.colIds = this.columns.map(c => c.statut);
  }

  onDrop(event: CdkDragDrop<Task[]>, targetStatut: TaskStatut) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const task = event.previousContainer.data[event.previousIndex];
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      this.changeStatut(task, targetStatut);
    }
  }

  toggleMesTaches() { this.mesTachesOnly = !this.mesTachesOnly; this.applyFilter(); }

  resetFilters() {
    this.mesTachesOnly = false;
    this.filterClientId = this.filterAssigneeId = this.filterType = null;
    this.applyFilter();
  }

  getClientName(id: number): string {
    return this.clients.find(c => c.id === id)?.nom ?? 'Dossier';
  }

  getUserName(id: number): string {
    const u = this.users.find(u => u.id === id);
    return u ? `${u.firstName} ${u.lastName}` : 'Assigné';
  }

  changeStatut(t: Task, statut: TaskStatut) {
    const prev = t.statut; t.statut = statut;
    this.tasksService.update(t.clientId, t.id, { statut }).subscribe({ next: () => this.applyFilter(), error: () => { t.statut = prev; } });
  }

  remove(t: Task) {
    this.confirm.confirm('Supprimer cette tâche ?').subscribe(ok => {
      if (!ok) return;
      this.tasksService.delete(t.clientId, t.id).subscribe(() => { this.load(); this.toast.success('Tâche supprimée'); });
    });
  }

  isOverdue(t: Task): boolean {
    if (!t.dateEcheance || t.statut === 'TERMINEE') return false;
    return new Date(t.dateEcheance) < new Date();
  }

  formatTime(minutes: number): string {
    if (!minutes || minutes <= 0) return '—';
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const h = Math.floor(minutes / 60); const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }
}
