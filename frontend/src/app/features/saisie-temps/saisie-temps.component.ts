import {
  Component, OnInit, signal, computed, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  SaisieTempsService, SaisieTemps, TypeTemps, CategorieNonFacturable,
  CreateSaisieTempsDto, BudgetMission, MISSION_CODES, MissionCode
} from '../../core/services/saisie-temps.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { Subject } from 'rxjs';

/* ═══════════════════════════════════════════════════════════════════════════
   DIALOG — Nouvelle / Modifier saisie
   ═══════════════════════════════════════════════════════════════════════════ */
@Component({
  selector: 'app-saisie-temps-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatAutocompleteModule,
  ],
  template: `
    <div class="std-wrap">
      <div class="std-header">
        <div class="std-title-wrap">
          <mat-icon class="std-title-icon">{{ data.existing ? 'edit' : 'add_circle' }}</mat-icon>
          <span class="std-title">{{ data.existing ? 'Modifier la saisie' : 'Nouvelle saisie' }}</span>
          @if (data.prefilledHeures) {
            <span class="std-timer-badge">⏱ {{ formatTemps(data.prefilledHeures) }}</span>
          }
        </div>
        <button class="std-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>

      <div class="std-body">

        <!-- Section Date & Horaires -->
        <div class="std-section">
          <div class="std-section-title">Date & horaires</div>
          <div class="std-row">
            <label class="std-lbl">Date</label>
            <input class="std-input" type="date" [(ngModel)]="dateVal" />
          </div>
          <div class="std-row">
            <label class="std-lbl">Horaires</label>
            <div class="std-time-wrap">
              <input class="std-input std-time-input" type="time" [(ngModel)]="heureDebut"
                     placeholder="08:00" (change)="autoComputeTemps()" />
              <span class="std-time-arrow">→</span>
              <input class="std-input std-time-input" type="time" [(ngModel)]="heureFin"
                     placeholder="10:00" (change)="autoComputeTemps()" />
              <span class="std-time-hint">optionnel</span>
            </div>
          </div>
        </div>

        <!-- Section Dossier & Mission -->
        <div class="std-section">
          <div class="std-section-title">Dossier & mission</div>

          <!-- Type -->
          <div class="std-row std-type-row">
            <label class="std-lbl">Type</label>
            <div class="std-type-btns">
              <button type="button" class="std-type-btn" [class.active-fact]="type() === 'FACTURABLE'" (click)="type.set('FACTURABLE')">
                <mat-icon>euro</mat-icon> Facturable
              </button>
              <button type="button" class="std-type-btn" [class.active-nf]="type() === 'NON_FACTURABLE'" (click)="type.set('NON_FACTURABLE')">
                <mat-icon>category</mat-icon> Non facturable
              </button>
            </div>
          </div>

          <!-- Client autocomplete -->
          <div class="std-row">
            <label class="std-lbl">Dossier</label>
            <div class="std-autocomplete-wrap">
              <input class="std-input" type="text" [(ngModel)]="clientSearch"
                     (ngModelChange)="onClientSearch($event)"
                     [placeholder]="selectedClient ? selectedClient.nom : 'Rechercher un client...'"
                     autocomplete="off" />
              @if (clientSuggestions.length > 0) {
                <div class="std-dropdown">
                  @for (c of clientSuggestions; track c.id) {
                    <button class="std-dropdown-item" (click)="selectClient(c)">{{ c.nom }}</button>
                  }
                </div>
              }
              @if (selectedClient) {
                <button class="std-clear-btn" (click)="clearClient()"><mat-icon>close</mat-icon></button>
              }
            </div>
          </div>

          <!-- Code mission (FACTURABLE) -->
          @if (type() === 'FACTURABLE') {
            <div class="std-row">
              <label class="std-lbl">Mission</label>
              <div class="std-codes">
                @for (m of MISSIONS; track m.code) {
                  <button type="button" class="std-code-btn"
                          [class.active]="missionCode === m.code"
                          [style.border-color]="missionCode === m.code ? m.color : ''"
                          [style.background]="missionCode === m.code ? m.bg : ''"
                          (click)="missionCode = m.code">
                    <span class="std-code-tag" [style.color]="m.color" [style.background]="m.bg">{{ m.code }}</span>
                    <span class="std-code-name">{{ m.label }}</span>
                  </button>
                }
              </div>
            </div>
          }

          <!-- Catégorie NF -->
          @if (type() === 'NON_FACTURABLE') {
            <div class="std-row">
              <label class="std-lbl">Catégorie</label>
              <div class="std-codes">
                @for (c of CODES_NF; track c.code) {
                  <button type="button" class="std-code-btn" [class.active]="categorie === c.backend"
                          (click)="categorie = c.backend">
                    <span class="std-code-tag">{{ c.code }}</span>
                    <span class="std-code-name">{{ c.label }}</span>
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <!-- Section Temps & Libellé -->
        <div class="std-section">
          <div class="std-section-title">Temps & description</div>
          <div class="std-row std-temps-row">
            <label class="std-lbl">Durée</label>
            <div class="std-temps-input-wrap">
              <button class="std-adj-btn" (click)="adjustTemps(-1)" [disabled]="tempsHeures() <= 0.25">
                <mat-icon>remove</mat-icon>
              </button>
              <input class="std-input std-temps-input" type="text" [ngModel]="tempsRaw()"
                     placeholder="1h30, 2.5, 90m…"
                     (ngModelChange)="tempsRaw.set($event)" />
              <button class="std-adj-btn" (click)="adjustTemps(1)">
                <mat-icon>add</mat-icon>
              </button>
            </div>
            @if (tempsHeures() > 0) {
              <span class="std-temps-preview">= {{ formatTemps(tempsHeures()) }}</span>
            }
          </div>
          <div class="std-row">
            <label class="std-lbl">Libellé</label>
            <textarea class="std-textarea" [(ngModel)]="libelle" rows="2" placeholder="Description de l'activité..."></textarea>
          </div>
        </div>

      </div>

      <div class="std-footer">
        <button class="std-btn-cancel" (click)="cancel()">Annuler</button>
        @if (!data.existing) {
          <button class="std-btn-new" (click)="submitAndNew()" [disabled]="!isValid()">
            <mat-icon>add</mat-icon> Créer & nouveau
          </button>
        }
        <button class="std-btn-create" (click)="submit()" [disabled]="!isValid()">
          <mat-icon>{{ data.existing ? 'save' : 'add' }}</mat-icon>
          {{ data.existing ? 'Enregistrer' : 'Créer' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .std-wrap { display:flex; flex-direction:column; width:540px; max-height:90vh; overflow:hidden; }
    .std-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 20px; border-bottom:1px solid #f1f5f9; flex-shrink:0;
      background:linear-gradient(135deg,#f8faff,#ffffff);
    }
    .std-title-wrap { display:flex; align-items:center; gap:10px; }
    .std-title-icon { color:#6366f1; font-size:22px; width:22px; height:22px; }
    .std-title { font-size:16px; font-weight:700; color:#0f172a; }
    .std-timer-badge { background:#eef2ff; color:#6366f1; font-size:12px; font-weight:700; padding:2px 8px; border-radius:6px; }
    .std-close {
      background:none; border:none; cursor:pointer; padding:4px;
      display:flex; align-items:center; color:#94a3b8; border-radius:6px;
      &:hover { background:#f1f5f9; color:#475569; }
    }
    .std-body { display:flex; flex-direction:column; gap:0; padding:0 0 4px; overflow-y:auto; }
    .std-section { padding:16px 20px; border-bottom:1px solid #f8fafc; }
    .std-section:last-child { border-bottom:none; }
    .std-section-title {
      font-size:10px; font-weight:800; color:#6366f1; text-transform:uppercase;
      letter-spacing:.8px; margin-bottom:12px; padding-bottom:6px;
      border-bottom:2px solid #eef2ff;
    }
    .std-row { display:flex; align-items:flex-start; gap:12px; margin-bottom:10px; }
    .std-row:last-child { margin-bottom:0; }
    .std-lbl {
      font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;
      letter-spacing:.4px; min-width:68px; padding-top:9px; flex-shrink:0;
    }
    .std-input {
      flex:1; height:36px; border:1.5px solid #e2e8f0; border-radius:8px;
      padding:0 12px; font-size:13px; font-family:inherit; color:#1e293b;
      background:#f8fafc; transition:border-color .15s;
      &:focus { outline:none; border-color:#6366f1; background:white; }
    }
    .std-textarea {
      flex:1; border:1.5px solid #e2e8f0; border-radius:8px;
      padding:8px 12px; font-size:13px; font-family:inherit; color:#1e293b;
      background:#f8fafc; resize:vertical; line-height:1.5; transition:border-color .15s;
      &:focus { outline:none; border-color:#6366f1; background:white; }
      &::placeholder { color:#94a3b8; }
    }
    /* Time */
    .std-time-wrap { display:flex; align-items:center; gap:8px; flex:1; }
    .std-time-input { flex:unset; width:110px; text-align:center; }
    .std-time-arrow { color:#94a3b8; font-size:18px; flex-shrink:0; }
    .std-time-hint { font-size:11px; color:#cbd5e1; font-style:italic; }
    /* Autocomplete */
    .std-autocomplete-wrap { position:relative; flex:1; }
    .std-autocomplete-wrap .std-input { width:100%; box-sizing:border-box; }
    .std-dropdown {
      position:absolute; top:100%; left:0; right:0; z-index:999;
      background:white; border:1.5px solid #e2e8f0; border-radius:8px;
      box-shadow:0 4px 16px rgba(0,0,0,.1); max-height:200px; overflow-y:auto; margin-top:2px;
    }
    .std-dropdown-item {
      display:block; width:100%; text-align:left; padding:8px 14px;
      font-size:13px; color:#1e293b; background:none; border:none; cursor:pointer; font-family:inherit;
      &:hover { background:#f5f3ff; color:#6366f1; }
    }
    .std-clear-btn {
      position:absolute; right:8px; top:50%; transform:translateY(-50%);
      background:none; border:none; cursor:pointer; color:#94a3b8;
      display:flex; align-items:center; padding:2px;
      mat-icon { font-size:16px; width:16px; height:16px; }
      &:hover { color:#dc2626; }
    }
    /* Type */
    .std-type-row { align-items:center; }
    .std-type-btns { display:flex; gap:8px; flex:1; }
    .std-type-btn {
      flex:1; display:flex; align-items:center; justify-content:center; gap:6px;
      padding:8px 14px; border-radius:8px; border:1.5px solid #e2e8f0;
      background:#f8fafc; color:#64748b; cursor:pointer; font-size:13px;
      font-weight:600; font-family:inherit; transition:all .15s;
      &:hover { border-color:#c7d2fe; background:#f5f3ff; }
    }
    .std-type-btn.active-fact { border-color:#16a34a; background:#f0fdf4; color:#15803d; }
    .std-type-btn.active-nf  { border-color:#9333ea; background:#faf5ff; color:#7c3aed; }
    /* Codes */
    .std-codes { display:flex; flex-wrap:wrap; gap:5px; flex:1; }
    .std-code-btn {
      display:flex; align-items:center; gap:5px; padding:4px 9px;
      border:1.5px solid #e2e8f0; border-radius:7px; background:#f8fafc;
      cursor:pointer; font-family:inherit; transition:all .15s;
      &:hover { border-color:#c7d2fe; }
      &.active { border-color:#7c3aed; background:#faf5ff; }
    }
    .std-code-tag { font-size:10px; font-weight:800; color:#7c3aed; background:#ede9fe; padding:1px 5px; border-radius:4px; }
    .std-code-name { font-size:11px; color:#374151; }
    /* Temps */
    .std-temps-row { align-items:center; }
    .std-temps-input-wrap { display:flex; align-items:center; gap:4px; }
    .std-temps-input { max-width:110px; text-align:center; }
    .std-adj-btn {
      width:32px; height:32px; border-radius:50%; border:1.5px solid #e2e8f0;
      background:#f8fafc; cursor:pointer; display:flex; align-items:center; justify-content:center;
      color:#475569; transition:all .15s; flex-shrink:0;
      &:hover:not([disabled]) { border-color:#6366f1; color:#6366f1; }
      &[disabled] { opacity:.4; cursor:not-allowed; }
    }
    .std-temps-preview { font-size:12px; color:#6366f1; font-weight:600; margin-left:8px; }
    /* Footer */
    .std-footer {
      display:flex; justify-content:flex-end; gap:8px;
      padding:14px 20px; border-top:1px solid #f1f5f9; flex-shrink:0; background:#fafbff;
    }
    .std-btn-cancel {
      padding:8px 18px; border-radius:8px; border:1.5px solid #e2e8f0;
      background:white; color:#475569; cursor:pointer; font-size:13px;
      font-weight:600; font-family:inherit; transition:all .15s;
      &:hover { border-color:#94a3b8; }
    }
    .std-btn-new {
      display:flex; align-items:center; gap:6px;
      padding:8px 16px; border-radius:8px; border:1.5px solid #6366f1;
      background:white; color:#6366f1; cursor:pointer; font-size:13px;
      font-weight:700; font-family:inherit; transition:all .15s;
      &:hover:not([disabled]) { background:#eef2ff; }
      &[disabled] { opacity:.5; cursor:not-allowed; }
    }
    .std-btn-create {
      display:flex; align-items:center; gap:6px;
      padding:8px 18px; border-radius:8px; border:none;
      background:#16a34a; color:white; cursor:pointer; font-size:13px;
      font-weight:700; font-family:inherit; transition:background .15s;
      &:hover:not([disabled]) { background:#15803d; }
      &[disabled] { opacity:.5; cursor:not-allowed; }
    }
  `],
})
export class SaisieTempsDialogComponent {
  fb = inject(FormBuilder);
  dialogRef = inject(MatDialogRef<SaisieTempsDialogComponent>);
  data: {
    date: string;
    prefilledHeures?: number;
    prefilledClientId?: number;
    prefilledComment?: string;
    heureDebut?: string;
    heureFin?: string;
    existing?: SaisieTemps;
  } = inject(MAT_DIALOG_DATA);
  private http = inject(HttpClient);

