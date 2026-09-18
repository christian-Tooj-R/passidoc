import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil, interval } from 'rxjs';
import { SaisieTempsService, SaisieTemps } from '../../../../core/services/saisie-temps.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { Client } from '../../../../core/models/client.model';
import { UsersService } from '../../../../core/services/users.service';
import { AuthService } from '../../../../core/services/auth.service';
import { User } from '../../../../core/models/user.model';
import { SaisieEditFormComponent, SaisieEditSeed, SaisieEditResult } from '../../shared/saisie-edit-form.component';

interface CalEvent {
  saisie: Partial<SaisieTemps>;
  topPx: number;
  heightPx: number;
  leftPct: number;
  widthPct: number;
  allDay: boolean;
  readonly: boolean;
  colorClass: string;
  colorStyle: string | null;
  label: string;
  subLabel: string | null;
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
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, SaisieEditFormComponent],
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
      <div class="nav-btn nav-btn--datepick" matTooltip="Aller à une date">
        <mat-icon>calendar_month</mat-icon>
        <input
          type="date"
          class="date-jump-input"
          aria-label="Aller à une date"
          [value]="jumpDateValue()"
          (change)="irALaDate($any($event.target).value)"
        />
      </div>
      <button class="btn-today" (click)="goToday()">Aujourd'hui</button>
    </div>

    <div class="ag-header__right">
      <button class="nav-btn nav-btn--collegues" [class.nav-btn--active]="sidebarOpen()"
              matTooltip="Calendriers des collègues" (click)="sidebarOpen.set(!sidebarOpen())">
        <mat-icon>people</mat-icon>
      </button>
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
    @for (c of selectedColleaguesList(); track c.id) {
      <span class="leg-item">
        <span class="leg-dot" [style.background]="colorFor(c.id)"></span>
        {{ c.firstName }} {{ c.lastName }}
      </span>
    }
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

  <div class="ag-body">

    <!-- ── Sidebar "Calendriers des collègues" (façon Outlook) ── -->
    @if (sidebarOpen()) {
      <div class="ag-sidebar">
        <div class="sidebar-hd">
          <span>Calendriers</span>
          <button class="sidebar-close" (click)="sidebarOpen.set(false)"><mat-icon>close</mat-icon></button>
        </div>

        <div class="sidebar-section">Mon calendrier</div>
        <label class="sidebar-item sidebar-item--me">
          <input type="checkbox" checked disabled />
          <span class="sidebar-dot" style="background:#6366f1"></span>
          <span class="sidebar-name">{{ myLabel() }}</span>
        </label>

        <div class="sidebar-section">Calendriers des collègues</div>
        @if (colleaguesLoading()) {
          <div class="sidebar-loading"><mat-icon class="spin">refresh</mat-icon> Chargement…</div>
        }
        @for (c of colleagues(); track c.id) {
          <label class="sidebar-item">
            <input type="checkbox" [checked]="isSelected(c.id)" (change)="toggleColleague(c)" />
            <span class="sidebar-dot" [style.background]="colorFor(c.id)"></span>
            <span class="sidebar-name">{{ c.firstName }} {{ c.lastName }}</span>
            @if (colleagueLoadingMap()[c.id]) { <mat-icon class="spin sidebar-item-spin">refresh</mat-icon> }
          </label>
        }
        @if (!colleaguesLoading() && colleagues().length === 0) {
          <div class="sidebar-empty">Aucun autre collègue.</div>
        }
        @if (selectedColleaguesList().length > 0) {
          <div class="sidebar-hint">
            Les créneaux des collègues affichent le détail complet de leur tâche
            (couleur dédiée par personne pour les différencier).
          </div>
        }
      </div>
    }

    @if (loading()) {
      <div class="loading-state">
        <mat-icon class="spin">refresh</mat-icon>
        <span>Chargement de l'agenda…</span>
      </div>
    } @else {

      <!-- ── Grille calendrier : mes créneaux + ceux des collègues sélectionnés, superposés
           (côte à côte UNIQUEMENT quand ils se chevauchent dans le temps) ── -->
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
                @for (ev of allDayForDay(day.date); track $index) {
                  <div class="allday-chip" [class]="ev.colorClass" [style.background]="ev.colorStyle"
                       [matTooltip]="tooltipFor(ev)">
                    {{ ev.saisie.dureeHeures }}h · {{ (ev.readonly ? ev.label : ev.label) | slice:0:18 }}
                  </div>
                }
                @if (allDayForDay(day.date).length === 0) { <div class="allday-empty"></div> }
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

                <!-- Indicateur temps courant -->
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

                <!-- Événements : les miens + ceux des collègues sélectionnés, positionnés
                     côte à côte automatiquement dès qu'ils se chevauchent dans le temps -->
                @for (ev of positionedForDay(day.date); track $index) {
                  <div class="ev-block" [class.ev-colleague]="ev.readonly"
                       [class]="ev.colorClass"
                       [style.top]="ev.topPx + 'px'"
                       [style.height]="ev.heightPx + 'px'"
                       [style.left]="ev.leftPct + '%'"
                       [style.width]="'calc(' + ev.widthPct + '% - 4px)'"
                       [style.background]="ev.colorStyle"
                       [matTooltip]="tooltipFor(ev)">
                    <div class="ev-time">{{ fmt(ev.saisie.heureDebut) }}–{{ fmt(ev.saisie.heureFin) }}</div>
                    @if (ev.readonly && ev.heightPx > 40) { <div class="ev-sub">{{ ev.subLabel }}</div> }
                    <div class="ev-lbl">{{ ev.label }}</div>
                    @if (ev.saisie.client && ev.heightPx > 50) {
                      <div class="ev-client">{{ ev.saisie.client!.nom }}</div>
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
  </div>

  <!-- ── Formulaire saisie créneau sélectionné ── -->
  @if (editing()) {
    <div class="new-form-overlay" (click)="closeEdit()">
      <div class="new-form" (click)="$event.stopPropagation()">
        <app-saisie-edit-form
          [clients]="clients"
          mode="create"
          [seed]="editSeed()"
          [submitting]="saving()"
          [apiError]="editError()"
          (save)="onSaveEdit($event)"
          (cancel)="closeEdit()" />
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
    .nav-btn--datepick { position:relative; overflow:hidden; }
    .nav-btn--collegues.nav-btn--active { background:#eef2ff; border-color:#6366f1; color:#6366f1; }
    .date-jump-input {
      position:absolute; inset:0; width:100%; height:100%;
      opacity:0; cursor:pointer; border:none; padding:0; margin:0;
    }
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
    .leg-item em { font-style:normal; color:#94a3b8; }
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

    .loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:60px; color:#94a3b8; flex:1; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    /* ── Corps (sidebar + grille) ── */
    .ag-body { flex:1; display:flex; min-height:0; overflow:hidden; }

    /* ── Sidebar collègues (façon Outlook) ── */
    .ag-sidebar {
      width:220px; flex-shrink:0; background:#fff; border-right:1px solid #e2e8f0;
      display:flex; flex-direction:column; overflow-y:auto; padding:12px 0;
    }
    .sidebar-hd {
      display:flex; align-items:center; justify-content:space-between;
      padding:0 14px 10px; font-size:12px; font-weight:700; color:#0f172a;
      text-transform:uppercase; letter-spacing:.04em;
    }
    .sidebar-close { background:none; border:none; cursor:pointer; color:#94a3b8; display:flex; }
    .sidebar-close mat-icon { font-size:16px; width:16px; height:16px; }
    .sidebar-section {
      font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em;
      color:#94a3b8; padding:10px 14px 4px;
    }
    .sidebar-item {
      display:flex; align-items:center; gap:9px; padding:6px 14px; cursor:pointer;
      font-size:13px; color:#374151;
    }
    .sidebar-item:hover { background:#f8fafc; }
    .sidebar-item--me { cursor:default; }
    .sidebar-item--me:hover { background:none; }
    .sidebar-item input[type="checkbox"] { accent-color:#6366f1; cursor:pointer; flex-shrink:0; }
    .sidebar-item--me input[type="checkbox"] { cursor:default; }
    .sidebar-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
    .sidebar-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .sidebar-item-spin { font-size:13px !important; width:13px !important; height:13px !important; color:#94a3b8; }
    .sidebar-loading, .sidebar-empty {
      display:flex; align-items:center; gap:6px; padding:6px 14px; font-size:12px; color:#94a3b8;
    }
    .sidebar-loading mat-icon { font-size:14px; width:14px; height:14px; }
    .sidebar-hint {
      margin:10px 14px 0; padding:8px 10px; background:#f8fafc; border-radius:8px;
      font-size:11px; line-height:1.4; color:#94a3b8;
    }

    /* ── Grille ── */
    .cal-wrap { flex:1; overflow:auto; }
    .cal-grid  { display:flex; min-width:600px; }

    /* Colonne heures */
    .col-time { flex:0 0 52px; display:flex; flex-direction:column; position:sticky; left:0; z-index:21; background:#fff; }
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
    .cal-col { display:flex; flex-direction:column; flex:1; border-right:1px solid #f1f5f9; min-width:130px; }
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
      position:absolute; border-radius:7px; padding:4px 7px;
      font-size:10.5px; color:#fff; overflow:hidden; cursor:pointer; z-index:2;
      box-shadow:0 2px 8px rgba(0,0,0,.18); transition:filter .12s;
      box-sizing:border-box;
    }
    .ev-block:hover { filter:brightness(1.08); z-index:4; }
    .ev-colleague { cursor:default; }
    .ev-facturable     { background:linear-gradient(135deg,#22c55e,#16a34a); }
    .ev-non-facturable { background:linear-gradient(135deg,#f87171,#dc2626); }
    .ev-autre          { background:linear-gradient(135deg,#60a5fa,#2563eb); }
    .ev-time   { font-size:9px; opacity:.85; font-weight:600; letter-spacing:.02em; }
    .ev-lbl    { font-weight:700; line-height:1.2; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    .ev-client { font-size:9.5px; opacity:.8; margin-top:2px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .ev-dur    { font-size:9px; opacity:.75; margin-top:2px; }
    .ev-sub    { font-size:9px; opacity:.85; margin-top:1px; font-style:italic; }

    /* Mini-form overlay */
    .new-form-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:1000;
      display:flex; align-items:center; justify-content:center;
    }
    .new-form {
      background:#fff; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.25);
      width:660px; max-width:92vw; max-height:90vh; overflow-y:auto;
    }
    .new-form app-saisie-edit-form ::ng-deep .sef-panel { margin:0; border:none; box-shadow:none; }
  `],
})
export class TravailAgendaComponent implements OnInit, OnDestroy {
  private saisiesSvc = inject(SaisieTempsService);
  private clientsSvc = inject(ClientsService);
  private usersSvc   = inject(UsersService);
  private auth       = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private _d$ = new Subject<void>();

  weekOffset = signal(0);
  dayOffset  = signal(0);
  loading    = signal(true);
  viewMode   = signal<'semaine' | 'jour'>('semaine');
  saisies    = signal<SaisieTemps[]>([]);
  clients: Client[] = [];

  // Collègues (façon "calendriers des contacts" Outlook)
  sidebarOpen           = signal(false);
  colleagues            = signal<User[]>([]);
  colleaguesLoading     = signal(true);
  selectedColleagueIds  = signal<Set<number>>(new Set());
  colleagueSaisies      = signal<Record<number, Partial<SaisieTemps>[]>>({});
  colleagueLoadingMap   = signal<Record<number, boolean>>({});
  private readonly COLLEAGUE_COLORS = ['#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#8b5cf6', '#f43f5e', '#84cc16'];

  // Sélection
  selection  = signal<Selection | null>(null);
  private isSelecting = false;

  // Formulaire de saisie (créneau sélectionné ou "Nouveau temps")
  editing   = signal(false);
  editSeed  = signal<SaisieEditSeed | null>(null);
  saving    = signal(false);
  editError = signal('');

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

  myLabel = computed(() => {
    const u = this.auth.currentUser();
    return u ? `${u.firstName} ${u.lastName}` : 'Moi';
  });

  /** Collègues actuellement cochés dans la sidebar — utilisé pour la légende et le rendu. */
  selectedColleaguesList = computed<User[]>(() => {
    const selected = this.selectedColleagueIds();
    if (selected.size === 0) return [];
    return this.colleagues().filter(c => selected.has(c.id));
  });

  /** Date affichée dans le sélecteur du bouton calendrier : le jour visible en vue "jour",
   *  le lundi de la semaine visible en vue "semaine". */
  jumpDateValue = computed(() => {
    return this.viewMode() === 'jour' ? this.visibleDays()[0]?.date : this.weekDays()[0]?.date;
  });

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
    interval(60000).pipe(takeUntil(this._d$)).subscribe(() => {
      this.updateNowLine();
      // Rafraîchit aussi les collègues affichés — au cas où une saisie vient d'être
      // ajoutée pour l'un d'eux pendant que leur calendrier est déjà coché.
      for (const id of this.selectedColleagueIds()) this.loadColleague(id);
    });
    this.clientsSvc.getAll().pipe(takeUntil(this._d$)).subscribe(c => this.clients = c);

    this.colleaguesLoading.set(true);
    const myId = this.auth.currentUser()?.id;
    this.usersSvc.getAll().pipe(takeUntil(this._d$)).subscribe({
      next: users => {
        this.colleagues.set(users.filter(u => u.id !== myId && u.isActive));
        this.colleaguesLoading.set(false);
      },
      error: () => this.colleaguesLoading.set(false),
    });
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
    // Recharge aussi les collègues actuellement affichés, pour la nouvelle période visible.
    for (const id of this.selectedColleagueIds()) this.loadColleague(id);
  }

  isSelected(id: number): boolean { return this.selectedColleagueIds().has(id); }

  colorFor(id: number): string {
    const idx = this.colleagues().findIndex(c => c.id === id);
    return this.COLLEAGUE_COLORS[idx % this.COLLEAGUE_COLORS.length] ?? '#94a3b8';
  }

  toggleColleague(c: User) {
    const sel = new Set(this.selectedColleagueIds());
    if (sel.has(c.id)) {
      sel.delete(c.id);
      this.colleagueSaisies.update(m => { const n = { ...m }; delete n[c.id]; return n; });
    } else {
      sel.add(c.id);
      this.loadColleague(c.id);
    }
    this.selectedColleagueIds.set(sel);
  }

  private loadColleague(id: number) {
    const days = this.weekDays();
    this.colleagueLoadingMap.update(m => ({ ...m, [id]: true }));
    this.saisiesSvc.getTenant({ dateDebut: days[0].date, dateFin: days[6].date, collaborateurId: id })
      .pipe(takeUntil(this._d$))
      .subscribe({
        next: s => {
          this.colleagueSaisies.update(m => ({ ...m, [id]: s }));
          this.colleagueLoadingMap.update(m => ({ ...m, [id]: false }));
        },
        error: () => this.colleagueLoadingMap.update(m => ({ ...m, [id]: false })),
      });
  }

  /** Toutes les saisies visibles ce jour-là : les miennes + celles des collègues cochés,
   *  chacune taguée avec son "propriétaire" ('me' ou l'id du collègue). */
  private allEventsForDay(date: string): { saisie: Partial<SaisieTemps>; owner: 'me' | number }[] {
    const mine = this.saisies()
      .filter(s => s.date === date || s.date?.startsWith(date))
      .map(s => ({ saisie: s as Partial<SaisieTemps>, owner: 'me' as const }));
    const dataMap = this.colleagueSaisies();
    const colleagueEvents: { saisie: Partial<SaisieTemps>; owner: number }[] = [];
    for (const id of this.selectedColleagueIds()) {
      for (const s of dataMap[id] ?? []) {
        if (s.date === date || s.date?.startsWith(date)) colleagueEvents.push({ saisie: s, owner: id });
      }
    }
    return [...mine, ...colleagueEvents];
  }

  allDayForDay(date: string): CalEvent[] {
    return this.allEventsForDay(date)
      .filter(e => !e.saisie.heureDebut)
      .map(e => this.toEv(e.saisie, true, e.owner));
  }

  positionedForDay(date: string): CalEvent[] {
    const timed = this.allEventsForDay(date)
      .filter(e => !!e.saisie.heureDebut)
      .map(e => this.toEv(e.saisie, false, e.owner));
    return this.layoutEvents(timed);
  }

  /** Positionne côte à côte (largeur/décalage) les événements qui se chevauchent dans le
   *  temps — algorithme classique par "clusters" (façon Google Calendar/Outlook), pour que
   *  mes créneaux et ceux de plusieurs collègues affichés en même temps restent lisibles
   *  au lieu de se superposer intégralement. */
  private layoutEvents(events: CalEvent[]): CalEvent[] {
    if (events.length <= 1) return events;
    const withRange = events
      .map(e => ({ e, start: e.topPx, end: e.topPx + e.heightPx }))
      .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    const result: CalEvent[] = [];
    let cluster: typeof withRange = [];
    let clusterEnd = -Infinity;

    const flush = () => {
      if (!cluster.length) return;
      const colEnds: number[] = [];
      const placed: { item: typeof withRange[number]; col: number }[] = [];
      for (const item of cluster) {
        let col = colEnds.findIndex(end => end <= item.start);
        if (col === -1) { colEnds.push(item.end); col = colEnds.length - 1; }
        else { colEnds[col] = item.end; }
        placed.push({ item, col });
      }
      const totalCols = colEnds.length;
      for (const { item, col } of placed) {
        result.push({ ...item.e, leftPct: (col / totalCols) * 100, widthPct: (1 / totalCols) * 100 });
      }
      cluster = [];
    };

    for (const item of withRange) {
      if (!cluster.length || item.start < clusterEnd) {
        cluster.push(item);
        clusterEnd = Math.max(clusterEnd, item.end);
      } else {
        flush();
        cluster = [item];
        clusterEnd = item.end;
      }
    }
    flush();
    return result;
  }

  private toEv(s: Partial<SaisieTemps>, allDay: boolean, owner: 'me' | number): CalEvent {
    let topPx = 0;
    const dureeHeures = s.dureeHeures ?? 0;
    const heightPx = Math.max(SLOT_H * 0.6, dureeHeures * 2 * SLOT_H);
    if (!allDay && s.heureDebut) {
      const [h, m] = s.heureDebut.split(':').map(Number);
      const startMin = h * 60 + (m ?? 0);
      topPx = Math.max(0, ((startMin - CAL_START * 60) / 30) * SLOT_H);
    }
    const label = s.missionCode
      ? `[${s.missionCode}] ${s.commentaire ?? ''}`
      : s.commentaire ?? s.type ?? '—';
    // Vue collègue : détail complet de la tâche, avec son nom en plus pour différencier
    // les collègues affichés en même temps (couleur dédiée par personne).
    if (owner !== 'me') {
      const colleague = this.colleagues().find(c => c.id === owner);
      const name = colleague ? `${colleague.firstName} ${colleague.lastName}` : 'Collègue';
      return {
        saisie: s, topPx, heightPx, allDay, readonly: true,
        colorClass: 'ev-colleague', colorStyle: this.colorFor(owner),
        label, subLabel: name,
        leftPct: 0, widthPct: 100,
      };
    }
    const colorClass = s.type === 'FACTURABLE'
      ? 'ev-facturable'
      : s.type === 'NON_FACTURABLE' ? 'ev-non-facturable' : 'ev-autre';
    return { saisie: s, topPx, heightPx, allDay, readonly: false, colorClass, colorStyle: null, label, subLabel: null, leftPct: 0, widthPct: 100 };
  }

  tooltipFor(ev: CalEvent): string {
    const base = ev.label + (ev.saisie.client ? ' · ' + ev.saisie.client!.nom : '');
    return ev.readonly ? `${ev.subLabel} — ${base}` : base;
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
    const heureDebut = this.slotToTime(start);
    const heureFin   = this.slotToTime(end + 1);
    const dureeHeures = (end - start + 1) * 0.5;
    this.cancelSelect();
    this.openForm(s.day, dureeHeures, heureDebut, heureFin);
  }

  /** Ouvre le formulaire de saisie — soit pré-rempli depuis une sélection de créneau
   *  (confirmSelection), soit vierge sur le jour courant (bouton "Nouveau temps"). */
  private openForm(date: string, dureeHeures = 0, heureDebut: string | null = null, heureFin: string | null = null) {
    this.editError.set('');
    this.editSeed.set({
      date, dureeHeures, heureDebut, heureFin,
      clientId: null, missionCode: null, type: 'FACTURABLE', categorie: null, commentaire: null,
    });
    this.editing.set(true);
  }

  closeEdit() {
    this.editing.set(false);
    this.editSeed.set(null);
    this.editError.set('');
  }

  onSaveEdit(result: SaisieEditResult) {
    this.saving.set(true);
    this.editError.set('');
    this.saisiesSvc.create(result).pipe(takeUntil(this._d$)).subscribe({
      next: () => { this.saving.set(false); this.closeEdit(); this.loadData(); },
      error: () => { this.saving.set(false); this.editError.set('Erreur lors de l\'enregistrement — réessayez.'); },
    });
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

  /** Bascule directement sur une date choisie via le sélecteur calendrier (plutôt que de
   *  cliquer semaine par semaine avec les chevrons) — recalcule weekOffset/dayOffset par
   *  rapport à aujourd'hui, en cohérence avec les deux vues (semaine et jour). */
  irALaDate(dateStr: string) {
    if (!dateStr) return;
    const cible = new Date(`${dateStr}T00:00:00`);
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    const lundiDe = (d: Date) => {
      const m = new Date(d);
      m.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
      m.setHours(0, 0, 0, 0);
      return m;
    };
    const MS_JOUR = 24 * 60 * 60 * 1000;
    const diffSemaines = Math.round((lundiDe(cible).getTime() - lundiDe(aujourdhui).getTime()) / (7 * MS_JOUR));
    const diffJours = Math.round((cible.getTime() - aujourdhui.getTime()) / MS_JOUR);

    this.weekOffset.set(diffSemaines);
    this.dayOffset.set(diffJours);
    this.loadData();
  }

  onNewTemps() {
    const jour = this.viewMode() === 'jour' ? this.visibleDays()[0]?.date : this.weekDays().find(d => d.isToday)?.date;
    this.openForm(jour ?? new Date().toISOString().split('T')[0]);
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }
}
