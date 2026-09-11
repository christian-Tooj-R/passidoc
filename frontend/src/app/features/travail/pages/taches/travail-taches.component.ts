import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { TasksService, Task } from '../../../../core/services/tasks.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { UsersService } from '../../../../core/services/users.service';
import { Client } from '../../../../core/models/client.model';
import { User } from '../../../../core/models/user.model';
import { LocalDatePipe } from '../../../../core/pipes/local-date.pipe';
import { TimerService } from '../../../../core/services/saisie-temps.service';

@Component({
  selector: 'app-travail-taches',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatDialogModule, LocalDatePipe],
  template: `
<div class="page">

  <!-- ── Header ── -->
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--indigo"><mat-icon>task_alt</mat-icon></div>
      <div>
        <h1 class="pg-title">Toutes les tâches</h1>
        <p class="pg-sub">{{ filteredTasks().length }} tâche(s) · {{ countByStatut('EN_COURS') }} en cours</p>
      </div>
    </div>
    <button class="btn-new-task" (click)="openCreateDialog()">
      <mat-icon>add</mat-icon> Nouvelle tâche
    </button>
  </div>

  <!-- ── KPI cards ── -->
  <div class="kpi-row">
    <div class="kpi-card kpi-blue">
      <div class="kpi-num">{{ countByStatut('A_FAIRE') }}</div>
      <div class="kpi-lbl">À faire</div>
    </div>
    <div class="kpi-card kpi-orange">
      <div class="kpi-num">{{ countByStatut('EN_COURS') }}</div>
      <div class="kpi-lbl">En cours</div>
    </div>
    <div class="kpi-card kpi-green">
      <div class="kpi-num">{{ countByStatut('TERMINEE') }}</div>
      <div class="kpi-lbl">Terminées</div>
    </div>
    <div class="kpi-card kpi-red">
      <div class="kpi-num">{{ countByStatut('NON_FAIT') }}</div>
      <div class="kpi-lbl">Non faites</div>
    </div>
    <div class="kpi-card kpi-purple">
      <div class="kpi-num">{{ totalHeures() }}h</div>
      <div class="kpi-lbl">Temps total</div>
    </div>
  </div>

  <!-- ── Barre de filtres ── -->
  <div class="filter-bar">
    <select class="fb-select" [(ngModel)]="filterStatut" (change)="applyFilters()">
      <option value="">Statut — Tous</option>
      <option value="A_FAIRE">À faire</option>
      <option value="EN_COURS">En cours</option>
      <option value="EN_PAUSE">En pause</option>
      <option value="TERMINEE">Terminée</option>
      <option value="NON_FAIT">Non fait</option>
      <option value="EN_ATTENTE">En attente</option>
    </select>
    <select class="fb-select" [(ngModel)]="filterPriorite" (change)="applyFilters()">
      <option value="">Priorité — Toutes</option>
      <option value="HAUTE">Haute</option>
      <option value="NORMALE">Normale</option>
      <option value="BASSE">Basse</option>
    </select>
    <select class="fb-select" [(ngModel)]="filterType" (change)="applyFilters()">
      <option value="">Type — Tous</option>
      <option value="TVA">TVA</option>
      <option value="PAIE">Paie</option>
      <option value="ACHATS">Achats</option>
      <option value="VENTES">Ventes</option>
      <option value="RB">Relevé</option>
      <option value="GV">GV</option>
      <option value="DR">Dossier</option>
      <option value="AUTRE">Autre</option>
    </select>
    <select class="fb-select" [(ngModel)]="filterClient" (change)="applyFilters()">
      <option value="">Client — Tous</option>
      @for (c of clients; track c.id) {
        <option [value]="c.id">{{ c.nom }}</option>
      }
    </select>
    <select class="fb-select" [(ngModel)]="filterAssigne" (change)="applyFilters()">
      <option value="">Assigné — Tous</option>
      @for (u of users; track u.id) {
        <option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</option>
      }
    </select>
    <select class="fb-select" [(ngModel)]="filterFacturable" (change)="applyFilters()">
      <option value="">Facturable — Tous</option>
      <option value="true">Oui</option>
      <option value="false">Non</option>
    </select>
    <input class="fb-search" [(ngModel)]="filterSearch" (input)="applyFilters()" placeholder="🔍 Rechercher titre, client…" />
    <button class="fb-btn-apply" (click)="applyFilters()">Appliquer</button>
    @if (hasActiveFilters()) {
      <button class="fb-btn-clear" (click)="clearFilters()">Effacer</button>
    }
  </div>

  <!-- ── Toolbar tableau ── -->
  <div class="table-toolbar">
    <button class="tb-btn" (click)="reload()">
      <mat-icon style="font-size:14px;width:14px;height:14px;">refresh</mat-icon> Recharger
    </button>
    <button class="tb-btn" (click)="openCreateDialog()">
      <mat-icon style="font-size:14px;width:14px;height:14px;">add</mat-icon> Nouveau
    </button>
    <span class="tb-count">{{ filteredTasks().length }} résultat(s)</span>
  </div>

  <!-- ── Tableau ── -->
  <div class="table-wrap">
    @if (loading()) {
      <div class="empty-state">
        <mat-icon>hourglass_empty</mat-icon>
        <p>Chargement…</p>
      </div>
    } @else if (filteredTasks().length === 0) {
      <div class="empty-state">
        <mat-icon>task_alt</mat-icon>
        <p>Aucune tâche trouvée</p>
      </div>
    } @else {
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Titre</th>
            <th>Client</th>
            <th>Type</th>
            <th>Statut</th>
            <th>Priorité</th>
            <th>Assigné</th>
            <th>Échéance</th>
            <th>Facturable</th>
            <th class="th-actions"></th>
          </tr>
        </thead>
        <tbody>
          @for (task of filteredTasks(); track task.id) {
            <tr class="data-row" (click)="openDetail(task)">
              <td class="td-id">{{ task.taskId ?? '—' }}</td>
              <td class="td-titre"><span class="titre-text">{{ task.titre }}</span></td>
              <td class="td-client">{{ task.client?.nom ?? '—' }}</td>
              <td>
                @if (task.type) {
                  <span class="type-badge type-{{ task.type.toLowerCase() }}">{{ task.type }}</span>
                } @else {
                  <span class="td-none">—</span>
                }
              </td>
              <td>
                <span class="st-badge {{ statutClass(task.statut) }}">{{ statutLabel(task.statut) }}</span>
              </td>
              <td>
                <span class="{{ prioClass(task.priorite ?? 'NORMALE') }}">
                  {{ task.priorite ?? 'NORMALE' }}
                </span>
              </td>
              <td class="td-user">
                @if (task.assignee) {
                  <div class="user-chip">
                    <div class="user-av">{{ initials(task.assignee) }}</div>
                    <span>{{ task.assignee.firstName }}</span>
                  </div>
                } @else if (task.anyoneCanTake) {
                  <span class="badge-libre">Libre</span>
                } @else {
                  <span class="td-none">—</span>
                }
              </td>
              <td class="td-date">
                @if (task.dateEcheance) {
                  <span [class.overdue]="isOverdue(task)">{{ task.dateEcheance | localDate:'dd/MM/yyyy' }}</span>
                } @else {
                  <span class="td-none">—</span>
                }
              </td>
              <td>
                @if (task.estFacturable) {
                  <span class="td-fact-oui">✓ Oui</span>
                } @else {
                  <span class="td-fact-non">✗ Non</span>
                }
              </td>
              <td class="td-actions" (click)="$event.stopPropagation()">
                @if (timerSvc.isRunning() && timerSvc.activeTaskCtx()?.taskId === task.id) {
                  <button class="btn-timer btn-timer--active"
                          matTooltip="Minuteur en cours — arrêter dans la sidebar"
                          disabled>
                    <mat-icon>timer</mat-icon>
                  </button>
                } @else {
                  <button class="btn-timer"
                          matTooltip="Démarrer le minuteur sur cette tâche"
                          (click)="startTaskTimer(task)">
                    <mat-icon>play_circle</mat-icon>
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  </div>

</div>
  `,
  styles: [`
    .page { display: flex; flex-direction: column; height: 100%; min-height: 0; }

    /* Header */
    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 0; flex-shrink:0; }
    .pg-header__left { display:flex; align-items:center; gap:14px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .pg-icon--indigo { background:linear-gradient(135deg,#6366f1,#4f46e5); box-shadow:0 4px 14px rgba(99,102,241,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }
    .btn-new-task { display:flex; align-items:center; gap:7px; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border:none; padding:10px 20px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,.35); transition:box-shadow .2s; }
    .btn-new-task:hover { box-shadow:0 6px 20px rgba(99,102,241,.5); }
    .btn-new-task mat-icon { font-size:17px; width:17px; height:17px; }

    /* KPI */
    .kpi-row { display:flex; gap:14px; padding:18px 28px; flex-shrink:0; }
    .kpi-card { flex:1; background:#fff; border-radius:12px; padding:16px 18px; box-shadow:0 1px 4px rgba(0,0,0,.07); border:1px solid #f1f5f9; display:flex; flex-direction:column; align-items:flex-start; gap:4px; }
    .kpi-num { font-size:26px; font-weight:800; line-height:1; }
    .kpi-lbl { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
    .kpi-blue .kpi-num   { color:#3b82f6; }
    .kpi-orange .kpi-num { color:#f97316; }
    .kpi-green .kpi-num  { color:#10b981; }
    .kpi-red .kpi-num    { color:#ef4444; }
    .kpi-purple .kpi-num { color:#8b5cf6; }

    /* Filter bar */
    .filter-bar { display:flex; align-items:center; gap:10px; padding:0 28px 16px; flex-wrap:wrap; flex-shrink:0; }
    .fb-select, .fb-search { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; }
    .fb-select:focus, .fb-search:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
    .fb-search { min-width:200px; }
    .fb-btn-apply { height:36px; background:#6366f1; color:#fff; border:none; border-radius:7px; padding:0 16px; font-size:13px; font-weight:600; cursor:pointer; transition:background .15s; }
    .fb-btn-apply:hover { background:#4f46e5; }
    .fb-btn-clear { height:36px; background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; border-radius:7px; padding:0 14px; font-size:13px; cursor:pointer; transition:all .15s; }
    .fb-btn-clear:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }

    /* Table toolbar */
    .table-toolbar { display:flex; align-items:center; gap:8px; padding:0 28px 10px; flex-shrink:0; }
    .tb-count { font-size:12px; color:#64748b; margin-left:auto; font-weight:600; }
    .tb-btn { height:32px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0 12px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px; color:#374151; transition:all .15s; }
    .tb-btn:hover { background:#e0e7ff; border-color:#c7d2fe; color:#4f46e5; }

    /* Table */
    .table-wrap { flex:1; overflow:auto; padding:0 28px 28px; }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table thead { background:#1e293b; }
    .data-table th { color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:11px 14px; text-align:left; white-space:nowrap; }
    .data-table tbody tr:nth-child(even) { background:#f8fafc; }
    .data-table tbody tr:hover { background:#eef2ff; cursor:pointer; }
    .data-table td { padding:10px 14px; color:#374151; border-bottom:1px solid #f1f5f9; vertical-align:middle; }

    .td-id { font-family:monospace; font-size:11px; color:#94a3b8; }
    .td-titre .titre-text { font-weight:500; max-width:220px; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .td-client { color:#475569; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .td-date { white-space:nowrap; }
    .td-none { color:#cbd5e1; }
    .td-user .user-chip { display:flex; align-items:center; gap:6px; }
    .user-av { width:22px; height:22px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#4f46e5); display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; color:white; flex-shrink:0; }
    .td-fact-oui { color:#15803d; font-weight:600; font-size:12px; }
    .td-fact-non { color:#dc2626; font-size:12px; }
    .td-actions { width:38px; text-align:center; }
    .btn-timer {
      width:28px; height:28px; border-radius:50%; border:none;
      background:none; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
      color:#94a3b8; transition:background .12s, color .12s;
    }
    .th-actions { width:38px; }
    .btn-timer mat-icon { font-size:18px; width:18px; height:18px; }
    .btn-timer:hover { background:#eef2ff; color:#6366f1; }
    .btn-timer--active { color:#ef4444; animation:timerPulse 1.5s ease-in-out infinite; }
    @keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:.5} }

    /* Type badges */
    .type-badge { font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px; }
    .type-tva    { background:#fef9c3; color:#854d0e; }
    .type-paie   { background:#dbeafe; color:#1e40af; }
    .type-achats { background:#fce7f3; color:#9d174d; }
    .type-ventes { background:#dcfce7; color:#14532d; }
    .type-rb     { background:#f0fdf4; color:#15803d; }
    .type-gv     { background:#ede9fe; color:#5b21b6; }
    .type-dr     { background:#fff7ed; color:#c2410c; }
    .type-autre  { background:#f1f5f9; color:#475569; }

    /* Statut badges */
    .st-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:20px; font-size:11px; font-weight:600; }
    .st-a-faire    { background:#dbeafe; color:#1d4ed8; }
    .st-en-cours   { background:#ffedd5; color:#c2410c; }
    .st-terminee   { background:#dcfce7; color:#15803d; }
    .st-non-fait   { background:#fee2e2; color:#dc2626; }
    .st-en-pause   { background:#f1f5f9; color:#475569; }
    .st-en-attente { background:#ede9fe; color:#7c3aed; }

    /* Priorité */
    .pr-haute   { color:#dc2626; font-weight:700; font-size:12px; }
    .pr-normale { color:#374151; font-size:12px; }
    .pr-basse   { color:#64748b; font-size:12px; }

    .badge-libre { font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px; background:#fffbeb; color:#d97706; }
    .overdue { color:#dc2626; font-weight:600; }

    /* Empty state */
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 28px; color:#94a3b8; gap:12px; }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; opacity:.3; display:block; }
    .empty-state p { font-size:14px; margin:0; }
  `],
})
export class TravailTachesComponent implements OnInit, OnDestroy {
  private tasksService   = inject(TasksService);
  private clientsService = inject(ClientsService);
  private usersService   = inject(UsersService);
  private dialog         = inject(MatDialog);
  private router         = inject(Router);
  readonly timerSvc      = inject(TimerService);
  private _destroy$      = new Subject<void>();