  type        = signal<TypeTemps>('NON_FACTURABLE');
  tempsRaw    = signal<string>('');
  libelle     = '';
  categorie: CategorieNonFacturable = 'APPEL_CLIENT';
  missionCode: MissionCode | '' = '';
  dateVal     = this.data.date;
  heureDebut  = '';
  heureFin    = '';

  clientSearch       = '';
  selectedClient:    { id: number; nom: string } | null = null;
  clientSuggestions: { id: number; nom: string }[] = [];
  private _searchTimeout: any;

  readonly MISSIONS = MISSION_CODES;
  readonly CODES_NF = [
    { code: 'APPEL',  label: 'Appel client',    backend: 'APPEL_CLIENT'    as CategorieNonFacturable },
    { code: 'REUN',   label: 'Réunion interne', backend: 'REUNION_INTERNE'  as CategorieNonFacturable },
    { code: 'FORM',   label: 'Formation',        backend: 'FORMATION'        as CategorieNonFacturable },
    { code: 'ADMIN',  label: 'Administratif',    backend: 'ADMINISTRATIF'    as CategorieNonFacturable },
    { code: 'AUTRE',  label: 'Autre',            backend: 'AUTRE'            as CategorieNonFacturable },
  ];

  constructor() {
    // Prefill from timer
    if (this.data.prefilledHeures && this.data.prefilledHeures > 0) {
      const h = this.data.prefilledHeures;
      const hrs = Math.floor(h);
      const min = Math.round((h - hrs) * 60);
      this.tempsRaw.set(min > 0 ? `${hrs}h${String(min).padStart(2,'0')}` : `${hrs}h`);
    }
    // Prefill horaires
    if (this.data.heureDebut) this.heureDebut = this.data.heureDebut;
    if (this.data.heureFin) this.heureFin = this.data.heureFin;
    // Auto-compute temps from heureDebut/heureFin
    if (this.data.heureDebut && this.data.heureFin) this.autoComputeTemps();

    // Prefill from task context (timer démarré depuis une tâche)
    if (this.data.prefilledComment) {
      this.libelle = this.data.prefilledComment;
    }
    if (this.data.prefilledClientId) {
      this.http.get<any>(`${environment.apiUrl}/clients/${this.data.prefilledClientId}`).subscribe({
        next: (c) => {
          this.selectedClient = { id: c.id, nom: c.nom };
          this.clientSearch = c.nom;
        },
      });
    }

    // Prefill from existing entry
    if (this.data.existing) {
      const e = this.data.existing;
      this.type.set(e.type);
      this.libelle = e.commentaire ?? '';
      if (e.categorie) this.categorie = e.categorie;
      if (e.missionCode) this.missionCode = e.missionCode as MissionCode;
      if (e.heureDebut) this.heureDebut = e.heureDebut;
      if (e.heureFin) this.heureFin = e.heureFin;
      const h = e.dureeHeures;
      const hrs = Math.floor(h);
      const min = Math.round((h - hrs) * 60);
      this.tempsRaw.set(min > 0 ? `${hrs}h${String(min).padStart(2,'0')}` : `${hrs}h`);
      if (e.client) {
        this.selectedClient = { id: e.clientId!, nom: e.client.nom };
        this.clientSearch = e.client.nom;
      }
    }
  }

