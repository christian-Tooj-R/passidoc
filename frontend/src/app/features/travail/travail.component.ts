import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TimerService, SaisieTempsService, MISSION_CODES, CreateSaisieTempsDto } from '../../core/services/saisie-temps.service';
import { ClientsService } from '../../core/services/clients.service';
import { Client } from '../../core/models/client.model';

interface NavSection { label: string; items: NavItem[]; }
interface NavItem { label: string; icon: string; route: string; }

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'TÂCHES',
    items: [
      { label: 'Toutes les tâches',   icon: 'task_alt',      route: '/travail/taches'        },
      { label: 'Vue Kanban',          icon: 'view_kanban',   route: '/travail/kanban'        },
      { label: 'Tâches récurrentes',  icon: 'repeat',        route: '/travail/recurrentes'   },
    ],
  },
  {
    label: 'TEMPS PASSÉS',
    items: [
      { label: 'Saisie rapide',       icon: 'playlist_add',       route: '/travail/saisie'        },
      { label: 'Agenda réalisé',      icon: 'event',              route: '/travail/agenda'        },
      { label: 'Par semaine',         icon: 'date_range',         route: '/travail/temps/semaine' },
      { label: 'Par mois',            icon: 'calendar_month',     route: '/travail/temps/mois'    },
      { label: 'Détail des temps',    icon: 'manage_search',      route: '/travail/temps/detail'  },
    ],
  },
  {
    label: 'PLANNING',
    items: [
      { label: 'Planning équipe',     icon: 'groups',        route: '/travail/planning'          },
      { label: 'Feuille de temps',    icon: 'table_chart',   route: '/travail/feuille-temps'     },
    ],
  },
  {
    label: 'BUDGETS',
    items: [
      { label: 'Budget missions',     icon: 'pie_chart',     route: '/travail/budgets'           },
    ],
  },
  {
    label: 'RAPPORTS',
    items: [
      { label: 'Productivité',        icon: 'trending_up',   route: '/travail/rapports/productivite' },
      { label: 'Par client',          icon: 'business',      route: '/travail/rapports/clients'  },
      { label: 'Alertes',             icon: 'notifications_active', route: '/travail/rapports/alertes' },
    ],
  },
];

