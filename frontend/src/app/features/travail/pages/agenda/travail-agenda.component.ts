import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil, interval } from 'rxjs';
import { SaisieTempsService, SaisieTemps } from '../../../../core/services/saisie-temps.service';

interface CalEvent {
  saisie: SaisieTemps;
  topPx: number;
  heightPx: number;
  allDay: boolean;
  colorClass: string;
  label: string;
}

interface Selection {
  day: string;
  startSlot: number;
  endSlot: number;
}

const SLOT_H  = 44;   // px par demi-heure
const CAL_START = 7;  // 7h
const CAL_END   = 21; // 21h
const SLOTS = (CAL_END - CAL_START) * 2; // 28 slots

@Component({
  selector: 'app-travail-agenda',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
<div class="page" (mouseup)="endSelect()" (mouseleave)="cancelSelect()">

  <!-- ── Header ── -->
  <div class="ag-header">
    <div class="ag-header__left">
      <div class="ag-icon">
        <mat-icon>event</mat-icon>
      </div>
      <div>
        <h1 class="ag-title">Agenda réalisé</h1>
        <p class="ag-sub">{{ weekLabel() }} · <strong>{{ totalWeekH() | number:'1.1-1' }}h</strong> saisies</p>
      </div>
    </div>

    <div class="ag-header__center">
      <button class="nav-btn" (click)="prevPeriod()"><mat-icon>chevron_left</mat-icon></button>
      <span class="week-txt">{{ weekLabel() }}</span>
      <button class="nav-btn" (click)="nextPeriod()"><mat-icon>chevron_right</mat-icon></button>
      <button class="btn-today" (click)="goToday()">Aujourd'hui</button>
    </div>

    <div class="ag-header__right">
      <div class="view-toggle">
        <button [class.vt-active]="viewMode() === 'semaine'" (click)="setView('semaine')">Semaine</button>
        <button [class.vt-active]="viewMode() === 'jour'"    (click)="setView('jour')">Jour</button>
      </div>
      <button class="btn-new" (click)="onNewTemps()">
        <mat-icon>add</mat-icon> Nouveau temps
      </button>
    </div>
  </div>

  <!-- ── Légende ── -->
  <div class="ag-legend">
    <span class="leg-item"><span class="leg-dot leg-green"></span> Facturable</span>
    <span class="leg-item"><span class="leg-dot leg-red"></span> Non facturable</span>
    <span class="leg-item"><span class="leg-dot leg-blue"></span> Autre</span>
    @if (selection()) {
      <span class="leg-sel">
        <mat-icon>touch_app</mat-icon>
        Sélection : {{ selLabel() }}
        <button class="sel-confirm" (click)="confirmSelection()">Saisir ce créneau</button>
        <button class="sel-cancel" (click)="cancelSelect()">✕</button>
      </span>
    }
    <span class="leg-total">Total semaine : <strong>{{ totalWeekH() | number:'1.1-1' }}h</strong></span>
  </div>

  @if (loading()) {
    <div class="loading-state">
      <mat-icon class="spin">refresh</mat-icon>
      <span>Chargement de l'agenda…</span>
    </div>
  } @else {

    <!-- ── Grille calendrier ── -->
    <div class="cal-wrap">
      <div class="cal-grid">

        <!-- Colonne heures -->
        <div class="col-time">
          <div class="col-hd col-hd--time"></div>
          <div class="allday-hd"><span>Toute la journée</span></div>
          <div class="body-time">
            @for (slot of timeSlots; track slot.index) {
              <div class="tl-slot" [class.tl-slot--hour]="slot.isHour">
                @if (slot.isHour) { <span>{{ slot.label }}</span> }
              </div>
            }
          </div>
        </div>

        <!-- Colonnes jours -->
        @for (day of visibleDays(); track day.date) {
          <div class="cal-col" [class.cal-col--today]="day.isToday">

            <!-- Header -->
            <div class="col-hd" [class.col-hd--today]="day.isToday">
              <div class="hd-name">{{ day.name }}</div>
              <div class="hd-num">{{ day.num }}</div>
              <div class="hd-total" [class.hd-total--has]="day.totalH > 0">
                {{ day.totalH | number:'1.1-1' }}h
              </div>
            </div>

            <!-- All-day -->
            <div class="allday-zone">
              @for (ev of allDayFor(day.date); track ev.saisie.id) {
                <div class="allday-chip" [class]="ev.colorClass" [matTooltip]="ev.label">
                  {{ ev.saisie.dureeHeures }}h · {{ ev.label | slice:0:18 }}
                </div>
              }
              @if (allDayFor(day.date).length === 0) { <div class="allday-empty"></div> }
            </div>

            <!-- Corps positionné -->
            <div class="cal-body"
                 [style.height]="bodyH + 'px'"
                 (mousedown)="startSelect($event, day.date)"
                 (mousemove)="moveSelect($event)"
                 (mouseup)="endSelect()">

              <!-- Grille slots -->
              @for (slot of timeSlots; track slot.index) {
                <div class="slot" [class.slot--hour]="slot.isHour"></div>
              }

              <!-- Indicateur temps courant (colonne today) -->
              @if (day.isToday && nowTopPx() >= 0) {
                <div class="now-line" [style.top]="nowTopPx() + 'px'">
                  <div class="now-dot"></div>
                </div>
              }

              <!-- Sélection en cours -->
              @if (selection()?.day === day.date) {
                <div class="sel-block"
                     [style.top]="selTop() + 'px'"
                     [style.height]="selHeight() + 'px'">
                  <span>{{ selLabel() }}</span>
                </div>
              }

              <!-- Événements -->
              @for (ev of positionedFor(day.date); track ev.saisie.id) {
                <div class="ev-block"
                     [class]="ev.colorClass"
                     [style.top]="ev.topPx + 'px'"
                     [style.height]="ev.heightPx + 'px'"
                     [matTooltip]="ev.label + (ev.saisie.client ? ' · ' + ev.saisie.client.nom : '')">
                  <div class="ev-time">{{ fmt(ev.saisie.heureDebut) }}–{{ fmt(ev.saisie.heureFin) }}</div>
                  <div class="ev-lbl">{{ ev.label }}</div>
                  @if (ev.saisie.client && ev.heightPx > 50) {
                    <div class="ev-client">{{ ev.saisie.client.nom }}</div>
                  }
                  @if (ev.heightPx > 70) {
                    <div class="ev-dur">{{ ev.saisie.dureeHeures }}h</div>
                  }
                </div>
              }

            </div>
          </div>
        }
      </div>
    </div>
  }

  <!-- ── Mini-form saisie créneau sélectionné ── -->
  @if (showNewForm()) {
    <div class="new-form-overlay" (click)="showNewForm.set(false)">
      <div class="new-form" (click)="$event.stopPropagation()">
        <div class="new-form__hd">
          <mat-icon>schedule</mat-icon>
          <span>Nouvelle saisie de temps</span>
          <button class="nf-close" (click)="showNewForm.set(false)"><mat-icon>close</mat-icon></button>
        </div>
        <div class="new-form__body">
          <p class="nf-info">
            <strong>{{ newFormDay }}</strong> · {{ newFormStart }} → {{ newFormEnd }}
            ({{ newFormDuration }}h)
          </p>
          <p class="nf-hint">Rendez-vous dans <strong>Saisie des temps</strong> pour compléter et enregistrer cette entrée avec toutes les informations requises.</p>
          <button class="nf-btn" (click)="showNewForm.set(false)">Fermer</button>
        </div>
      </div>
    </div>
  }
</div>
  `,
  styles: [`
    .page { display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden; user-select:none; }

    /* ── Header ── */
    .ag-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 20px; background:#fff; border-bottom:1px solid #e2e8f0;
      flex-shrink:0; gap:16px;
    }
    .ag-header__left  { display:flex; align-items:center; gap:12px; min-width:0; flex:1; }
    .ag-header__center{ display:flex; align-items:center; gap:8px; }
    .ag-header__right { display:flex; align-items:center; gap:10px; }

    .ag-icon {
      width:44px; height:44px; border-radius:12px; flex-shrink:0;
      background:linear-gradient(135deg,#6366f1,#4f46e5);
      box-shadow:0 4px 14px rgba(99,102,241,.35);
      display:flex; align-items:center; justify-content:center;
    }
    .ag-icon mat-icon { color:#fff; font-size:24px; width:24px; height:24px; }
    .ag-title { font-size:18px; font-weight:800; color:#0f172a; margin:0; }
    .ag-sub   { font-size:12px; color:#64748b; margin:2px 0 0; }

    .nav-btn {
      width:32px; height:32px; border:1px solid #e2e8f0; border-radius:7px;
      background:#fff; cursor:pointer; display:flex; align-items:center;
      justify-content:center; color:#374151; transition:background .12s;
    }
    .nav-btn:hover { background:#f1f5f9; }
    .nav-btn mat-icon { font-size:18px; width:18px; height:18px; }
    .week-txt { font-size:13px; font-weight:600; color:#374151; min-width:160px; text-align:center; }
    .btn-today {
      height:32px; padding:0 14px; border:1px solid #6366f1; border-radius:7px;
      background:#fff; color:#6366f1; font-size:12px; font-weight:600; cursor:pointer;
    }
    .btn-today:hover { background:#eef2ff; }
    .view-toggle { display:flex; border:1px solid #e2e8f0; border-radius:7px; overflow:hidden; }
    .view-toggle button {
      height:32px; padding:0 14px; border:none; background:#fff; color:#374151;
      font-size:12px; font-weight:500; cursor:pointer;
    }
    .vt-active { background:#eef2ff !important; color:#6366f1 !important; font-weight:700 !important; }
    .btn-new {
      display:flex; align-items:center; gap:6px; height:36px; padding:0 16px;
      background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff;
      border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;
      box-shadow:0 3px 10px rgba(99,102,241,.3);
    }
    .btn-new mat-icon { font-size:16px; width:16px; height:16px; }

    /* ── Légende ── */
    .ag-legend {
      display:flex; align-items:center; gap:16px; padding:8px 20px;
      background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-shrink:0;
      font-size:12px; flex-wrap:wrap;
    }
    .leg-item { display:flex; align-items:center; gap:5px; color:#64748b; }
    .leg-dot  { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .leg-green { background:#22c55e; }
    .leg-red   { background:#f87171; }
    .leg-blue  { background:#60a5fa; }
    .leg-sel {
      display:flex; align-items:center; gap:8px;
      background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px;
      padding:4px 10px; color:#4338ca; font-weight:600;
    }
    .leg-sel mat-icon { font-size:14px; width:14px; height:14px; }
    .sel-confirm {
      background:#6366f1; color:#fff; border:none; border-radius:5px;
      padding:3px 10px; font-size:11px; font-weight:600; cursor:pointer;
    }
    .sel-cancel {
      background:none; border:none; color:#94a3b8; cursor:pointer;
      font-size:14px; padding:0 2px; font-weight:700;
    }
    .leg-total { margin-left:auto; color:#374151; font-size:12px; }

    .loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:60px; color:#94a3b8; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    /* ── Grille ── */
    .cal-wrap { flex:1; overflow:auto; }
    .cal-grid  { display:flex; min-width:600px; }

    /* Colonne heures */
    .col-time { flex:0 0 52px; display:flex; flex-direction:column; }
    .col-hd   { height:72px; background:#fff; border-bottom:2px solid #e2e8f0; border-right:1px solid #e2e8f0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; position:sticky; top:0; z-index:20; flex-shrink:0; }
    .col-hd--time { border-right:1px solid #e2e8f0; }
    .col-hd--today { background:#eef2ff; border-bottom-color:#6366f1; }
    .allday-hd {
      height:32px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;
      display:flex; align-items:center; justify-content:flex-end; padding-right:6px;
      font-size:9px; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em;
      font-weight:600; flex-shrink:0;
    }
    .body-time { flex:1; position:relative; }
    .tl-slot {
      height:44px; border-bottom:1px solid #f5f5f5;
      display:flex; align-items:flex-start; padding-top:2px; justify-content:flex-end;
      padding-right:8px; font-size:9.5px; color:#94a3b8; font-weight:500;
    }
    .tl-slot--hour { border-bottom:1px solid #e2e8f0; }

    /* Colonnes jours */
    .cal-col { display:flex; flex-direction:column; flex:1; border-right:1px solid #f1f5f9; min-width:90px; }
    .cal-col--today { background:rgba(99,102,241,.015); }

    .hd-name  { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; font-weight:600; }
    .hd-num   { font-size:22px; font-weight:800; color:#0f172a; line-height:1; margin:2px 0; }
    .col-hd--today .hd-num { color:#6366f1; }
    .hd-total {
      font-size:10px; color:#94a3b8; font-weight:600;
      background:#f1f5f9; border-radius:10px; padding:1px 7px;
    }
    .hd-total--has { background:#dbeafe; color:#1d4ed8; }
    .col-hd--today .hd-total--has { background:#e0e7ff; color:#4338ca; }

    /* All-day */
    .allday-zone {
      height:32px; border-bottom:1px solid #e2e8f0; background:#fafafa;
      padding:3px 4px; display:flex; flex-wrap:wrap; gap:2px; flex-shrink:0; overflow:hidden;
    }
    .allday-empty { height:32px; }
    .allday-chip {
      font-size:9.5px; font-weight:600; padding:2px 6px; border-radius:4px;
      color:#fff; cursor:default; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90%;
    }

    /* Corps positionné */
    .cal-body { position:relative; flex:1; cursor:crosshair; }
    .slot { height:44px; border-bottom:1px solid #f8f8f8; }
    .slot--hour { border-bottom:1px solid #e8ecf0; }

    /* Indicateur "maintenant" */
    .now-line {
      position:absolute; left:0; right:0; height:2px;
      background:#ef4444; z-index:5; pointer-events:none;
    }
    .now-dot {
      width:10px; height:10px; border-radius:50%; background:#ef4444;
      position:absolute; left:-4px; top:-4px;
    }

    /* Sélection d'intervalle */
    .sel-block {
      position:absolute; left:2px; right:2px; border-radius:6px;
      background:rgba(99,102,241,.2); border:2px dashed #6366f1;
      z-index:3; pointer-events:none;
      display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:700; color:#4338ca;
    }

    /* Blocs événements */
    .ev-block {
      position:absolute; left:3px; right:3px; border-radius:7px; padding:4px 7px;
      font-size:10.5px; color:#fff; overflow:hidden; cursor:pointer; z-index:2;
      box-shadow:0 2px 8px rgba(0,0,0,.18); transition:filter .12s, transform .1s;
    }
    .ev-block:hover { filter:brightness(1.08); transform:scaleX(1.01); z-index:4; }
    .ev-facturable     { background:linear-gradient(135deg,#22c55e,#16a34a); }
    .ev-non-facturable { background:linear-gradient(135deg,#f87171,#dc2626); }
    .ev-autre          { background:linear-gradient(135deg,#60a5fa,#2563eb); }
    .ev-time   { font-size:9px; opacity:.85; font-weight:600; letter-spacing:.02em; }
    .ev-lbl    { font-weight:700; line-height:1.2; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    .ev-client { font-size:9.5px; opacity:.8; margin-top:2px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .ev-dur    { font-size:9px; opacity:.75; margin-top:2px; }

    /* Mini-form overlay */
    .new-form-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:1000;
      display:flex; align-items:center; justify-content:center;
    }
    .new-form {
      background:#fff; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.25);
      width:360px; overflow:hidden;
    }
    .new-form__hd {
      display:flex; align-items:center; gap:10px; padding:16px 20px;
      background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff;
      font-size:14px; font-weight:700;
    }
    .new-form__hd mat-icon { font-size:18px; width:18px; height:18px; }
    .nf-close { background:none; border:none; color:rgba(255,255,255,.7); cursor:pointer; margin-left:auto; }
    .nf-close mat-icon { font-size:18px; width:18px; height:18px; }
    .new-form__body { padding:20px; }
    .nf-info { font-size:14px; font-weight:700; color:#1e293b; margin:0 0 10px; }
    .nf-hint { font-size:12.5px; color:#64748b; margin:0 0 16px; line-height:1.5; }
    .nf-btn {
      width:100%; padding:10px; border:none; border-radius:8px;
      background:#6366f1; color:#fff; font-size:13px; font-weight:600; cursor:pointer;
    }
  `],
})
export class TravailAgendaComponent implements OnInit, OnDestroy {
  private saisiesSvc = inject(SaisieTempsService);
  private cdr = inject(ChangeDetectorRef);
  private _d$ = new Subject<void>();

  weekOffset = signal(0);
  dayOffset  = signal(0);
  loading    = signal(true);
  viewMode   = signal<'semaine' | 'jour'>('semaine');
  saisies    = signal<SaisieTemps[]>([]);

  // Sélection
  selection  = signal<Selection | null>(null);
  showNewForm = signal(false);
  newFormDay = ''; newFormStart = ''; newFormEnd = ''; newFormDuration = 0;
  private isSelecting = false;

  // Indicateur "maintenant"
  nowTopPx = signal(-1);

  readonly timeSlots = Array.from({ length: SLOTS }, (_, i) => {
    const totalMin = i * 30;
    const hour = CAL_START + Math.floor(totalMin / 60);
    const min  = totalMin % 60;
    return {
      index: i,
      label: `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`,
      isHour: min === 0,
    };
  });

  readonly bodyH = SLOTS * SLOT_H;

  weekDays = computed(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) + this.weekOffset() * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const daySaisies = this.saisies().filter(s => s.date === dateStr || s.date?.startsWith(dateStr));
      const totalH = daySaisies.reduce((a, s) => a + s.dureeHeures, 0);
      const today = new Date();
      return {
        date: dateStr,
        name: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i],
        num: d.getDate(),
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        isToday: d.toDateString() === today.toDateString(),
        totalH,
      };
    });
  });

  visibleDays = computed(() => {
    const days = this.weekDays();
    if (this.viewMode() === 'jour') {
      const base = new Date();
      base.setDate(base.getDate() + this.dayOffset());
      const targetDate = base.toISOString().split('T')[0];
      const found = days.find(d => d.date === targetDate);
      return found ? [found] : [days[0]];
    }
    return days;
  });

  weekLabel = computed(() => {
    if (this.viewMode() === 'jour') {
      const days = this.visibleDays();
      return days[0] ? `${days[0].name} ${days[0].label}` : '';
    }
    const d = this.weekDays();
    return `${d[0].label} – ${d[6].label}`;
  });

  totalWeekH = computed(() => this.saisies().reduce((a, s) => a + s.dureeHeures, 0));

  selTop = computed(() => {
    const s = this.selection();
    if (!s) return 0;
    return Math.min(s.startSlot, s.endSlot) * SLOT_H;
  });

  selHeight = computed(() => {
    const s = this.selection();
    if (!s) return 0;
    return (Math.abs(s.endSlot - s.startSlot) + 1) * SLOT_H;
  });

  selLabel = computed(() => {
    const s = this.selection();
    if (!s) return '';
    const start = Math.min(s.startSlot, s.endSlot);
    const end   = Math.max(s.startSlot, s.endSlot);
    const startH = this.slotToTime(start);
    const endH   = this.slotToTime(end + 1);
    const dur = (end - start + 1) * 0.5;
    return `${startH} → ${endH} (${dur}h)`;
  });

  ngOnInit() {
    this.loadData();
    this.updateNowLine();
    interval(60000).pipe(takeUntil(this._d$)).subscribe(() => this.updateNowLine());
  }

  private updateNowLine() {
    const now = new Date();
    const totalMin = now.getHours() * 60 + now.getMinutes();
    const calStartMin = CAL_START * 60;
    const calEndMin   = CAL_END   * 60;
    if (totalMin < calStartMin || totalMin > calEndMin) { this.nowTopPx.set(-1); return; }
    this.nowTopPx.set(Math.round(((totalMin - calStartMin) / 30) * SLOT_H));
  }

  loadData() {
    this.loading.set(true);
    const days = this.weekDays();
    this.saisiesSvc.getTenant({ dateDebut: days[0].date, dateFin: days[6].date })
      .pipe(takeUntil(this._d$))
      .subscribe({
        next: s => { this.saisies.set(s); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  allDayFor(date: string): CalEvent[] {
    return this.saisies()
      .filter(s => (s.date === date || s.date?.startsWith(date)) && !s.heureDebut)
      .map(s => this.toEv(s, true));
  }

  positionedFor(date: string): CalEvent[] {
    return this.saisies()
      .filter(s => (s.date === date || s.date?.startsWith(date)) && !!s.heureDebut)
      .map(s => this.toEv(s, false));
  }

  private toEv(s: SaisieTemps, allDay: boolean): CalEvent {
    let topPx = 0;
    const heightPx = Math.max(SLOT_H * 0.6, s.dureeHeures * 2 * SLOT_H);
    if (!allDay && s.heureDebut) {
      const [h, m] = s.heureDebut.split(':').map(Number);
      const startMin = h * 60 + (m ?? 0);
      topPx = Math.max(0, ((startMin - CAL_START * 60) / 30) * SLOT_H);
    }
    const colorClass = s.type === 'FACTURABLE'
      ? 'ev-facturable'
      : s.type === 'NON_FACTURABLE' ? 'ev-non-facturable' : 'ev-autre';
    const label = s.missionCode
      ? `[${s.missionCode}] ${s.commentaire ?? ''}`
      : s.commentaire ?? s.type ?? '—';
    return { saisie: s, topPx, heightPx, allDay, colorClass, label };
  }

  fmt(t?: string): string { return t ? t.slice(0, 5) : ''; }

  private slotToTime(slot: number): string {
    const totalMin = slot * 30;
    const h = CAL_START + Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  private getSlotFromEvent(event: MouseEvent, target: EventTarget | null): number {
    const el = target as HTMLElement;
    const body = el.closest('.cal-body') as HTMLElement | null;
    if (!body) return -1;
    const rect = body.getBoundingClientRect();
    const y = event.clientY - rect.top;
    return Math.max(0, Math.min(SLOTS - 1, Math.floor(y / SLOT_H)));
  }

  startSelect(event: MouseEvent, day: string) {
    if ((event.target as HTMLElement).closest('.ev-block')) return;
    const slot = this.getSlotFromEvent(event, event.currentTarget);
    if (slot < 0) return;
    this.isSelecting = true;
    this.selection.set({ day, startSlot: slot, endSlot: slot });
  }

  moveSelect(event: MouseEvent) {
    if (!this.isSelecting) return;
    const s = this.selection();
    if (!s) return;
    const slot = this.getSlotFromEvent(event, event.currentTarget);
    if (slot >= 0) this.selection.set({ ...s, endSlot: slot });
  }

  endSelect() {
    if (!this.isSelecting) return;
    this.isSelecting = false;
  }

  cancelSelect() {
    this.isSelecting = false;
    this.selection.set(null);
  }

  confirmSelection() {
    const s = this.selection();
    if (!s) return;
    const start = Math.min(s.startSlot, s.endSlot);
    const end   = Math.max(s.startSlot, s.endSlot);
    this.newFormDay      = s.day;
    this.newFormStart    = this.slotToTime(start);
    this.newFormEnd      = this.slotToTime(end + 1);
    this.newFormDuration = (end - start + 1) * 0.5;
    this.cancelSelect();
    this.showNewForm.set(true);
  }

  setView(v: 'semaine' | 'jour') { this.viewMode.set(v); }

  prevPeriod() {
    if (this.viewMode() === 'semaine') { this.weekOffset.update(v => v - 1); this.loadData(); }
    else { this.dayOffset.update(v => v - 1); }
  }
  nextPeriod() {
    if (this.viewMode() === 'semaine') { this.weekOffset.update(v => v + 1); this.loadData(); }
    else { this.dayOffset.update(v => v + 1); }
  }
  goToday() { this.weekOffset.set(0); this.dayOffset.set(0); this.loadData(); }

  onNewTemps() { this.showNewForm.set(true); }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }
}