  loading       = signal(true);
  allTasks      = signal<Task[]>([]);
  filteredTasks = signal<Task[]>([]);
  clients: Client[] = [];
  users: User[]     = [];

  filterStatut    = '';
  filterPriorite  = '';
  filterType      = '';
  filterClient    = '';
  filterAssigne   = '';
  filterFacturable= '';
  filterSearch    = '';

  ngOnInit() {
    this.tasksService.getAllGlobal().pipe(takeUntil(this._destroy$)).subscribe(tasks => {
      this.allTasks.set(tasks);
      this.applyFilters();
      this.loading.set(false);
    });
    this.clientsService.getAll().pipe(takeUntil(this._destroy$)).subscribe(c => this.clients = c);
    this.usersService.getAll().pipe(takeUntil(this._destroy$)).subscribe(u => this.users = u);
  }

  ngOnDestroy() { this._destroy$.next(); this._destroy$.complete(); }

  reload() {
    this.loading.set(true);
    this.tasksService.getAllGlobal().pipe(takeUntil(this._destroy$)).subscribe(tasks => {
      this.allTasks.set(tasks);
      this.applyFilters();
      this.loading.set(false);
    });
  }

  applyFilters() {
    let tasks = this.allTasks();
    if (this.filterStatut)    tasks = tasks.filter(t => t.statut === this.filterStatut);
    if (this.filterPriorite)  tasks = tasks.filter(t => t.priorite === this.filterPriorite);
    if (this.filterType)      tasks = tasks.filter(t => t.type === this.filterType);
    if (this.filterClient)    tasks = tasks.filter(t => t.client?.id === +this.filterClient);
    if (this.filterAssigne)   tasks = tasks.filter(t => t.assignee?.id === +this.filterAssigne);
    if (this.filterFacturable === 'true')  tasks = tasks.filter(t => t.estFacturable === true);
    if (this.filterFacturable === 'false') tasks = tasks.filter(t => t.estFacturable !== true);
    if (this.filterSearch.trim()) {
      const q = this.filterSearch.toLowerCase();
      tasks = tasks.filter(t => t.titre.toLowerCase().includes(q) || (t.client?.nom ?? '').toLowerCase().includes(q));
    }
    this.filteredTasks.set(tasks);
  }