  tempsHeures = computed(() => this.parseTemps(this.tempsRaw()));

  autoComputeTemps() {
    if (!this.heureDebut || !this.heureFin) return;
    const [sh, sm] = this.heureDebut.split(':').map(Number);
    const [eh, em] = this.heureFin.split(':').map(Number);
    const diff = (eh + em / 60) - (sh + sm / 60);
    if (diff > 0 && this.tempsRaw() === '') {
      const hrs = Math.floor(diff);
      const min = Math.round((diff - hrs) * 60);
      this.tempsRaw.set(min > 0 ? `${hrs}h${String(min).padStart(2,'0')}` : `${hrs}h`);
    }
  }

  onClientSearch(q: string) {
    clearTimeout(this._searchTimeout);
    this.selectedClient = null;
    if (!q || q.length < 2) { this.clientSuggestions = []; return; }
    this._searchTimeout = setTimeout(() => {
      this.http.get<any[]>(`${environment.apiUrl}/clients`, { params: { search: q } }).subscribe({
        next: (res) => { this.clientSuggestions = res.slice(0, 8).map(c => ({ id: c.id, nom: c.nom })); },
        error: () => { this.clientSuggestions = []; },
      });
    }, 250);
  }

  selectClient(c: { id: number; nom: string }) {
    this.selectedClient = c;
    this.clientSearch = c.nom;
    this.clientSuggestions = [];
  }

  clearClient() {
    this.selectedClient = null;
    this.clientSearch = '';
    this.clientSuggestions = [];
  }