@Component({
  selector: 'app-travail',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, RouterModule, RouterOutlet, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
@if (entering()) {
  <div class="tw-entry">
    <div class="entry-card">
      <div class="entry-icon"><mat-icon>checklist_rtl</mat-icon></div>
      <h2>Travail</h2>
      <p>Chargement du module…</p>
      <div class="entry-bar"><div class="entry-bar__fill"></div></div>
    </div>
  </div>
}

<div class="tw-shell" [class.tw-shell--hidden]="entering()">

  <!-- ── Sidebar ── -->
  <aside class="tw-sidebar">

    <div class="tw-header">
      <div class="tw-header__icon"><mat-icon>checklist_rtl</mat-icon></div>
      <div class="tw-header__text">
        <span class="tw-header__title">Module Travail</span>
        <span class="tw-header__sub">AFYM Audit Expertise</span>
      </div>
    </div>

    <!-- ── Timer widget ── -->
    <div class="tw-timer" [class.tw-timer--running]="timerSvc.isRunning()">

      <!-- Contexte actif (tâche démarrée depuis une carte) -->
      @if (timerSvc.activeTaskCtx()) {
        <div class="tw-timer__ctx">
          <mat-icon class="tw-timer__ctx-icon">work_history</mat-icon>
          <span class="tw-timer__ctx-txt"
                [matTooltip]="timerSvc.activeTaskCtx()!.taskTitre">
            {{ timerSvc.activeTaskCtx()!.taskTitre.length > 22
               ? (timerSvc.activeTaskCtx()!.taskTitre | slice:0:22) + '…'
               : timerSvc.activeTaskCtx()!.taskTitre }}
          </span>
        </div>
      }

      <div class="tw-timer__display">
        <mat-icon class="tw-timer__icon">{{ timerSvc.isRunning() ? 'timer' : 'timer_off' }}</mat-icon>
        <span class="tw-timer__time">{{ timerSvc.displayTime$() }}</span>
      </div>

      <div class="tw-timer__btns">
        @if (!timerSvc.isRunning()) {
          <button class="tw-timer__btn tw-timer__btn--start" (click)="startTimer()">
            <mat-icon>play_arrow</mat-icon> Démarrer
          </button>
        } @else {
          <button class="tw-timer__btn tw-timer__btn--stop" (click)="stopTimer()">
            <mat-icon>stop</mat-icon> Arrêter & sauvegarder
          </button>
        }
      </div>
    </div>

    <!-- ── Formulaire de saisie après arrêt ── -->
    @if (showTimerForm()) {
      <div class="tw-tsave">
        <div class="tw-tsave__hd">
          <mat-icon>save_alt</mat-icon>
          <span>Enregistrer le temps</span>
          <button class="tw-tsave__close" (click)="discardTimerEntry()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
        <div class="tw-tsave__dur">
          <mat-icon>schedule</mat-icon>
          <strong>{{ timerStoppedH | number:'1.2-2' }}h</strong>
          <span class="tw-tsave__hhmm">{{ timerStoppedStart }} → {{ timerStoppedEnd }}</span>
        </div>
        <select class="tw-tsave__sel" [(ngModel)]="timerFormClientId">
          <option [ngValue]="null">— Client (optionnel) —</option>
          @for (c of clients; track c.id) {
            <option [ngValue]="c.id">{{ c.nom }}</option>
          }
        </select>
        <select class="tw-tsave__sel" [(ngModel)]="timerFormMission">
          <option value="">— Mission (optionnel) —</option>
          @for (m of missionCodes; track m.code) {
            <option [value]="m.code">{{ m.label }}</option>
          }
        </select>
        <div class="tw-tsave__type">
          <button [class.tw-tsave__type--on]="timerFormType === 'FACTURABLE'"
                  (click)="timerFormType = 'FACTURABLE'">Facturable</button>
          <button [class.tw-tsave__type--on]="timerFormType === 'NON_FACTURABLE'"
                  (click)="timerFormType = 'NON_FACTURABLE'">Non fact.</button>
        </div>
        <input class="tw-tsave__input" [(ngModel)]="timerFormComment"
               placeholder="Commentaire…" />
        <div class="tw-tsave__actions">
          <button class="tw-tsave__save" (click)="saveTimerEntry()"
                  [disabled]="timerSaving()">
            {{ timerSaving() ? '…' : 'Enregistrer' }}
          </button>
          <button class="tw-tsave__discard" (click)="discardTimerEntry()">
            Ignorer
          </button>
        </div>
        @if (timerSaveError()) {
          <p class="tw-tsave__err">{{ timerSaveError() }}</p>
        }
      </div>
    }

    <nav class="tw-nav">
      @for (section of sections; track section.label) {
        <span class="tw-nav__section">{{ section.label }}</span>
        @for (item of section.items; track item.route) {
          <a class="tw-nav__item"
             [routerLink]="item.route"
             routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: false }">
            <mat-icon class="tw-nav__icon">{{ item.icon }}</mat-icon>
            <span class="tw-nav__label">{{ item.label }}</span>
          </a>
        }
      }
    </nav>

    <div class="tw-spacer"></div>

    <button class="tw-back" (click)="router.navigate(['/dashboard'])">
      <mat-icon>arrow_back</mat-icon>
      <span>Retour à l'application</span>
    </button>

    <div class="tw-progress" [class.tw-progress--active]="navLoading()">
      <div class="tw-progress__bar"></div>
    </div>

  </aside>

  <!-- ── Contenu ── -->
  <main class="tw-main">
    <router-outlet />
  </main>

</div>
  `,
  styles: [`
    /* ── Écran d'entrée ── */
    .tw-entry {
      position: fixed; inset: 0; z-index: 9999;
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%);
      display: flex; align-items: center; justify-content: center;
      animation: entryFadeOut .4s ease-in 1.2s forwards;
    }
    @keyframes entryFadeOut { to { opacity: 0; pointer-events: none; } }
    .entry-card {
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      animation: entrySlideUp .5s cubic-bezier(.16,1,.3,1) forwards;
    }
    @keyframes entrySlideUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .entry-icon {
      width: 72px; height: 72px; border-radius: 20px;
      background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 40px rgba(99,102,241,.5);
    }
    .entry-icon mat-icon { color: #fff; font-size: 36px; width: 36px; height: 36px; }
    .entry-card h2 { color: #fff; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -.3px; }
    .entry-card p  { color: rgba(255,255,255,.5); font-size: 13px; margin: 0; }
    .entry-bar { width: 180px; height: 3px; background: rgba(255,255,255,.12); border-radius: 2px; overflow: hidden; }
    .entry-bar__fill {
      height: 100%; background: linear-gradient(90deg, #818cf8, #a5b4fc);
      border-radius: 2px; animation: barFill 1.1s cubic-bezier(.4,0,.2,1) forwards;
    }
    @keyframes barFill { from { width: 0; } to { width: 100%; } }

    /* ── Shell ── */
    .tw-shell {
      display: flex; height: 100vh; width: 100vw; overflow: hidden;
      animation: twFadeIn .35s ease .05s both;
    }
    .tw-shell--hidden { visibility: hidden; }
    @keyframes twFadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* ── Sidebar dark indigo ── */
    .tw-sidebar {
      width: 260px; flex-shrink: 0;
      background: linear-gradient(180deg, #1e1b4b 0%, #2d2a7a 60%, #1e1b4b 100%);
      border-right: none;
      display: flex; flex-direction: column;
      position: relative;
      box-shadow: 4px 0 24px rgba(0,0,0,.25);
      overflow-y: auto; overflow-x: hidden;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.2) transparent;
    }

    .tw-header {
      display: flex; align-items: center; gap: 10px;
      padding: 20px 16px 16px;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .tw-header__icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 3px 10px rgba(99,102,241,.4);
    }
    .tw-header__icon mat-icon { color: white; font-size: 20px; width: 20px; height: 20px; }
    .tw-header__title { display: block; font-size: 13px; font-weight: 700; color: #fff; line-height: 1.25; letter-spacing: -.1px; }
    .tw-header__sub { display: block; font-size: 11px; color: rgba(255,255,255,.45); margin-top: 1px; }

    /* ── Timer widget ── */
    .tw-timer {
      margin: 12px 12px 4px; padding: 12px; border-radius: 10px;
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.12);
      transition: all .3s;
    }
    .tw-timer--running {
      background: rgba(239,68,68,.15);
      border-color: rgba(239,68,68,.3);
      animation: timerPulse 2s ease-in-out infinite;
    }
    @keyframes timerPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.3); }
      50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
    }
    /* Timer context (tâche active) */
    .tw-timer__ctx {
      display: flex; align-items: center; gap: 5px; margin-bottom: 6px;
      background: rgba(255,255,255,.1); border-radius: 5px; padding: 4px 7px;
    }
    .tw-timer__ctx-icon { font-size: 12px; width: 12px; height: 12px; color: #a5b4fc; }
    .tw-timer__ctx-txt  { font-size: 10.5px; color: #c7d2fe; font-weight: 600; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .tw-timer__display { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .tw-timer__icon { color: rgba(255,255,255,.7); font-size: 20px; width: 20px; height: 20px; }
    .tw-timer--running .tw-timer__icon { color: #f87171; }
    .tw-timer__time { font-size: 18px; font-weight: 700; font-family: monospace; color: #fff; letter-spacing: 1px; }
    .tw-timer--running .tw-timer__time { color: #fca5a5; }
    .tw-timer__btns { display: flex; gap: 6px; }
    .tw-timer__btn {
      flex: 1; display: flex; align-items: center; justify-content: center;
      gap: 4px; padding: 6px 8px; border: none; border-radius: 6px;
      font-size: 11px; font-weight: 600; cursor: pointer; transition: background .15s;
    }
    .tw-timer__btn mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .tw-timer__btn--start { background: rgba(99,102,241,.4); color: #c7d2fe; }
    .tw-timer__btn--start:hover { background: rgba(99,102,241,.6); }
    .tw-timer__btn--stop  { background: rgba(239,68,68,.3); color: #fca5a5; }
    .tw-timer__btn--stop:hover  { background: rgba(239,68,68,.5); }

    /* ── Formulaire sauvegarde temps ── */
    .tw-tsave {
      margin: 4px 12px 8px; border-radius: 10px; overflow: hidden;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
    }
    .tw-tsave__hd {
      display: flex; align-items: center; gap: 7px; padding: 8px 12px;
      background: rgba(99,102,241,.25); font-size: 12px; font-weight: 700; color: #c7d2fe;
    }
    .tw-tsave__hd mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .tw-tsave__close {
      margin-left: auto; background: none; border: none; color: rgba(255,255,255,.5);
      cursor: pointer; padding: 0; display: flex;
    }
    .tw-tsave__close mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .tw-tsave__dur {
      display: flex; align-items: center; gap: 8px; padding: 7px 12px;
      font-size: 13px; color: #fff; border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .tw-tsave__dur mat-icon { font-size: 15px; width: 15px; height: 15px; color: #a5b4fc; }
    .tw-tsave__hhmm { font-size: 10.5px; color: rgba(255,255,255,.4); margin-left: auto; }
    .tw-tsave__sel {
      width: calc(100% - 24px); margin: 5px 12px 0; padding: 5px 8px;
      border-radius: 5px; border: 1px solid rgba(255,255,255,.15);
      background: rgba(255,255,255,.08); color: #e2e8f0; font-size: 11.5px;
    }
    .tw-tsave__sel option { background: #312e81; color: #e2e8f0; }
    .tw-tsave__type {
      display: flex; gap: 6px; padding: 5px 12px 0;
    }
    .tw-tsave__type button {
      flex: 1; padding: 4px 0; border-radius: 5px; border: 1px solid rgba(255,255,255,.15);
      background: rgba(255,255,255,.06); color: rgba(255,255,255,.5);
      font-size: 11px; font-weight: 600; cursor: pointer; transition: all .12s;
    }
    .tw-tsave__type--on { background: rgba(99,102,241,.4) !important; color: #c7d2fe !important; border-color: #6366f1 !important; }
    .tw-tsave__input {
      width: calc(100% - 24px); margin: 5px 12px 0; padding: 5px 8px;
      border-radius: 5px; border: 1px solid rgba(255,255,255,.15);
      background: rgba(255,255,255,.08); color: #e2e8f0; font-size: 11.5px;
    }
    .tw-tsave__input::placeholder { color: rgba(255,255,255,.3); }
    .tw-tsave__actions {
      display: flex; gap: 6px; padding: 8px 12px;
    }
    .tw-tsave__save {
      flex: 1; padding: 6px 0; border-radius: 6px; border: none;
      background: #6366f1; color: #fff; font-size: 12px; font-weight: 700; cursor: pointer;
    }
    .tw-tsave__save:disabled { opacity: .5; cursor: not-allowed; }
    .tw-tsave__discard {
      padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,.15);
      background: none; color: rgba(255,255,255,.4); font-size: 11px; cursor: pointer;
    }
    .tw-tsave__err { padding: 0 12px 8px; font-size: 10.5px; color: #f87171; margin: 0; }

    /* ── Nav ── */
    .tw-nav { display: flex; flex-direction: column; padding: 10px 10px 0; gap: 2px; }
    .tw-nav__section {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: rgba(255,255,255,.3);
      padding: 10px 8px 6px; display: block;
    }
    .tw-nav__section:first-child { padding-top: 0; }
    .tw-nav__item {
      display: flex; align-items: center; gap: 9px;
      padding: 9px 10px; border-radius: 7px;
      text-decoration: none; color: rgba(255,255,255,.65);
      font-size: 13px; font-weight: 500;
      transition: background .12s, color .12s;
      position: relative;
    }
    .tw-nav__item:hover { background: rgba(255,255,255,.08); color: #fff; }
    .tw-nav__item.active { background: rgba(255,255,255,.15); color: #fff; font-weight: 600; }
    .tw-nav__item.active::before {
      content: ''; position: absolute; left: 0; top: 6px; bottom: 6px;
      width: 3px; border-radius: 0 2px 2px 0; background: #a5b4fc;
    }
    .tw-nav__icon {
      font-size: 18px; width: 18px; height: 18px;
      color: rgba(255,255,255,.4); flex-shrink: 0; transition: color .12s;
    }
    .tw-nav__item:hover .tw-nav__icon { color: #a5b4fc; }
    .tw-nav__item.active .tw-nav__icon { color: #a5b4fc; }
    .tw-nav__label { flex: 1; min-width: 0; }

    .tw-spacer { flex: 1; }

    .tw-back {
      display: flex; align-items: center; gap: 7px;
      margin: 0 10px 12px; padding: 8px 10px;
      border: none; background: none; cursor: pointer;
      border-radius: 7px; color: rgba(255,255,255,.4);
      font-size: 12px; font-weight: 500; transition: background .12s, color .12s;
    }
    .tw-back mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .tw-back:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); }

    .tw-progress { height: 2px; background: transparent; overflow: hidden; flex-shrink: 0; }
    .tw-progress--active { background: rgba(255,255,255,.08); }
    .tw-progress__bar { height: 100%; width: 0; }
    .tw-progress--active .tw-progress__bar {
      width: 100%;
      background: linear-gradient(90deg, #6366f1 0%, #a5b4fc 50%, #6366f1 100%);
      background-size: 200% 100%;
      animation: progressBar 1.2s linear infinite;
    }
    @keyframes progressBar {
      0%   { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }

    .tw-main {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      display: flex; flex-direction: column;
      background: linear-gradient(180deg, #f0f0ff 0%, #f8f8ff 100%);
    }
  `],
})
export class TravailComponent implements OnInit, OnDestroy {
  router      = inject(Router);
  timerSvc    = inject(TimerService);
  saisiesSvc  = inject(SaisieTempsService);
  clientsSvc  = inject(ClientsService);

  entering   = signal(true);
  navLoading = signal(false);
  readonly sections     = NAV_SECTIONS;
  readonly missionCodes = MISSION_CODES;
  private _destroy$ = new Subject<void>();

  // ── Timer save form ────────────────────────────────────────────────────────
  showTimerForm     = signal(false);
  timerSaving       = signal(false);
  timerSaveError    = signal('');
  timerStoppedH     = 0;
  timerStoppedStart = '';
  timerStoppedEnd   = '';
  timerFormClientId: number | null = null;
  timerFormMission  = '';
  timerFormType: 'FACTURABLE' | 'NON_FACTURABLE' = 'FACTURABLE';
  timerFormComment  = '';
  clients: Client[] = [];

  startTimer() { this.timerSvc.start(); }

  stopTimer() {
    const ctx      = this.timerSvc.activeTaskCtx();
    const startTs  = this.timerSvc.startedAt();
    const endDate  = new Date();
    this.timerSvc.stop();

    this.timerStoppedEnd   = endDate.toTimeString().slice(0, 5);
    this.timerStoppedStart = startTs ? new Date(startTs).toTimeString().slice(0, 5) : '';

    // Durée dérivée des mêmes horaires (arrondis à la minute) que ceux affichés/enregistrés,
    // pour éviter tout écart entre "10:51 → 15:13" et la durée affichée.
    if (startTs) {
      const startMin = Math.floor(startTs        / 60000) * 60000;
      const endMin   = Math.floor(endDate.getTime() / 60000) * 60000;
      this.timerStoppedH = Math.round(((endMin - startMin) / 3600000) * 100) / 100;
    } else {
      this.timerStoppedH = 0;
    }

    this.timerFormClientId = ctx?.clientId ?? null;
    this.timerFormComment  = ctx?.taskTitre ?? '';
    this.timerFormMission  = '';
    this.timerFormType     = 'FACTURABLE';
    this.timerSaveError.set('');
    this.showTimerForm.set(true);
  }

  saveTimerEntry() {
    if (this.timerStoppedH <= 0) { this.showTimerForm.set(false); return; }
    const dto: CreateSaisieTempsDto = {
      date:        new Date().toISOString().split('T')[0],
      dureeHeures: this.timerStoppedH,
      type:        this.timerFormType,
      missionCode: this.timerFormMission || undefined,
      clientId:    this.timerFormClientId ?? undefined,
      commentaire: this.timerFormComment  || undefined,
      heureDebut:  this.timerStoppedStart || undefined,
      heureFin:    this.timerStoppedEnd   || undefined,
    };
    this.timerSaving.set(true);
    this.saisiesSvc.create(dto).subscribe({
      next:  () => { this.timerSaving.set(false); this.showTimerForm.set(false); },
      error: () => {
        this.timerSaving.set(false);
        this.timerSaveError.set('Erreur — réessayez.');
      },
    });
  }

  discardTimerEntry() { this.showTimerForm.set(false); }

  ngOnInit() {
    setTimeout(() => this.entering.set(false), 1600);
    this.router.events.pipe(takeUntil(this._destroy$)).subscribe(e => {
      if (e instanceof NavigationStart && this.router.url.startsWith('/travail')) {
        this.navLoading.set(true);
      }
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        setTimeout(() => this.navLoading.set(false), 280);
      }
    });
    this.clientsSvc.getAll().pipe(takeUntil(this._destroy$)).subscribe({
      next:  c => this.clients = c,
      error: () => {},
    });
  }

  ngOnDestroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