  clearFilters() {
    this.filterStatut = this.filterPriorite = this.filterType = '';
    this.filterClient = this.filterAssigne = this.filterFacturable = this.filterSearch = '';
    this.applyFilters();
  }

  hasActiveFilters() {
    return !!(this.filterStatut || this.filterPriorite || this.filterType || this.filterClient || this.filterAssigne || this.filterFacturable || this.filterSearch);
  }

  countByStatut(statut: string) { return this.allTasks().filter(t => t.statut === statut).length; }

  totalHeures() { return this.allTasks().reduce((acc, t) => acc + (t.tempsExecution ?? 0), 0); }

  isOverdue(task: Task): boolean {
    if (!task.dateEcheance) return false;
    return new Date(task.dateEcheance) < new Date() && task.statut !== 'TERMINEE';
  }

  initials(user: { firstName?: string; lastName?: string }): string {
    return ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase();
  }

  statutLabel(s: string): string {
    const m: Record<string, string> = {
      A_FAIRE: 'À faire', EN_COURS: 'En cours', EN_PAUSE: 'En pause',
      TERMINEE: 'Terminée', NON_FAIT: 'Non fait', EN_ATTENTE: 'En attente',
    };
    return m[s] ?? s;
  }

  statutClass(s: string): string {
    const m: Record<string, string> = {
      A_FAIRE: 'st-a-faire', EN_COURS: 'st-en-cours', EN_PAUSE: 'st-en-pause',
      TERMINEE: 'st-terminee', NON_FAIT: 'st-non-fait', EN_ATTENTE: 'st-en-attente',
    };
    return m[s] ?? '';
  }

  prioClass(p: string): string {
    const m: Record<string, string> = { HAUTE: 'pr-haute', NORMALE: 'pr-normale', BASSE: 'pr-basse' };
    return m[p] ?? 'pr-normale';
  }

  openCreateDialog() {
    import('../../../tasks/tasks-global.component').then(m => {
      this.dialog.open((m as any).CreateTaskDialogComponent, {
        width: '620px',
        maxHeight: '92vh',
        data: { clients: this.clients, users: this.users },
      }).afterClosed().subscribe((result: string) => {
        if (result === 'created') {
          this.tasksService.getAllGlobal().pipe(takeUntil(this._destroy$)).subscribe(tasks => {
            this.allTasks.set(tasks);
            this.applyFilters();
          });
        }
      });
    });
  }

  openDetail(_task: Task) {
    // Délègue au router — vue détail tâche à venir
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
