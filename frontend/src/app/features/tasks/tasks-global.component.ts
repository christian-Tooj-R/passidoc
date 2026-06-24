import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
import { TasksService, Task, TaskStatut, TaskDashboard, TaskComment } from '../../core/services/tasks.service';
import { ClientsService } from '../../core/services/clients.service';
import { UsersService } from '../../core/services/users.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { Client } from '../../core/models/client.model';
import { User } from '../../core/models/user.model';
import { LocalDatePipe } from '../../core/pipes/local-date.pipe';
import { OnlyNumbersDirective } from '../../shared/directives/only-numbers.directive';

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

        <!-- Commentaire -->
        <div class="ct-section-label">Commentaire</div>
        <textarea class="ct-comment-input" [(ngModel)]="commentaire" rows="3" placeholder="Détails, contexte, instructions…"></textarea>

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

    .ct-comment-input {
      width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0;
      border-radius: 10px; font-size: 13px; color: #1e293b;
      font-family: inherit; resize: vertical; transition: border-color .15s;
      box-sizing: border-box;
    }
    .ct-comment-input:focus { outline: none; border-color: #6366f1; }
    .ct-comment-input::placeholder { color: #94a3b8; }

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
  commentaire = '';
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
      description:  this.commentaire || undefined,
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
    MatSelectModule, MatTooltipModule, MatDialogModule, LocalDatePipe, OnlyNumbersDirective],
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
            @if (task.createdBy) {
              <div class="td-user-badge td-user-badge--subtle">
                <div class="td-av td-av--sm">{{ initials(task.createdBy) }}</div>
                <span>{{ task.createdBy.firstName }} {{ task.createdBy.lastName }}</span>
              </div>
            } @else { <span class="none">—</span> }
          </div>
          <div class="td-prop-row">
            <span class="td-prop-lbl">Temps total</span>
            <span class="td-prop-val">
              @if (currentStatut === 'EN_COURS') {
                <span class="time-badge time-badge--live">▶ {{ liveTimerDisplay }}</span>
              } @else if (totalSecondes > 0) {
                <span class="time-badge">{{ formatSeconds(totalSecondes) }}</span>
              } @else {
                <span class="none">—</span>
              }
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
              @if (task.assignee) {
                <div class="td-user-badge">
                  <div class="td-av td-av--sm">{{ initials(task.assignee) }}</div>
                  <span>{{ task.assignee.firstName }} {{ task.assignee.lastName }}</span>
                </div>
              } @else { <span class="none">—</span> }
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

        <!-- Commentaires — s'étend sur toute la largeur de la grille -->
        <div class="td-comments">
          <div class="tdc-header">
            <mat-icon>chat_bubble_outline</mat-icon>
            <span>Commentaires</span>
            @if (comments.length > 0) { <span class="tdc-count">{{ comments.length }}</span> }
          </div>

          @if (loadingComments) { <div class="tdc-empty">Chargement…</div> }

          @for (c of comments; track c.id) {
            <div class="tdc-item">
              <div class="tdc-av">{{ commentInitials(c.auteur) }}</div>
              <div class="tdc-content">
                <div class="tdc-meta">
                  <strong>{{ c.auteur.firstName }} {{ c.auteur.lastName }}</strong>
                  <span class="tdc-date">{{ c.createdAt | localDate:'dd/MM HH:mm' }}</span>
                </div>
                <div class="tdc-text" [innerHTML]="renderComment(c.contenu)"></div>
              </div>
              @if (c.auteurId === data.currentUserId || data.currentUserIsAdmin) {
                <button class="tdc-del" (click)="deleteComment(c.id)" matTooltip="Supprimer">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>
          }

          @if (!loadingComments && comments.length === 0) {
            <div class="tdc-empty">Aucun commentaire pour l'instant</div>
          }

          <!-- Zone de saisie -->
          <div class="tdc-add">
            <div class="tdc-av">{{ initials(currentUserObj) }}</div>
            <div class="tdc-input-wrap">
              @if (mentionDropdownVisible && mentionMatches.length > 0) {
                <div class="tdc-mention-dd">
                  <div class="tdc-mention-header">
                    <mat-icon>alternate_email</mat-icon> Mentionner
                  </div>
                  @for (u of mentionMatches; track u.id; let i = $index) {
                    <div class="tdc-mention-opt" [class.tdc-mention-opt--active]="mentionActiveIndex === i"
                         (mousedown)="selectMention(u)" (mouseenter)="mentionActiveIndex = i">
                      <div class="tdc-mention-av" [style.background]="mentionAvatarColor(u)">
                        {{ commentInitials(u) }}
                      </div>
                      <div class="tdc-mention-info">
                        <span class="tdc-mention-name">{{ u.firstName }} {{ u.lastName }}</span>
                        <span class="tdc-mention-role">{{ roleLabel(u) }}</span>
                      </div>
                      <span class="tdc-mention-site">{{ u.site === 'REUNION' ? '🇷🇪' : '🇲🇬' }}</span>
                    </div>
                  }
                </div>
              }
              <textarea class="tdc-textarea"
                        [(ngModel)]="newCommentText"
                        (input)="onCommentInput($event)"
                        (keydown)="onCommentKeydown($event)"
                        placeholder="Commentaire… (@mention pour notifier)"
                        rows="2"></textarea>
              <div class="tdc-input-actions">
                <button class="tdc-send" (click)="sendComment()" [disabled]="!newCommentText.trim() || sendingComment">
                  <mat-icon>send</mat-icon>
                </button>
              </div>
            </div>
          </div>
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
    .td-av--sm { width: 22px; height: 22px; font-size: 8.5px; }

    /* User badge pill */
    .td-user-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px 3px 4px;
      background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 20px;
      font-size: 12.5px; font-weight: 600; color: #4338ca;
    }
    .td-user-badge--subtle {
      background: #f8fafc; border-color: #e2e8f0; color: #475569;
    }
    .td-user-badge--subtle .td-av { background: linear-gradient(135deg, #94a3b8, #64748b); }

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

    /* Live timer */
    .time-badge--live { background: #fef3c7; color: #b45309; animation: td-pulse 2s ease-in-out infinite; }
    @keyframes td-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .65; } }

    /* ── Comments section ─────────────────────────────────────────────── */
    .td-comments {
      grid-column: 1 / -1;
      border-top: 1px solid #f1f5f9;
      padding: 14px 20px 16px;
      display: flex; flex-direction: column; gap: 0;
    }
    .tdc-header {
      display: flex; align-items: center; gap: 6px;
      margin-bottom: 10px;
      font-size: 11px; font-weight: 700; color: #64748b;
      text-transform: uppercase; letter-spacing: .5px;
    }
    .tdc-header mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .tdc-count {
      background: #6366f1; color: white;
      font-size: 10px; padding: 1px 6px; border-radius: 10px;
    }
    .tdc-empty { text-align: center; font-size: 13px; color: #94a3b8; padding: 8px 0 12px; }

    /* Comment items */
    .tdc-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 8px 0; border-bottom: 1px solid #f8fafc;
      position: relative;
    }
    .tdc-item:last-of-type { border-bottom: none; }
    .tdc-av {
      width: 28px; height: 28px; border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .tdc-content { flex: 1; min-width: 0; }
    .tdc-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
    .tdc-meta strong { font-size: 12px; color: #1e293b; font-weight: 700; }
    .tdc-date { font-size: 11px; color: #94a3b8; }
    .tdc-text { font-size: 13px; color: #334155; line-height: 1.45; word-break: break-word; }
    .tdc-del {
      background: none; border: none; cursor: pointer;
      color: #94a3b8; padding: 2px; border-radius: 4px;
      display: flex; align-items: center; opacity: 0;
      transition: opacity .15s, color .15s; flex-shrink: 0;
    }
    .tdc-item:hover .tdc-del { opacity: 1; }
    .tdc-del:hover { color: #ef4444; }
    .tdc-del mat-icon { font-size: 13px; width: 13px; height: 13px; }

    /* Add comment row */
    .tdc-add {
      display: flex; align-items: flex-start; gap: 10px;
      padding-top: 12px; margin-top: 6px;
      border-top: 1px solid #f1f5f9;
    }
    .tdc-input-wrap { flex: 1; position: relative; }
    .tdc-mention-dd {
      position: absolute; bottom: calc(100% + 6px); left: 0; right: 0;
      background: white; border: 1px solid #e2e8f0; border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,.13), 0 2px 6px rgba(0,0,0,.07);
      z-index: 10; overflow: hidden;
    }
    .tdc-mention-header {
      display: flex; align-items: center; gap: 5px;
      padding: 7px 12px 6px;
      font-size: 10px; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: .5px;
      border-bottom: 1px solid #f1f5f9;
    }
    .tdc-mention-header mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .tdc-mention-opt {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; cursor: pointer;
      transition: background .1s; border-left: 3px solid transparent;
    }
    .tdc-mention-opt--active,
    .tdc-mention-opt:hover {
      background: #f5f3ff; border-left-color: #6366f1;
    }
    .tdc-mention-av {
      width: 30px; height: 30px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .tdc-mention-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .tdc-mention-name { font-size: 13px; font-weight: 600; color: #1e293b; }
    .tdc-mention-role { font-size: 11px; color: #94a3b8; margin-top: 1px; }
    .tdc-mention-site { font-size: 14px; flex-shrink: 0; }
    .tdc-textarea {
      width: 100%; padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px;
      font-size: 13px; font-family: inherit; color: #1e293b; resize: none;
      transition: border-color .15s; box-sizing: border-box;
    }
    .tdc-textarea:focus { outline: none; border-color: #6366f1; }
    .tdc-textarea::placeholder { color: #94a3b8; }
    .tdc-input-actions { display: flex; justify-content: flex-end; margin-top: 5px; }
    .tdc-send {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white; cursor: pointer; transition: opacity .15s;
    }
    .tdc-send:disabled { opacity: .35; cursor: not-allowed; }
    .tdc-send mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `],
})
export class TaskDetailDialogComponent implements OnInit, OnDestroy {
  private tasksService = inject(TasksService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  dialogRef = inject(MatDialogRef<TaskDetailDialogComponent>);
  data: { task: Task; users: User[]; currentUserId: number; currentUserIsAdmin: boolean } = inject(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);

  task = this.data.task;
  currentStatut: TaskStatut = this.data.task.statut;
  currentPrio: string = this.data.task.priorite ?? 'NORMALE';
  private _initialStatut = this.data.task.statut;
  private _initialPrio = this.data.task.priorite ?? 'NORMALE';

  // ── Chrono ──────────────────────────────────────────────────────────────────
  totalSecondes = this.data.task.tempsTotalSecondes ?? 0;
  liveTimerDisplay = '';
  private timerInterval?: ReturnType<typeof setInterval>;

  // ── Commentaires ────────────────────────────────────────────────────────────
  comments: TaskComment[] = [];
  loadingComments = false;
  sendingComment = false;
  newCommentText = '';

  // ── Mentions ─────────────────────────────────────────────────────────────────
  mentionDropdownVisible = false;
  mentionMatches: User[] = [];
  mentionActiveIndex = 0;
  private mentionStartIndex = -1;
  private mentionSearch = '';
  private mentionedUsers: User[] = []; // utilisateurs mentionnés dans le commentaire en cours

  private readonly AVATAR_COLORS = [
    'linear-gradient(135deg,#6366f1,#4f46e5)',
    'linear-gradient(135deg,#0ea5e9,#0284c7)',
    'linear-gradient(135deg,#10b981,#059669)',
    'linear-gradient(135deg,#f59e0b,#d97706)',
    'linear-gradient(135deg,#ec4899,#db2777)',
    'linear-gradient(135deg,#8b5cf6,#7c3aed)',
  ];

  mentionAvatarColor(u: User): string {
    return this.AVATAR_COLORS[u.id % this.AVATAR_COLORS.length];
  }

  roleLabel(u: User): string {
    const map: Record<string, string> = {
      ADMIN: 'Administrateur',
      EXPERT_COMPTABLE: 'Expert-comptable',
      COLLABORATEUR: 'Collaborateur',
    };
    return map[u.role] ?? u.role;
  }

  get currentUserObj(): User | undefined {
    return this.data.users.find(u => u.id === this.data.currentUserId);
  }

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

  ngOnInit() {
    this.loadComments();
    if (this.task.statut === 'EN_COURS') {
      this.refreshTimer();
      this.timerInterval = setInterval(() => this.refreshTimer(), 1000);
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private refreshTimer() {
    const debut = this.task.debutEnCours;
    const acc = this.task.tempsTotalSecondes ?? 0;
    const elapsed = debut ? Math.floor((Date.now() - new Date(debut).getTime()) / 1000) : 0;
    this.liveTimerDisplay = this.formatSeconds(acc + elapsed);
    this.cdr.markForCheck();
  }

  onStatutChange(statut: TaskStatut) {
    this.currentStatut = statut;
    if (statut === 'EN_COURS' && !this.timerInterval) {
      this.refreshTimer();
      this.timerInterval = setInterval(() => this.refreshTimer(), 1000);
    } else if (statut !== 'EN_COURS' && this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
      this.liveTimerDisplay = '';
    }
  }

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

  formatSeconds(seconds: number): string {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return m > 0 ? `${h}h${m}min` : `${h}h`;
    if (m > 0) return s > 0 ? `${m}min ${s}s` : `${m}min`;
    return `${s}s`;
  }

  // ── Commentaires ────────────────────────────────────────────────────────────

  loadComments() {
    this.loadingComments = true;
    this.tasksService.getComments(this.task.clientId, this.task.id).subscribe({
      next: (c) => { this.comments = c; this.loadingComments = false; },
      error: () => { this.loadingComments = false; },
    });
  }

  commentInitials(auteur: { firstName: string; lastName: string }): string {
    return (auteur.firstName?.[0] || '') + (auteur.lastName?.[0] || '');
  }

  renderComment(contenu: string): SafeHtml {
    const escaped = contenu
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    const html = escaped.replace(/@\[([^\]]+)\]\(\d+\)/g,
      '<span style="display:inline-flex;align-items:center;gap:2px;color:#4f46e5;font-weight:600;font-size:12px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:20px;padding:1px 8px 1px 6px;white-space:nowrap">@$1</span>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  onCommentInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    const text = textarea.value;
    const pos = textarea.selectionStart ?? text.length;
    const before = text.substring(0, pos);
    const lastAt = before.lastIndexOf('@');

    if (lastAt !== -1) {
      const search = before.substring(lastAt + 1);
      if (!search.includes(' ')) {
        this.mentionStartIndex = lastAt;
        this.mentionSearch = search.toLowerCase();
        this.mentionMatches = this.data.users.filter(u =>
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(this.mentionSearch)
        ).slice(0, 5);
        this.mentionActiveIndex = 0;
        this.mentionDropdownVisible = this.mentionMatches.length > 0;
        return;
      }
    }
    this.mentionDropdownVisible = false;
    this.mentionMatches = [];
  }

  onCommentKeydown(event: Event) {
    const ke = event as KeyboardEvent;

    if (this.mentionDropdownVisible) {
      if (ke.key === 'ArrowDown') {
        ke.preventDefault();
        this.mentionActiveIndex = (this.mentionActiveIndex + 1) % this.mentionMatches.length;
      } else if (ke.key === 'ArrowUp') {
        ke.preventDefault();
        this.mentionActiveIndex = (this.mentionActiveIndex - 1 + this.mentionMatches.length) % this.mentionMatches.length;
      } else if (ke.key === 'Enter' || ke.key === 'Tab') {
        ke.preventDefault();
        const selected = this.mentionMatches[this.mentionActiveIndex];
        if (selected) this.selectMention(selected);
      } else if (ke.key === 'Escape') {
        ke.preventDefault();
        this.mentionDropdownVisible = false;
      }
      return; // bloquer tout le reste tant que le dropdown est ouvert
    }

    if (ke.key === 'Enter' && !ke.shiftKey) {
      ke.preventDefault();
      this.sendComment();
    }
  }

  selectMention(user: User) {
    const before = this.newCommentText.substring(0, this.mentionStartIndex);
    const after = this.newCommentText.substring(this.mentionStartIndex + 1 + this.mentionSearch.length);
    this.newCommentText = `${before}@${user.firstName} ${user.lastName} ${after.trimStart()}`;
    if (!this.mentionedUsers.find(u => u.id === user.id)) {
      this.mentionedUsers.push(user);
    }
    this.mentionDropdownVisible = false;
    this.mentionMatches = [];
  }

  sendComment() {
    const raw = this.newCommentText.trim();
    if (!raw || this.sendingComment) return;

    // Reconstituer @[Nom](id) et collecter les IDs mentionnés
    let contenu = raw;
    const mentions: number[] = [];
    for (const u of this.mentionedUsers) {
      const tag = `@${u.firstName} ${u.lastName}`;
      if (contenu.includes(tag)) {
        contenu = contenu.split(tag).join(`@[${u.firstName} ${u.lastName}](${u.id})`);
        mentions.push(u.id);
      }
    }

    this.sendingComment = true;
    this.tasksService.addComment(this.task.clientId, this.task.id, { contenu, mentions }).subscribe({
      next: (c) => {
        if (c) this.comments.push(c);
        this.newCommentText = '';
        this.mentionedUsers = [];
        this.sendingComment = false;
      },
      error: () => {
        this.toast.error('Erreur lors de l\'envoi');
        this.sendingComment = false;
      },
    });
  }

  deleteComment(commentId: number) {
    this.tasksService.deleteComment(this.task.clientId, this.task.id, commentId).subscribe(() => {
      this.comments = this.comments.filter(c => c.id !== commentId);
    });
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

        <!-- Recherche texte -->
        <input class="tb-search-input" type="text" placeholder="Rechercher une tâche…"
               [(ngModel)]="searchText" (ngModelChange)="onSearchChange()" />

        <!-- Toggle vue -->
        <div class="view-toggle">
          <button class="vt-btn" [class.vt-btn--active]="viewMode === 'kanban'"
                  (click)="viewMode = 'kanban'" matTooltip="Kanban">
            <mat-icon>view_kanban</mat-icon>
          </button>
          <button class="vt-btn" [class.vt-btn--active]="viewMode === 'list'"
                  (click)="viewMode = 'list'" matTooltip="Tableau">
            <mat-icon>table_rows</mat-icon>
          </button>
        </div>

        <!-- Compteur -->
        <div class="filter-bar__count">
          <span class="filter-bar__num">{{ filteredTasks.length }}</span>
          <span>tâche{{ filteredTasks.length !== 1 ? 's' : '' }}</span>
        </div>

      </div>

      <!-- ── Kanban Board ── -->
      @if (viewMode === 'kanban') {
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
      } <!-- fin @if kanban -->

      <!-- ══ TABLE VIEW ══ -->
      @if (viewMode === 'list') {
        <div class="tasks-list-wrap">

          <!-- Compteur résultats -->
          <div class="tl-meta">
            <span class="tl-count">{{ tableFilteredTasks.length }} tâche{{ tableFilteredTasks.length !== 1 ? 's' : '' }}</span>
            @if (searchText) {
              <span class="tl-search-tag">« {{ searchText }} »<button (click)="searchText=''; onSearchChange()"><mat-icon>close</mat-icon></button></span>
            }
          </div>

          <!-- Table -->
          <div class="tl-table-scroll">
            <table class="tl-table">
              <thead>
                <tr>
                  <th class="th-id">
                    <button class="th-btn" (click)="sortTable('taskId')">
                      #
                      @if (tableSort.col === 'taskId') { <mat-icon>{{ tableSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon> }
                    </button>
                  </th>
                  <th class="th-title">
                    <button class="th-btn" (click)="sortTable('titre')">
                      Titre
                      @if (tableSort.col === 'titre') { <mat-icon>{{ tableSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon> }
                    </button>
                  </th>
                  <th class="th-statut">
                    <button class="th-btn" (click)="sortTable('statut')">
                      Statut
                      @if (tableSort.col === 'statut') { <mat-icon>{{ tableSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon> }
                    </button>
                  </th>
                  <th class="th-prio">
                    <button class="th-btn" (click)="sortTable('priorite')">
                      Priorité
                      @if (tableSort.col === 'priorite') { <mat-icon>{{ tableSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon> }
                    </button>
                  </th>
                  <th class="th-type">Type</th>
                  <th class="th-client">
                    <button class="th-btn" (click)="sortTable('client')">
                      Dossier
                      @if (tableSort.col === 'client') { <mat-icon>{{ tableSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon> }
                    </button>
                  </th>
                  <th class="th-assignee">
                    <button class="th-btn" (click)="sortTable('assignee')">
                      Assigné
                      @if (tableSort.col === 'assignee') { <mat-icon>{{ tableSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon> }
                    </button>
                  </th>
                  <th class="th-date">
                    <button class="th-btn" (click)="sortTable('dateEcheance')">
                      Échéance
                      @if (tableSort.col === 'dateEcheance') { <mat-icon>{{ tableSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon> }
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (t of tablePagedTasks; track t.id) {
                  <tr class="tl-row"
                      [class.tl-row--done]="t.statut === 'TERMINEE' || t.statut === 'NON_FAIT'"
                      [class.tl-row--overdue]="isOverdue(t)"
                      (click)="openDetail(t)">
                    <td class="td-id">
                      <span class="tl-id">{{ t.taskId ?? '—' }}</span>
                    </td>
                    <td class="td-title">
                      <span class="tl-titre">{{ t.titre }}</span>
                    </td>
                    <td class="td-statut">
                      <span class="tl-badge tl-badge--{{ t.statut.toLowerCase() }}">{{ statutLabel(t.statut) }}</span>
                    </td>
                    <td class="td-prio">
                      <span class="tl-prio tl-prio--{{ (t.priorite ?? 'normale').toLowerCase() }}">
                        {{ prioriteLabel(t.priorite ?? 'NORMALE') }}
                      </span>
                    </td>
                    <td class="td-type">
                      @if (t.type) {
                        <span class="tl-type type-{{ t.type.toLowerCase() }}">{{ t.type }}</span>
                      } @else { <span class="tl-empty">—</span> }
                    </td>
                    <td class="td-client">
                      @if (t.client) {
                        <a class="tl-client" [routerLink]="['/clients', t.client.id]" (click)="$event.stopPropagation()">
                          <mat-icon>folder_shared</mat-icon>{{ t.client.nom }}
                        </a>
                      } @else { <span class="tl-empty">—</span> }
                    </td>
                    <td class="td-assignee">
                      @if (t.assignee) {
                        <div class="tl-assignee">
                          <div class="tl-av">{{ t.assignee.firstName[0] }}{{ t.assignee.lastName[0] }}</div>
                          <span>{{ t.assignee.firstName }} {{ t.assignee.lastName }}</span>
                        </div>
                      } @else { <span class="tl-empty">—</span> }
                    </td>
                    <td class="td-date">
                      @if (t.dateEcheance) {
                        <span class="tl-date" [class.tl-date--overdue]="isOverdue(t)">
                          <mat-icon>event</mat-icon>{{ t.dateEcheance | localDate:'dd MMM yy' }}
                        </span>
                      } @else { <span class="tl-empty">—</span> }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="8" class="tl-empty-row">
                    <mat-icon>task_alt</mat-icon>
                    <span>Aucune tâche{{ searchText ? ' pour cette recherche' : '' }}</span>
                  </td></tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          @if (tableTotalPages > 1) {
            <div class="tl-pagination">
              <span class="pag-info">
                {{ (tablePage - 1) * tablePageSize + 1 }}–{{ Math.min(tablePage * tablePageSize, tableFilteredTasks.length) }}
                sur {{ tableFilteredTasks.length }}
              </span>
              <div class="pag-btns">
                <button class="pag-btn" [disabled]="tablePage <= 1" (click)="tablePage = tablePage - 1">
                  <mat-icon>chevron_left</mat-icon>
                </button>
                @for (p of tablePages; track p) {
                  <button class="pag-btn" [class.pag-btn--active]="p === tablePage"
                          (click)="tablePage = p">{{ p }}</button>
                }
                <button class="pag-btn" [disabled]="tablePage >= tableTotalPages" (click)="tablePage = tablePage + 1">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </div>
            </div>
          }

        </div>
      }

    </div>
  `,
  styles: [`
    /* Layout viewport-height : le kanban / la liste occupe tout l'espace dispo */
    .page { padding: 0; flex: 1; display: flex; flex-direction: column; overflow: hidden; }

    /* Header */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 24px 32px 0; flex-shrink: 0;
    }
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
      gap: 12px; flex-shrink: 0;
      margin: 14px 32px 0;
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
      flex: 1; min-height: 0;
      display: flex; gap: 14px;
      overflow-x: auto; overflow-y: hidden;
      padding: 14px 32px 16px;
      align-items: stretch;
    }
    .kanban-board::-webkit-scrollbar { height: 6px; }
    .kanban-board::-webkit-scrollbar-track { background: transparent; }
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
      flex: 1; min-height: 0;
      padding: 8px; display: flex; flex-direction: column; gap: 8px;
      overflow-y: auto;
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

    /* ── Recherche + Toggle view ─────────────────────────── */
    .tb-search-input {
      flex: 1; max-width: 260px; min-width: 140px;
      height: 32px; border: 1.5px solid #e5e7eb; border-radius: 8px;
      padding: 0 12px; font-size: 13px; font-family: inherit;
      color: #1e293b; background: #f9fafb; outline: none;
      transition: border-color .15s, box-shadow .15s;
    }
    .tb-search-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.10); background: white; }
    .tb-search-input::placeholder { color: #9ca3af; }

    .view-toggle { display: flex; gap: 3px; flex-shrink: 0; }
    .vt-btn {
      width: 32px; height: 32px; border: 1.5px solid #e5e7eb; border-radius: 8px;
      background: #f9fafb; cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: #6b7280; transition: all .13s;
    }
    .vt-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .vt-btn:hover { border-color: #c7d2fe; color: #4f46e5; background: #eef2ff; }
    .vt-btn--active { border-color: #6366f1; background: #eef2ff; color: #4338ca; }

    /* ── Wrapper vue liste ───────────────────────────────── */
    .tasks-list-wrap {
      flex: 1; min-height: 0;
      display: flex; flex-direction: column;
      padding: 14px 32px 16px;
      overflow: hidden;
    }

    .tl-meta {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 10px; flex-shrink: 0;
    }
    .tl-count { font-size: 13px; font-weight: 600; color: #64748b; }
    .tl-search-tag {
      display: inline-flex; align-items: center; gap: 4px;
      background: #eef2ff; color: #4338ca; border-radius: 20px;
      font-size: 12px; font-weight: 600; padding: 2px 8px 2px 12px;
    }
    .tl-search-tag button { border: none; background: none; cursor: pointer; padding: 0; display: flex; color: #6366f1; }
    .tl-search-tag button mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* ── Scroll container ────────────────────────────────── */
    .tl-table-scroll {
      flex: 1; min-height: 0;
      overflow-y: auto; overflow-x: auto;
      border: 1px solid #e5e7eb; border-radius: 12px;
      background: white;
    }
    .tl-table-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
    .tl-table-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

    /* ── Tableau ─────────────────────────────────────────── */
    .tl-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .tl-table thead { position: sticky; top: 0; z-index: 2; }
    .tl-table thead tr { background: #162351; }

    .th-btn {
      display: flex; align-items: center; gap: 4px;
      background: none; border: none; cursor: pointer;
      font-size: 12px; font-weight: 600; color: #fff;
      text-transform: none; letter-spacing: 0;
      padding: 0; white-space: nowrap;
    }
    .th-btn mat-icon { font-size: 13px; width: 13px; height: 13px; color: rgba(255,255,255,.7); }
    .th-btn:hover { color: rgba(255,255,255,.85); }

    .tl-table th { padding: 10px 14px; text-align: left; color: #fff; }
    .tl-table td { padding: 11px 14px; vertical-align: middle; border-bottom: 1px solid #f1f5f9; }

    /* Colonnes */
    .th-id, .td-id { width: 70px; }
    .th-statut, .td-statut { width: 120px; }
    .th-prio, .td-prio { width: 90px; }
    .th-type, .td-type { width: 90px; }
    .th-client, .td-client { width: 180px; }
    .th-assignee, .td-assignee { width: 150px; }
    .th-date, .td-date { width: 110px; }

    /* Lignes */
    .tl-row { cursor: pointer; transition: background .1s; }
    .tl-row:hover td { background: #f8faff; }
    .tl-row--done td { opacity: .6; }
    .tl-row--overdue .tl-date { color: #dc2626 !important; }

    /* Cellules */
    .tl-id { font-family: monospace; font-size: 11px; background: #f1f5f9; color: #64748b; padding: 2px 6px; border-radius: 4px; }
    .tl-titre { font-weight: 600; color: #1e293b; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .tl-empty { color: #cbd5e1; }

    /* Badges statut */
    .tl-badge {
      display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px;
      font-size: 11.5px; font-weight: 600; white-space: nowrap;
    }
    .tl-badge--a_faire   { background: #eff6ff; color: #1d4ed8; }
    .tl-badge--en_cours  { background: #fffbeb; color: #d97706; }
    .tl-badge--terminee  { background: #f0fdf4; color: #15803d; }
    .tl-badge--non_fait  { background: #fff1f2; color: #e11d48; }
    .tl-badge--en_attente { background: #f5f3ff; color: #7c3aed; }

    /* Priorité */
    .tl-prio {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; font-weight: 600;
    }
    .tl-prio::before { content: ''; width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
    .tl-prio--haute   { color: #dc2626; }
    .tl-prio--haute::before { background: #dc2626; }
    .tl-prio--normale { color: #64748b; }
    .tl-prio--normale::before { background: #94a3b8; }
    .tl-prio--basse   { color: #16a34a; }
    .tl-prio--basse::before { background: #16a34a; }

    /* Client lien */
    .tl-client {
      display: inline-flex; align-items: center; gap: 5px;
      color: #4f46e5; font-weight: 500; text-decoration: none; font-size: 13px;
    }
    .tl-client mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .tl-client:hover { text-decoration: underline; }

    /* Assigné */
    .tl-assignee { display: flex; align-items: center; gap: 7px; }
    .tl-av {
      width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }

    /* Date */
    .tl-date {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12.5px; color: #64748b;
    }
    .tl-date mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .tl-date--overdue { color: #dc2626 !important; }

    /* Empty row */
    .tl-empty-row {
      text-align: center; padding: 48px !important; color: #94a3b8;
    }

    /* Pagination */
    .tl-pagination {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 4px 0; flex-shrink: 0;
    }
    .pag-info { font-size: 12px; color: #64748b; }
    .pag-btns { display: flex; gap: 4px; }
    .pag-btn {
      min-width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e5e7eb;
      background: white; cursor: pointer; font-size: 13px; font-weight: 500; color: #374151;
      display: flex; align-items: center; justify-content: center;
      transition: all .12s;
    }
    .pag-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .pag-btn:hover:not(:disabled) { border-color: #c7d2fe; color: #4f46e5; background: #eef2ff; }
    .pag-btn:disabled { opacity: .4; cursor: not-allowed; }
    .pag-btn--active { border-color: #6366f1; background: #6366f1; color: white; }

    /* tl-type réutilise les classes type-* existantes */
    .tl-type { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 5px; white-space: nowrap; }
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

  // ── Vue tableau ──────────────────────────────────────
  viewMode: 'kanban' | 'list' = 'kanban';
  searchText = '';
  tableSort: { col: string; dir: 'asc' | 'desc' } = { col: 'dateEcheance', dir: 'asc' };
  tablePage = 1;
  readonly tablePageSize = 30;
  readonly Math = Math;

  get tableFilteredTasks(): Task[] {
    let list = [...this.filteredTasks];
    if (this.searchText.trim()) {
      const q = this.searchText.trim().toLowerCase();
      list = list.filter(t =>
        t.titre.toLowerCase().includes(q) ||
        (t.taskId ?? '').toLowerCase().includes(q) ||
        (t.client?.nom ?? '').toLowerCase().includes(q) ||
        (t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}`.toLowerCase() : '').includes(q)
      );
    }
    const dir = this.tableSort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (this.tableSort.col) {
        case 'titre':    return dir * a.titre.localeCompare(b.titre);
        case 'statut':   return dir * a.statut.localeCompare(b.statut);
        case 'priorite': return dir * (a.priorite ?? 'NORMALE').localeCompare(b.priorite ?? 'NORMALE');
        case 'client':   return dir * (a.client?.nom ?? '').localeCompare(b.client?.nom ?? '');
        case 'assignee': return dir * (a.assignee?.firstName ?? '').localeCompare(b.assignee?.firstName ?? '');
        case 'dateEcheance': {
          const da = a.dateEcheance ? new Date(a.dateEcheance).getTime() : Infinity;
          const db = b.dateEcheance ? new Date(b.dateEcheance).getTime() : Infinity;
          return dir * (da - db);
        }
        default: return 0;
      }
    });
    return list;
  }

  get tableTotalPages(): number { return Math.max(1, Math.ceil(this.tableFilteredTasks.length / this.tablePageSize)); }
  get tablePagedTasks(): Task[] {
    const start = (this.tablePage - 1) * this.tablePageSize;
    return this.tableFilteredTasks.slice(start, start + this.tablePageSize);
  }
  get tablePages(): number[] {
    const total = this.tableTotalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const p = this.tablePage;
    const pages = new Set([1, total, p, p - 1, p + 1].filter(x => x >= 1 && x <= total));
    return [...pages].sort((a, b) => a - b);
  }

  sortTable(col: string) {
    this.tableSort = this.tableSort.col === col
      ? { col, dir: this.tableSort.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' };
    this.tablePage = 1;
  }

  statutLabel(s: string): string {
    const m: Record<string, string> = {
      A_FAIRE: 'À faire', EN_COURS: 'En cours', TERMINEE: 'Terminée',
      NON_FAIT: 'Non fait', EN_ATTENTE: 'En attente',
    };
    return m[s] ?? s;
  }

  prioriteLabel(p: string): string {
    const m: Record<string, string> = { HAUTE: 'Haute', NORMALE: 'Normale', BASSE: 'Basse' };
    return m[p] ?? p;
  }

  onSearchChange() { this.tablePage = 1; }

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
    this.tablePage = 1;
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
