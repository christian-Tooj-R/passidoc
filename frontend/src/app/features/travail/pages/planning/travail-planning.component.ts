import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil, forkJoin } from 'rxjs';

import { TasksService, Task } from '../../../../core/services/tasks.service';
import { UsersService } from '../../../../core/services/users.service';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-travail-planning',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
<div class="page">
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--blue"><mat-icon>groups</mat-icon></div>
      <div>
        <h1 class="pg-title">Planning équipe</h1>
        <p class="pg-sub">Semaine {{ currentWeekLabel() }} · {{ users.length }} collaborateur(s)</p>
      </div>
    </div>
    <div class="header-nav">
      <button class="nav-btn" (click)="prevWeek()"><mat-icon>chevron_left</mat-icon></button>
      <span class="week-label">{{ currentWeekLabel() }}</span>
      <button class="nav-btn" (click)="nextWeek()"><mat-icon>chevron_right</mat-icon></button>
      <button class="nav-btn-today" (click)="goToday()">Aujourd'hui</button>
    </div>
  </div>

  @if (loading()) {
    <div class="loading-wrap">
      <mat-icon class="spin">refresh</mat-icon>
      <span>Chargement du planning…</span>
    </div>
  } @else {
    <div class="planning-wrap">
      <table class="planning-table">
        <thead>
          <tr>
            <th class="th-collab">Collaborateur</th>
            @for (day of weekDays(); track day.date) {
              <th class="th-day" [class.th-day--today]="day.isToday">
                <div class="day-name">{{ day.name }}</div>
                <div class="day-date">{{ day.label }}</div>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (user of users; track user.id) {
            <tr>
              <td class="td-collab">
                <div class="collab-cell">
                  <div class="collab-avatar">{{ initials(user) }}</div>
                  <span class="collab-name">{{ user.firstName }} {{ user.lastName }}</span>
                </div>
              </td>
              @for (day of weekDays(); track day.date) {
                <td class="td-tasks" [class.td-today]="day.isToday">
                  @for (task of tasksForUserDay(user.id, day.date); track task.id) {
                    <div class="task-chip" [class]="'chip-' + statClass(task.statut)" [matTooltip]="task.titre">
                      {{ task.titre.length > 22 ? (task.titre | slice:0:22) + '…' : task.titre }}
                    </div>
                  }
                  @if (tasksForUserDay(user.id, day.date).length === 0) {
                    <div class="td-empty">—</div>
                  }
                </td>
              }
            </tr>
          }
          @if (users.length === 0) {
            <tr>
              <td [attr.colspan]="6" class="td-no-data">Aucun collaborateur trouvé</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>
  `,
  styles: [`
    .page { display:flex; flex-direction:column; height:100%; min-height:0; }

    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px 16px; background:#fff; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .pg-header__left { display:flex; align-items:center; gap:12px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; }
    .pg-icon--blue { background:linear-gradient(135deg,#3b82f6,#1d4ed8); box-shadow:0 4px 14px rgba(59,130,246,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }

    .header-nav { display:flex; align-items:center; gap:8px; }
    .nav-btn { width:32px; height:32px; border:1px solid #e2e8f0; border-radius:7px; background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#374151; }
    .nav-btn:hover { background:#f1f5f9; }
    .nav-btn mat-icon { font-size:18px; width:18px; height:18px; }
    .week-label { font-size:13px; font-weight:600; color:#374151; min-width:100px; text-align:center; }
    .nav-btn-today { height:32px; padding:0 14px; border:1px solid #6366f1; border-radius:7px; background:#fff; color:#6366f1; font-size:12px; font-weight:600; cursor:pointer; }
    .nav-btn-today:hover { background:#eef2ff; }

    .loading-wrap { display:flex; align-items:center; justify-content:center; gap:10px; padding:60px; color:#94a3b8; font-size:14px; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .planning-wrap { flex:1; overflow:auto; padding:20px 24px; }
    .planning-table { width:100%; border-collapse:collapse; min-width:700px; }
    .planning-table thead { background:#1e293b; }
    .th-collab { color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:12px 16px; text-align:left; min-width:180px; }
    .th-day { color:#94a3b8; font-size:11px; font-weight:600; text-align:center; padding:10px 8px; min-width:140px; }
    .th-day--today .day-name { color:#a5b4fc; }
    .th-day--today .day-date { color:#fff; font-weight:700; font-size:13px; }
    .day-name { font-size:10px; text-transform:uppercase; letter-spacing:.05em; }
    .day-date { font-size:13px; font-weight:700; color:#e2e8f0; margin-top:2px; }

    .planning-table tbody tr:nth-child(even) { background:#f8fafc; }
    .planning-table tbody tr:hover { background:#eef2ff; }
    .td-collab { padding:12px 16px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
    .collab-cell { display:flex; align-items:center; gap:8px; }
    .collab-avatar { width:30px; height:30px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .collab-name { font-size:13px; font-weight:600; color:#0f172a; }

    .td-tasks { padding:8px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
    .td-today { background:rgba(99,102,241,.04); }
    .td-empty { color:#cbd5e1; font-size:12px; text-align:center; padding:8px 0; }
    .td-no-data { text-align:center; color:#94a3b8; padding:40px; font-size:14px; }

    .task-chip { font-size:11px; font-weight:500; padding:3px 8px; border-radius:6px; margin-bottom:4px; cursor:default; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .chip-blue   { background:#dbeafe; color:#1d4ed8; }
    .chip-orange { background:#ffedd5; color:#c2410c; }
    .chip-green  { background:#dcfce7; color:#15803d; }
    .chip-red    { background:#fee2e2; color:#dc2626; }
  `],
})
export class TravailPlanningComponent implements OnInit, OnDestroy {
  private tasksSvc = inject(TasksService);
  private usersSvc = inject(UsersService);
  private _d$ = new Subject<void>();

  weekOffset = signal(0);
  allTasks = signal<Task[]>([]);
  users: User[] = [];
  loading = signal(true);

  weekDays = computed(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) + this.weekOffset() * 7);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const today = new Date();
      return {
        date: d.toISOString().split('T')[0],
        name: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'][i],
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        isToday: d.toDateString() === today.toDateString(),
      };
    });
  });

  currentWeekLabel = computed(() => {
    const days = this.weekDays();
    return `${days[0].label} – ${days[4].label}`;
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    forkJoin({
      tasks: this.tasksSvc.getAllGlobal(),
      users: this.usersSvc.getAll(),
    }).pipe(takeUntil(this._d$)).subscribe({
      next: ({ tasks, users }) => {
        this.allTasks.set(tasks);
        this.users = users.filter(u => u.isActive);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  tasksForUserDay(userId: number, date: string): Task[] {
    return this.allTasks().filter(t =>
      t.assignee?.id === userId &&
      t.dateEcheance?.startsWith(date)
    );
  }

  prevWeek() { this.weekOffset.update(v => v - 1); this.load(); }
  nextWeek() { this.weekOffset.update(v => v + 1); this.load(); }
  goToday()  { this.weekOffset.set(0); this.load(); }

  statClass(s: string): string {
    if (s === 'TERMINEE') return 'green';
    if (s === 'EN_COURS') return 'orange';
    if (s === 'NON_FAIT') return 'red';
    return 'blue';
  }

  initials(u: User): string {
    return ((u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '')).toUpperCase();
  }

  ngOnDestroy() {
    this._d$.next();
    this._d$.complete();
  }
}