  parseTemps(input: string): number {
    if (!input?.trim()) return 0;
    const s = input.trim();
    const hm = s.match(/^(\d+)h(\d{1,2})['"]?$/i);
    if (hm) return parseInt(hm[1]) + parseInt(hm[2]) / 60;
    const h = s.match(/^(\d+(?:[.,]\d+)?)h$/i);
    if (h) return parseFloat(h[1].replace(',', '.'));
    const m = s.match(/^(\d+)[m'"]$/i);
    if (m) return parseInt(m[1]) / 60;
    const j = s.match(/^(\d+(?:[.,]\d+)?)j$/i);
    if (j) return parseFloat(j[1].replace(',', '.')) * 8;
    const n = s.match(/^(\d+(?:[.,]\d+)?)$/);
    if (n) return parseFloat(n[1].replace(',', '.'));
    return 0;
  }

  formatTemps(h: number): string {
    if (h <= 0) return '';
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    if (hrs === 0) return `${min} min`;
    return min > 0 ? `${hrs}h ${min}min` : `${hrs}h`;
  }

  adjustTemps(delta: number) {
    const current = this.tempsHeures();
    const newVal = Math.max(0.25, current + delta * 0.25);
    const hrs = Math.floor(newVal);
    const min = Math.round((newVal - hrs) * 60);
    this.tempsRaw.set(min > 0 ? `${hrs}h${min < 10 ? '0' + min : min}` : `${hrs}h`);
  }

  isValid(): boolean {
    return !!this.dateVal && this.tempsHeures() > 0;
  }

  private _buildDto(): CreateSaisieTempsDto {
    const dto: CreateSaisieTempsDto = {
      date: this.dateVal,
      dureeHeures: this.tempsHeures(),
      type: this.type(),
      commentaire: this.libelle || undefined,
      clientId: this.selectedClient?.id,
      heureDebut: this.heureDebut || undefined,
      heureFin: this.heureFin || undefined,
    };
    if (this.type() === 'NON_FACTURABLE') {
      dto.categorie = this.categorie;
    } else if (this.missionCode) {
      dto.missionCode = this.missionCode;
      dto.dossierId   = this.selectedClient?.id;
    }
    return dto;
  }

  submit() {
    if (!this.isValid()) return;
    this.dialogRef.close({ dto: this._buildDto(), andNew: false });
  }

  submitAndNew() {
    if (!this.isValid()) return;
    this.dialogRef.close({ dto: this._buildDto(), andNew: true });
  }

  cancel() { this.dialogRef.close(); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
type FilterType = 'ALL' | 'FACTURABLE' | 'NON_FACTURABLE';
type ViewMode   = 'week' | 'agenda' | 'detail';

interface DayGroup {
  date: string;
  label: string;
  entries: SaisieTemps[];
  total: number;
}

interface CalendarDay {
  date: string;
  weekdayShort: string;
  dayMonth: string;
  isToday: boolean;
  isWeekend: boolean;
}

interface TimedBlock extends SaisieTemps {
  blockStyle: string;
  durationLabel: string;
}

const LS_DISMISSED = 'st_dismissed_alerts';

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
@Component({
  selector: 'app-saisie-temps',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule,
    MatSnackBarModule,
  ],
  template: `
<div class="st-page">

  <!-- ─── ALERTES ─── -->
  @for (alert of visibleAlerts(); track alert.id) {
    <div class="st-alert-bar" [class.st-alert-bar--warning]="alert.level==='warning'" [class.st-alert-bar--danger]="alert.level==='danger'">
      <mat-icon class="st-alert-icon">{{ alert.level==='danger' ? 'warning' : 'info' }}</mat-icon>
      <span class="st-alert-text">{{ alert.message }}</span>
      <button class="st-alert-dismiss" (click)="dismissAlert(alert.id)"><mat-icon>close</mat-icon></button>
    </div>
  }

  <!-- ─── BUDGET BAR ─── -->
  @if (budgetBar()) {
    <div class="st-budget-bar" [class.st-budget-bar--ok]="budgetBar()!.pct<80"
         [class.st-budget-bar--warn]="budgetBar()!.pct>=80 && budgetBar()!.pct<100"
         [class.st-budget-bar--over]="budgetBar()!.pct>=100">
      <div class="st-budget-bar__info">
        <mat-icon>pie_chart</mat-icon>
        <span>Budget {{ budgetBar()!.clientNom }} — {{ budgetBar()!.missionCode }} :
          <strong>{{ budgetBar()!.heuresUtilisees | number:'1.1-1' }}h / {{ budgetBar()!.heuresBudget }}h</strong>
          ({{ budgetBar()!.pct | number:'1.0-0' }}%)
        </span>
      </div>
      <div class="st-budget-progress">
        <div class="st-budget-progress__fill" [style.width.%]="budgetBar()!.pct>100 ? 100 : budgetBar()!.pct"></div>
      </div>
    </div>
  }

  <div class="st-detail-view">

      <!-- Barre d'actions -->
      <div class="st-detail-actions">
        @if (isAdminOrExpert()) {
          <button class="st-detail-btn st-detail-btn--validate" (click)="validerSemaine()" matTooltip="Verrouiller les saisies de la semaine courante">
            <mat-icon>lock</mat-icon> Valider la semaine
          </button>
        }
        <button class="st-detail-btn" (click)="exportCSV()">
          <mat-icon>download</mat-icon> Excel
        </button>
        <button class="st-detail-btn" (click)="printDetail()">
          <mat-icon>print</mat-icon> Imprimer
        </button>
        <button class="st-detail-btn" (click)="loadData()">
          <mat-icon>refresh</mat-icon> Recharger
        </button>
        <div class="st-detail-search-wrap">
          <mat-icon class="st-detail-search-icon">search</mat-icon>
          <input class="st-detail-search-input" type="text" placeholder="Rechercher libellé, client…"
                 [value]="detailSearch()"
                 (input)="onDetailSearch($event)" />
          @if (detailSearch()) {
            <button class="st-detail-search-clear" (click)="detailSearch.set(''); detailPage.set(0)">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>
        <span class="st-detail-count">{{ detailFiltered().length }} résultat(s)</span>
        <button class="st-detail-btn" [class.active]="showFilters()" (click)="showFilters.update(v => !v)">
          <mat-icon>tune</mat-icon> Filtres
        </button>
      </div>

      <!-- Filtres avancés -->
      @if (showFilters()) {
        <div class="st-detail-filters">
          <div class="st-detail-filter-row">
            <label class="st-filter-lbl">Du</label>
            <input class="st-filter-input" type="date" [value]="detailFilterDateDebut()"
                   (change)="onDetailFilter('dateDebut', $event)" />
            <label class="st-filter-lbl">Au</label>
            <input class="st-filter-input" type="date" [value]="detailFilterDateFin()"
                   (change)="onDetailFilter('dateFin', $event)" />
            <label class="st-filter-lbl">Type</label>
            <select class="st-filter-select" [value]="detailFilterType()"
                    (change)="onDetailFilter('type', $event)">
              <option value="ALL">Tous</option>
              <option value="FACTURABLE">Facturable</option>
              <option value="NON_FACTURABLE">Non facturable</option>
            </select>
            <label class="st-filter-lbl">Mission</label>
            <select class="st-filter-select" [value]="detailFilterMission()"
                    (change)="onDetailFilter('mission', $event)">
              <option value="">Toutes</option>
              @for (m of MISSIONS_LIST; track m.code) {
                <option [value]="m.code">{{ m.code }} — {{ m.label }}</option>
              }
            </select>
          </div>
          <div class="st-detail-filter-btns">
            <button class="st-detail-btn" (click)="resetFilters()">
              <mat-icon>clear</mat-icon> Réinitialiser
            </button>
          </div>
        </div>
      }

      <!-- Tableau -->
      <div class="st-detail-table-wrap" id="st-print-area">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }
        <table class="st-detail-table">
          <thead>
            <tr>
              <th class="st-dth-cb">
                <input type="checkbox" (change)="toggleSelectAll($event)" />
              </th>
              <th class="st-dth-act">Actions</th>
              <th class="st-dth-date">Date</th>
              <th>Client / Dossier</th>
              <th class="st-dth-mission">Mission</th>
              <th>Libellé</th>
              <th class="st-dth-time">Horaires</th>
              <th class="st-dth-dur">Durée</th>
              <th class="st-dth-type">Type</th>
              <th class="st-dth-status">Statut</th>
            </tr>
          </thead>
          <tbody>
            @for (s of detailPaginated(); track s.id) {
              <tr [class.st-drow--selected]="selectedRows().has(s.id)"
                  [class.st-drow--locked]="s.isLocked">
                <td class="st-dth-cb">
                  <input type="checkbox" [checked]="selectedRows().has(s.id)"
                         (change)="toggleRow(s.id, $event)" />
                </td>
                <td class="st-dth-act">
                  <div class="st-d-act-wrap">
                    <button class="st-d-icon-btn" (click)="editSaisie(s)" matTooltip="Modifier">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button class="st-d-icon-btn st-d-icon-btn--danger" [disabled]="s.isLocked"
                            (click)="deleteSaisie(s.id)" matTooltip="Supprimer">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
                <td class="st-dth-date st-d-date">{{ s.date | date:'dd/MM/yy' }}</td>
                <td class="st-d-client">
                  @if (s.client?.nom) {
                    <span class="st-client-chip">{{ s.client!.nom }}</span>
                  } @else {
                    <span class="st-d-empty">—</span>
                  }
                </td>
                <td class="st-dth-mission">
                  @if (s.missionCode) {
                    <span class="st-badge st-badge--mission"
                          [style.color]="getMissionColor(s.missionCode)"
                          [style.background]="getMissionBg(s.missionCode)">{{ s.missionCode }}</span>
                  } @else if (s.categorie) {
                    <span class="st-badge st-badge--nf">{{ categCode(s.categorie) }}</span>
                  } @else {
                    <span class="st-d-empty">—</span>
                  }
                </td>
                <td class="st-d-label">{{ s.commentaire || '—' }}</td>
                <td class="st-dth-time st-d-time">
                  @if (s.heureDebut && s.heureFin) {
                    <span class="st-time-range">{{ s.heureDebut }}&nbsp;→&nbsp;{{ s.heureFin }}</span>
                  } @else {
                    <span class="st-d-empty">—</span>
                  }
                </td>
                <td class="st-dth-dur st-d-dur">{{ fmtH(s.dureeHeures) }}</td>
                <td class="st-dth-type">
                  @if (s.type === 'FACTURABLE') {
                    <span class="st-badge st-badge--fact">Fact.</span>
                  } @else {
                    <span class="st-badge st-badge--nf">NF</span>
                  }
                </td>
                <td class="st-dth-status">
                  @if (s.isLocked) {
                    <span class="st-badge st-badge--locked">
                      <mat-icon>lock</mat-icon> Validé
                    </span>
                  } @else {
                    <span class="st-badge st-badge--inprogress">En cours</span>
                  }
                </td>
              </tr>
            }
            @if (detailPaginated().length === 0 && !loading()) {
              <tr>
                <td colspan="10" class="st-d-empty-row">
                  <mat-icon>inbox</mat-icon>
                  <span>Aucun résultat</span>
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr class="st-d-totals">
              <td colspan="7" class="st-d-totals-label">
                Totaux — {{ detailFiltered().length }} entrée(s)
              </td>
              <td class="st-d-totals-dur">{{ fmtH(detailTotal()) }}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Pagination -->
      <div class="st-detail-pagination">
        <span class="st-page-info">
          @if (detailFiltered().length > 0) {
            Lignes {{ detailPage() * detailPageSize + 1 }}
            à {{ pageRangeEnd() }}
            — Total : {{ detailFiltered().length }} résultats
          } @else {
            Aucun résultat
          }
        </span>
        <div class="st-page-btns">
          <button class="st-page-btn" [disabled]="detailPage() === 0"
                  (click)="detailPage.update(p => p-1)">
            <mat-icon>chevron_left</mat-icon> Précédent
          </button>
          <span class="st-page-num">{{ detailPage() + 1 }} / {{ detailTotalPages() || 1 }}</span>
          <button class="st-page-btn" [disabled]="detailPage() >= detailTotalPages()-1"
                  (click)="detailPage.update(p => p+1)">
            Suivant <mat-icon>chevron_right</mat-icon>
          </button>
        </div>
      </div>

  </div>
</div>
  `,
  styles: [`
    .st-page { padding:20px; max-width:1100px; margin:0 auto; }

    /* ── Alertes ── */
    .st-alert-bar {
      display:flex; align-items:center; gap:10px;
      padding:10px 16px; border-radius:10px; margin-bottom:10px;
      font-size:13px; font-weight:500;
    }
    .st-alert-bar--warning { background:#fffbeb; border:1px solid #fcd34d; color:#92400e; }
    .st-alert-bar--danger  { background:#fef2f2; border:1px solid #fca5a5; color:#991b1b; }
    .st-alert-icon { font-size:18px; width:18px; height:18px; flex-shrink:0; }
    .st-alert-text { flex:1; }
    .st-alert-dismiss {
      background:none; border:none; cursor:pointer; padding:2px;
      display:flex; align-items:center; opacity:.6;
      mat-icon { font-size:16px; width:16px; height:16px; }
      &:hover { opacity:1; }
    }

    /* ── Budget bar ── */
    .st-budget-bar { display:flex; flex-direction:column; gap:6px; padding:10px 16px; border-radius:10px; margin-bottom:14px; border:1px solid #d1fae5; }
    .st-budget-bar--ok   { background:#f0fdf4; }
    .st-budget-bar--warn { background:#fffbeb; border-color:#fcd34d; }
    .st-budget-bar--over { background:#fef2f2; border-color:#fca5a5; }
    .st-budget-bar__info { display:flex; align-items:center; gap:8px; font-size:13px; color:#374151; }
    .st-budget-bar__info mat-icon { font-size:16px; width:16px; height:16px; color:#6366f1; }
    .st-budget-progress { height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden; }
    .st-budget-progress__fill { height:100%; background:#16a34a; border-radius:3px; transition:width .4s; }
    .st-budget-bar--warn .st-budget-progress__fill { background:#f59e0b; }
    .st-budget-bar--over .st-budget-progress__fill { background:#dc2626; }

    /* ════════════════════════════════════════════════════
       VUE DÉTAIL
       ════════════════════════════════════════════════════ */
    .st-detail-view { display:flex; flex-direction:column; gap:12px; }

    /* Action bar */
    .st-detail-actions {
      display:flex; align-items:center; gap:8px; flex-wrap:wrap;
      padding:12px 16px; background:white;
      border:1px solid #e2e8f0; border-radius:10px;
      box-shadow:0 1px 4px rgba(0,0,0,.05);
    }
    .st-detail-btn {
      display:flex; align-items:center; gap:5px;
      padding:6px 12px; border-radius:7px; border:1.5px solid #e2e8f0;
      background:white; color:#374151; cursor:pointer; font-size:12px;
      font-weight:600; font-family:inherit; transition:all .15s; flex-shrink:0;
      mat-icon { font-size:15px; width:15px; height:15px; }
      &:hover { border-color:#6366f1; color:#6366f1; }
      &.active { border-color:#6366f1; background:#eef2ff; color:#6366f1; }
    }
    .st-detail-btn--green {
      background:#16a34a; color:white; border-color:#16a34a;
      &:hover { background:#15803d; border-color:#15803d; color:white; }
    }
    .st-detail-btn--validate {
      background:#6366f1; color:white; border-color:#6366f1;
      &:hover { background:#4f46e5; border-color:#4f46e5; color:white; }
    }
    .st-detail-search-wrap {
      display:flex; align-items:center; gap:6px; flex:1; min-width:180px;
      padding:0 10px; border:1.5px solid #e2e8f0; border-radius:8px;
      background:#f8fafc; height:34px; transition:border-color .15s;
      &:focus-within { border-color:#6366f1; background:white; }
    }
    .st-detail-search-icon { font-size:16px; width:16px; height:16px; color:#94a3b8; flex-shrink:0; }
    .st-detail-search-input {
      flex:1; border:none; background:none; font-size:13px; color:#1e293b;
      font-family:inherit; outline:none;
      &::placeholder { color:#94a3b8; }
    }
    .st-detail-search-clear {
      background:none; border:none; cursor:pointer; color:#94a3b8; display:flex;
      mat-icon { font-size:14px; width:14px; height:14px; }
      &:hover { color:#374151; }
    }
    .st-detail-count { font-size:12px; font-weight:700; color:#64748b; white-space:nowrap; }

    /* Filtres avancés */
    .st-detail-filters {
      padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0;
      border-radius:10px; display:flex; flex-direction:column; gap:10px;
    }
    .st-detail-filter-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .st-filter-lbl { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; }
    .st-filter-input, .st-filter-select {
      height:32px; padding:0 10px; border:1.5px solid #e2e8f0; border-radius:7px;
      font-size:12px; font-family:inherit; color:#1e293b; background:white;
      &:focus { outline:none; border-color:#6366f1; }
    }
    .st-detail-filter-btns { display:flex; gap:8px; }

    /* Table */
    .st-detail-table-wrap { border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; overflow-x:auto; }
    .st-detail-table { width:100%; border-collapse:collapse; min-width:700px; }
    .st-detail-table thead tr { background:#f8fafc; }
    .st-detail-table th {
      padding:9px 10px; font-size:10px; font-weight:700; color:#94a3b8;
      text-transform:uppercase; letter-spacing:.4px; text-align:left;
      border-bottom:2px solid #e2e8f0; white-space:nowrap;
    }
    .st-detail-table td { padding:8px 10px; font-size:12px; color:#1e293b; border-bottom:1px solid #f8fafc; vertical-align:middle; }
    .st-detail-table tbody tr:last-child td { border-bottom:none; }
    .st-detail-table tbody tr:hover td { background:#fafafa; }
    .st-drow--selected td { background:#f0f4ff !important; }
    .st-drow--locked td { opacity:.6; }
    .st-dth-cb    { width:32px; text-align:center; }
    .st-dth-act   { width:68px; }
    .st-dth-date  { width:80px; white-space:nowrap; }
    .st-dth-mission { width:70px; }
    .st-dth-time  { width:100px; }
    .st-dth-dur   { width:70px; text-align:right; }
    .st-dth-type  { width:60px; }
    .st-dth-status { width:80px; }
    .st-d-act-wrap { display:flex; gap:2px; }
    .st-d-icon-btn {
      width:26px; height:26px; border-radius:5px; border:none;
      background:none; cursor:pointer; display:flex; align-items:center; justify-content:center;
      color:#94a3b8; transition:all .12s;
      mat-icon { font-size:14px; width:14px; height:14px; }
      &:hover { background:#f1f5f9; color:#374151; }
    }
    .st-d-icon-btn--danger:hover { background:#fee2e2; color:#dc2626; }
    .st-d-icon-btn[disabled] { opacity:.3; cursor:not-allowed; }
    .st-d-date { font-variant-numeric:tabular-nums; font-size:11px; }
    .st-d-client { min-width:100px; }
    .st-d-label { color:#475569; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .st-d-time { white-space:nowrap; }
    .st-d-dur { text-align:right; font-weight:700; font-variant-numeric:tabular-nums; font-size:12px; }
    .st-d-empty { color:#cbd5e1; font-size:12px; }
    .st-d-empty-row {
      text-align:center; padding:40px !important; color:#94a3b8;
      display:table-cell; vertical-align:middle;
    }
    .st-d-empty-row mat-icon { font-size:32px; width:32px; height:32px; display:block; margin:0 auto 8px; opacity:.3; }
    .st-d-empty-row span { display:block; }
    /* Totaux */
    .st-d-totals { background:linear-gradient(135deg,#f0fdf4,#f8fafc); font-weight:700; }
    .st-d-totals td { padding:10px 10px; border-top:2px solid #d1fae5; border-bottom:none; }
    .st-d-totals-label { font-size:11px; color:#374151; }
    .st-d-totals-dur { text-align:right; font-size:14px; color:#059669; font-variant-numeric:tabular-nums; }

    /* Pagination */
    .st-detail-pagination {
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding:10px 16px; background:white; border:1px solid #e2e8f0;
      border-radius:10px; flex-wrap:wrap;
    }
    .st-page-info { font-size:12px; color:#64748b; }
    .st-page-btns { display:flex; align-items:center; gap:8px; }
    .st-page-btn {
      display:flex; align-items:center; gap:4px; padding:5px 12px;
      border-radius:7px; border:1.5px solid #e2e8f0; background:white;
      color:#374151; cursor:pointer; font-size:12px; font-weight:600; font-family:inherit;
      transition:all .15s;
      mat-icon { font-size:16px; width:16px; height:16px; }
      &:hover:not([disabled]) { border-color:#6366f1; color:#6366f1; }
      &[disabled] { opacity:.4; cursor:not-allowed; }
    }
    .st-page-num { font-size:12px; font-weight:700; color:#64748b; padding:0 8px; }

  `],
})
export class SaisieTempsComponent implements OnInit {
  private svc    = inject(SaisieTempsService);
  private snack  = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private auth   = inject(AuthService);

  /* ── Signaux principaux ── */
  allSaisies  = signal<SaisieTemps[]>([]);
  loading     = signal(false);
  filter      = signal<FilterType>('ALL');
  budgets     = signal<BudgetMission[]>([]);
  dismissedAlerts = signal<string[]>(this._loadDismissed());
  currentWeekStart = signal<Date>(this.getMonday(new Date()));
  viewMode    = signal<ViewMode>('week');

  /* ── Signaux vue Détail ── */
  detailSearch          = signal('');
  detailFilterDateDebut = signal('');
  detailFilterDateFin   = signal('');
  detailFilterType      = signal<FilterType>('ALL');
  detailFilterMission   = signal('');
  showFilters           = signal(false);
  detailPage            = signal(0);
  readonly detailPageSize = 25;
  selectedRows          = signal(new Set<number>());

  /* ── Constantes calendrier ── */
  readonly CALENDAR_HOURS  = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20
  readonly CALENDAR_START  = 8;
  readonly HOUR_HEIGHT     = 60; // px
  readonly SEUIL_HEURES_MIN   = 35;
  readonly SEUIL_RATIO_NF_MAX = 30;
  readonly MISSIONS_LIST = MISSION_CODES;

  /* ── Computed semaine ── */
  weekNum = computed(() => {
    return `S${this.getISOWeekNumber(this.currentWeekStart())}`;
  });

  weekLabel = computed(() => {
    const start = this.currentWeekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('fr-FR', opts)} — ${end.toLocaleDateString('fr-FR', opts)} ${end.getFullYear()}`;
  });

  isCurrentWeek = computed(() => {
    const mon = this.getMonday(new Date());
    return this.currentWeekStart().getTime() === mon.getTime();
  });

  weekHasLocked = computed(() => this.allSaisies().some(s => s.isLocked));

  groupedByDay = computed((): DayGroup[] => {
    const ws = this.currentWeekStart();
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    we.setHours(23, 59, 59, 999);

    const f = this.filter();
    const filtered = this.allSaisies().filter(s => {
      const d = new Date(s.date + 'T00:00:00');
      if (d < ws || d > we) return false;
      if (f === 'FACTURABLE') return s.type === 'FACTURABLE';
      if (f === 'NON_FACTURABLE') return s.type === 'NON_FACTURABLE';
      return true;
    });

    const map = new Map<string, SaisieTemps[]>();
    filtered.forEach(s => {
      const key = s.date.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });

    const days: DayGroup[] = [];
    map.forEach((entries, date) => {
      days.push({
        date,
        label: this.dayLabel(date),
        entries: entries.sort((a, b) => a.id > b.id ? 1 : -1),
        total: entries.reduce((sum, s) => sum + s.dureeHeures, 0),
      });
    });
    return days.sort((a, b) => a.date.localeCompare(b.date));
  });

  weekStats = computed(() => {
    const ws = this.currentWeekStart();
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    we.setHours(23, 59, 59, 999);
    const entries = this.allSaisies().filter(s => {
      const d = new Date(s.date + 'T00:00:00');
      return d >= ws && d <= we;
    });
    const facturable = entries.filter(s => s.type === 'FACTURABLE').reduce((a, s) => a + s.dureeHeures, 0);
    const nonFacturable = entries.filter(s => s.type === 'NON_FACTURABLE').reduce((a, s) => a + s.dureeHeures, 0);
    const total = facturable + nonFacturable;
    const factPct = total > 0 ? (facturable / total) * 100 : 0;
    const ratioNFPct = total > 0 ? (nonFacturable / total) * 100 : 0;
    return {
      facturable, nonFacturable, total, factPct,
      alerteTotal: this.isCurrentWeek() && total < this.SEUIL_HEURES_MIN,
      alerteRatio: ratioNFPct > this.SEUIL_RATIO_NF_MAX,
    };
  });

  visibleAlerts = computed(() => {
    const dismissed = this.dismissedAlerts();
    const ws = this.weekStats();
    const alerts: { id: string; level: 'warning' | 'danger'; message: string }[] = [];
    if (ws.alerteTotal) {
      const id = `total-${this.toISO(this.currentWeekStart())}`;
      if (!dismissed.includes(id))
        alerts.push({ id, level: 'warning', message: `Seulement ${ws.total.toFixed(1)}h saisies cette semaine — objectif ${this.SEUIL_HEURES_MIN}h` });
    }
    if (ws.alerteRatio) {
      const id = `ratio-${this.toISO(this.currentWeekStart())}`;
      if (!dismissed.includes(id)) {
        const pct = ws.total > 0 ? ((ws.nonFacturable / ws.total) * 100).toFixed(0) : '0';
        alerts.push({ id, level: 'danger', message: `Ratio non-facturable élevé : ${pct}% (seuil ${this.SEUIL_RATIO_NF_MAX}%)` });
      }
    }
    return alerts;
  });

  budgetBar = computed((): { clientNom: string; missionCode: string; heuresUtilisees: number; heuresBudget: number; pct: number } | null => {
    return null;
  });

  isAdminOrExpert = computed(() => {
    const role = (this.auth.currentUser() as any)?.role ?? '';
    return role === 'ADMIN' || role === 'EXPERT_COMPTABLE';
  });

  /* ── Computed calendrier agenda ── */
  calendarDays = computed((): CalendarDay[] => {
    const ws = this.currentWeekStart();
    const today = this.todayStr();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      return {
        date: iso,
        weekdayShort: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayMonth: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        isToday: iso === today,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      };
    });
  });

  /* ── Computed vue détail ── */
  detailFiltered = computed((): SaisieTemps[] => {
    let saisies = this.allSaisies();
    const q = this.detailSearch().trim().toLowerCase();
    if (q) {
      saisies = saisies.filter(s =>
        (s.commentaire?.toLowerCase().includes(q)) ||
        (s.client?.nom.toLowerCase().includes(q)) ||
        (s.missionCode?.toLowerCase().includes(q)) ||
        (s.categorie?.toLowerCase().includes(q))
      );
    }
    const type = this.detailFilterType();
    if (type !== 'ALL') saisies = saisies.filter(s => s.type === type);

    const mission = this.detailFilterMission();
    if (mission) saisies = saisies.filter(s => s.missionCode === mission);

    const debut = this.detailFilterDateDebut();
    const fin   = this.detailFilterDateFin();
    if (debut) saisies = saisies.filter(s => s.date >= debut);
    if (fin)   saisies = saisies.filter(s => s.date <= fin);

    return saisies.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  });

  detailTotal = computed(() =>
    this.detailFiltered().reduce((sum, s) => sum + s.dureeHeures, 0)
  );

  detailPaginated = computed((): SaisieTemps[] => {
    const page = this.detailPage();
    const size  = this.detailPageSize;
    return this.detailFiltered().slice(page * size, (page + 1) * size);
  });

  detailTotalPages = computed(() =>
    Math.ceil(this.detailFiltered().length / this.detailPageSize)
  );

  pageRangeEnd = computed(() =>
    Math.min((this.detailPage() + 1) * this.detailPageSize, this.detailFiltered().length)
  );

  /* ── Lifecycle ── */
  ngOnInit() { this.loadData(); }

  loadData() {
    this.loading.set(true);
    this.svc.getMes().subscribe({
      next: (data) => { this.allSaisies.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  /* ── Navigation semaine ── */
  prevWeek() {
    this.currentWeekStart.update(d => {
      const n = new Date(d); n.setDate(n.getDate() - 7); return n;
    });
  }

  nextWeek() {
    if (this.isCurrentWeek()) return;
    this.currentWeekStart.update(d => {
      const n = new Date(d); n.setDate(n.getDate() + 7); return n;
    });
  }

  /* ── Modal ── */
  openModal(date?: string, heureDebut?: string, heureFin?: string) {
    const ref = this.dialog.open(SaisieTempsDialogComponent, {
      data: { date: date ?? this.todayStr(), heureDebut, heureFin },
      panelClass: 'st-dialog-panel',
    });
    ref.afterClosed().subscribe((result: { dto: CreateSaisieTempsDto; andNew: boolean } | undefined) => {
      if (!result) return;
      this._handleDialogResult(result);
    });
  }

  private _handleDialogResult(result: { dto: CreateSaisieTempsDto; andNew: boolean }) {
    this._saveSaisie(result.dto, result.andNew);
  }

  private _saveSaisie(dto: CreateSaisieTempsDto, andNew = false) {
    this.svc.create(dto).subscribe({
      next: (s) => {
        this.allSaisies.update(list => [s, ...list]);
        this.snack.open('Saisie créée', 'OK', { duration: 2000 });
        const entryWeek = this.getMonday(new Date(s.date + 'T00:00:00'));
        this.currentWeekStart.set(entryWeek);
        if (andNew) {
          setTimeout(() => this.openModal(dto.date), 50);
        }
      },
      error: (err) => this.snack.open(err?.error?.message ?? 'Erreur', 'OK', { duration: 4000 }),
    });
  }

  editSaisie(s: SaisieTemps) {
    const ref = this.dialog.open(SaisieTempsDialogComponent, {
      data: { date: s.date, existing: s },
      panelClass: 'st-dialog-panel',
    });
    ref.afterClosed().subscribe((result: { dto: CreateSaisieTempsDto; andNew: boolean } | undefined) => {
      if (!result) return;
      // Supprimer l'ancien + créer le nouveau
      this.svc.delete(s.id).subscribe({
        next: () => {
          this.allSaisies.update(list => list.filter(x => x.id !== s.id));
          this._saveSaisie(result.dto, result.andNew);
        },
        error: () => this.snack.open('Erreur lors de la modification', 'OK', { duration: 3000 }),
      });
    });
  }

  validerSemaine() {
    const ws = this.currentWeekStart();
    const semaine = this.getISOWeekNumber(ws);
    const user = this.auth.currentUser();
    if (!user) return;
    this.svc.validerPeriode(semaine, ws.getFullYear(), user.id).subscribe({
      next: (r) => {
        this.snack.open(`${r.locked} saisie(s) verrouillée(s)`, 'OK', { duration: 3000 });
        this.loadData();
      },
      error: (err) => this.snack.open(err?.error?.message ?? 'Erreur', 'OK', { duration: 4000 }),
    });
  }

  deleteSaisie(id: number) {
    this.svc.delete(id).subscribe({
      next: () => {
        this.allSaisies.update(list => list.filter(s => s.id !== id));
        this.snack.open('Saisie supprimée', 'OK', { duration: 2000 });
      },
      error: (err) => this.snack.open(err?.error?.message ?? 'Erreur', 'OK', { duration: 4000 }),
    });
  }

  dismissAlert(id: string) {
    const updated = [...this.dismissedAlerts(), id];
    this.dismissedAlerts.set(updated);
    try { localStorage.setItem(LS_DISMISSED, JSON.stringify(updated)); } catch {}
  }

  /* ── Agenda ── */
  getDayTotal(date: string): number {
    return this.allSaisies()
      .filter(s => s.date?.substring(0, 10) === date)
      .reduce((sum, s) => sum + s.dureeHeures, 0);
  }

  getAllDayEntries(date: string): SaisieTemps[] {
    return this.allSaisies().filter(s =>
      s.date?.substring(0, 10) === date && (!s.heureDebut || !s.heureFin)
    );
  }

  getTimedBlocks(date: string): TimedBlock[] {
    return this.allSaisies()
      .filter(s => s.date?.substring(0, 10) === date && s.heureDebut && s.heureFin)
      .map(s => {
        const [sh, sm] = s.heureDebut!.split(':').map(Number);
        const [eh, em] = s.heureFin!.split(':').map(Number);
        const startH = sh + sm / 60;
        const endH   = eh + em / 60;
        const top    = (startH - this.CALENDAR_START) * this.HOUR_HEIGHT;
        const height = Math.max(28, (endH - startH) * this.HOUR_HEIGHT);
        const diff   = endH - startH;
        const dH     = Math.floor(diff);
        const dM     = Math.round((diff - dH) * 60);
        const durationLabel = dH > 0
          ? (dM > 0 ? `${dH}h ${dM}min` : `${dH}h`)
          : `${dM}min`;
        return {
          ...s,
          blockStyle: `top:${top}px; height:${height}px;`,
          durationLabel,
        };
      });
  }

  onCalendarSlotClick(date: string, event: MouseEvent) {
    const col = event.currentTarget as HTMLElement;
    const rect = col.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const clickedHour = this.CALENDAR_START + y / this.HOUR_HEIGHT;
    const h = Math.max(8, Math.min(19, Math.floor(clickedHour)));
    const m = Math.floor((clickedHour - Math.floor(clickedHour)) * 60 / 15) * 15;
    const hStr   = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const endH   = Math.min(20, h + 1);
    const endStr = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.openModal(date, hStr, endStr);
  }

  /* ── Detail ── */
  onDetailSearch(event: Event) {
    this.detailSearch.set((event.target as HTMLInputElement).value);
    this.detailPage.set(0);
  }

  onDetailFilter(field: string, event: Event) {
    const val = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.detailPage.set(0);
    if (field === 'dateDebut') this.detailFilterDateDebut.set(val);
    else if (field === 'dateFin') this.detailFilterDateFin.set(val);
    else if (field === 'type') this.detailFilterType.set(val as FilterType);
    else if (field === 'mission') this.detailFilterMission.set(val);
  }

  resetFilters() {
    this.detailSearch.set('');
    this.detailFilterDateDebut.set('');
    this.detailFilterDateFin.set('');
    this.detailFilterType.set('ALL');
    this.detailFilterMission.set('');
    this.detailPage.set(0);
  }

  toggleRow(id: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedRows.update(set => {
      const n = new Set(set);
      checked ? n.add(id) : n.delete(id);
      return n;
    });
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedRows.set(checked
      ? new Set(this.detailPaginated().map(s => s.id))
      : new Set()
    );
  }

  exportCSV() {
    const rows = this.detailFiltered();
    const headers = ['Date', 'Client', 'Mission', 'Catégorie', 'Libellé', 'Début', 'Fin', 'Durée (h)', 'Type', 'Statut'];
    const lines = rows.map(s => [
      s.date,
      s.client?.nom ?? '',
      s.missionCode ?? '',
      s.categorie ?? '',
      s.commentaire ?? '',
      s.heureDebut ?? '',
      s.heureFin ?? '',
      s.dureeHeures.toFixed(2),
      s.type,
      s.isLocked ? 'Validé' : 'En cours',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));

    const csv = [headers.join(';'), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `saisies-temps-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  printDetail() {
    const area = document.getElementById('st-print-area');
    if (!area) return;
    const html = area.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Suivi des temps — AFYM</title>
<style>
  body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; margin: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; font-weight: 700; font-size: 11px; text-transform: uppercase;
       letter-spacing: .4px; padding: 6px 10px; border-bottom: 2px solid #cbd5e1; text-align: left; }
  td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tfoot td { font-weight: 700; border-top: 2px solid #cbd5e1; background: #f8fafc; }
  .st-badge { display:inline-block; padding:1px 7px; border-radius:20px; font-size:10px; font-weight:700; }
  .st-badge--fact { background:#dcfce7; color:#15803d; }
  .st-badge--nf { background:#fce7f3; color:#be185d; }
  .st-badge--locked { background:#e0e7ff; color:#4338ca; }
  .st-badge--inprogress { background:#f1f5f9; color:#64748b; }
  .st-badge--mission { padding:1px 7px; border-radius:20px; font-size:10px; font-weight:700; }
  .st-client-chip { background:#f1f5f9; border-radius:4px; padding:1px 6px; font-weight:600; }
  .st-dth-cb, input[type=checkbox] { display:none; }
  .st-d-act-wrap { display:none; }
  .st-d-empty { color:#94a3b8; }
  .st-d-empty-row { text-align:center; color:#94a3b8; padding:20px; }
  .st-time-range { font-family: monospace; font-size: 11px; }
  @media print { @page { margin: 1.5cm; size: A4 landscape; } }
</style></head><body>
<h2 style="margin:0 0 12px;font-size:15px;font-weight:800;color:#1e293b;">Suivi des temps — AFYM</h2>
${html}
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  /* ── Helpers ── */
  fmtH(h: number): string {
    if (!h || h <= 0) return '0h';
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    return min > 0 ? `${hrs}h ${min}min` : `${hrs}h`;
  }

  categCode(cat?: CategorieNonFacturable): string {
    const codes: Record<string, string> = {
      APPEL_CLIENT: 'APPEL', REUNION_INTERNE: 'RÉUN', FORMATION: 'FORM',
      ADMINISTRATIF: 'ADMIN', AUTRE: 'AUTRE',
    };
    return cat ? (codes[cat] ?? cat) : 'NF';
  }

  getMissionColor(code: string): string {
    return MISSION_CODES.find(m => m.code === code)?.color ?? '#475569';
  }

  getMissionBg(code: string): string {
    return MISSION_CODES.find(m => m.code === code)?.bg ?? '#f1f5f9';
  }

  getMissionLabel(code: string): string {
    return MISSION_CODES.find(m => m.code === code)?.label ?? '';
  }

  private dayLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  private getMonday(d: Date): Date {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private toISO(d: Date): string { return d.toISOString().split('T')[0]; }

  private getISOWeekNumber(d: Date): number {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private _loadDismissed(): string[] {
    try { return JSON.parse(localStorage.getItem(LS_DISMISSED) ?? '[]'); } catch { return []; }
  }
}
