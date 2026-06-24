import { Component, Input, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from '../../../../../core/services/toast.service';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FluxMensuelService } from '../../../../../core/services/flux-mensuel.service';
import { FluxMensuel } from '../../../../../core/models/client.model';

type Periodicite = 'monthly' | 'quarterly' | 'annual';

const TYPES: { key: string; label: string; icon: string; periodicite: Periodicite }[] = [
  { key: 'RELEVE_BANCAIRE',   label: 'Relevés bancaires',    icon: 'account_balance', periodicite: 'monthly'   },
  { key: 'TVA_MENSUELLE',     label: 'TVA Mensuelle',        icon: 'receipt',         periodicite: 'monthly'   },
  { key: 'TVA_TRIMESTRIELLE', label: 'TVA Trimestrielle',    icon: 'receipt_long',    periodicite: 'quarterly' },
  { key: 'TVA_ANNUELLE',      label: 'TVA Annuelle (DCA12)', icon: 'description',     periodicite: 'annual'    },
  { key: 'PAIE',              label: 'Paie (SILAE)',         icon: 'people',          periodicite: 'monthly'   },
  { key: 'RAPPORT_VENTE',     label: 'Rapport de vente',     icon: 'point_of_sale',   periodicite: 'monthly'   },
  { key: 'RECETTE_AMENITIZ',  label: 'Recette Amenitiz',     icon: 'hotel',           periodicite: 'monthly'   },
  { key: 'PIECES_COMPTABLES', label: 'Pièces comptables',    icon: 'folder_open',     periodicite: 'monthly'   },
];

const MOIS = [
  'Jan','Fév','Mar','Avr','Mai','Jun',
  'Jul','Aoû','Sep','Oct','Nov','Déc',
];

const MOIS_FULL = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

type Statut = 'DEPOSE' | 'EN_RETARD' | 'MANQUANT';

@Component({
  selector: 'app-flux-mensuel-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatMenuModule, MatDividerModule, MatTooltipModule,
    MatInputModule, MatFormFieldModule,
  ],
  template: `
    <div class="pilotage">

      <!-- ── En-tête ──────────────────────────────────── -->
      <div class="pilotage-header">
        <div class="pilotage-title">
          <mat-icon>bar_chart</mat-icon>
          <div>
            <h3>Pilotage opérationnel</h3>
            <p>Suivi des dépôts de documents mensuels</p>
          </div>
        </div>

        <!-- Sélecteur d'année -->
        <div class="year-nav">
          <button mat-icon-button (click)="changeYear(-1)" class="year-btn">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <span class="year-label">{{ annee() }}</span>
          <button mat-icon-button class="year-btn year-btn--cal" matTooltip="Choisir une année"
                  [matMenuTriggerFor]="yearMenu">
            <mat-icon>calendar_month</mat-icon>
          </button>
          <button mat-icon-button (click)="changeYear(1)" class="year-btn"
                  [disabled]="annee() >= currentYear">
            <mat-icon>chevron_right</mat-icon>
          </button>
        </div>
        <mat-menu #yearMenu="matMenu">
          @for (y of yearOptions; track y) {
            <button mat-menu-item (click)="jumpToYear(y)" [class.year-active]="y === annee()">
              {{ y }}
            </button>
          }
        </mat-menu>
      </div>

      <!-- ── KPI cards ─────────────────────────────────── -->
      <div class="kpi-row">
        <div class="kpi-card kpi-green">
          <div class="kpi-icon"><mat-icon>check_circle</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ countByStatut('DEPOSE') }}</span>
            <span class="kpi-label">Déposés</span>
          </div>
        </div>
        <div class="kpi-card kpi-orange">
          <div class="kpi-icon"><mat-icon>schedule</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ countByStatut('EN_RETARD') }}</span>
            <span class="kpi-label">En retard</span>
          </div>
        </div>
        <div class="kpi-card kpi-red">
          <div class="kpi-icon"><mat-icon>cancel</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ countByStatut('MANQUANT') }}</span>
            <span class="kpi-label">Manquants</span>
          </div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon"><mat-icon>percent</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ completionRate() }}%</span>
            <span class="kpi-label">Complétude</span>
          </div>
          <div class="kpi-bar-track">
            <div class="kpi-bar-fill" [style.width.%]="completionRate()"
                 [class]="completionRate() >= 80 ? 'bar-green' : completionRate() >= 50 ? 'bar-orange' : 'bar-red'">
            </div>
          </div>
        </div>
      </div>

      <!-- ── Grille mensuelle ──────────────────────────── -->
      <div class="grid-wrap">
        <table class="flux-grid">
          <thead>
            <tr>
              <th class="th-type">Document</th>
              @for (m of moisLabels; track m; let i = $index) {
                <th class="th-month" [class.th-current]="isCurrentMonth(i + 1)">
                  {{ m }}
                  @if (isCurrentMonth(i + 1)) {
                    <span class="current-dot"></span>
                  }
                </th>
              }
              <th class="th-progress">Avancement</th>
            </tr>
          </thead>
          <tbody>
            @for (type of activeTypes; track type.key) {
              <tr class="grid-row">
                <td class="td-type">
                  <div class="type-cell">
                    <mat-icon class="type-icon">{{ type.icon }}</mat-icon>
                    <span>{{ type.label }}</span>
                  </div>
                </td>

                @for (mois of [1,2,3,4,5,6,7,8,9,10,11,12]; track mois) {
                  <td class="td-cell">
                    @if (!isCellApplicable(type.periodicite, mois)) {
                      <div class="cell-btn cell-na" matTooltip="Non applicable" matTooltipPosition="above">
                        <span class="cell-na-dash">—</span>
                      </div>
                    } @else {
                      @let flux = getCell(type.key, mois);
                      <button class="cell-btn"
                              [class]="cellClass(flux, mois)"
                              [matMenuTriggerFor]="cellMenu"
                              [matMenuTriggerData]="{ flux: flux, type: type.key, mois: mois }"
                              [matTooltip]="cellTooltip(flux, mois)"
                              matTooltipPosition="above">
                        <mat-icon class="cell-icon">{{ cellIcon(flux) }}</mat-icon>
                        @if (flux?.dateDepot) {
                          <span class="cell-date">{{ flux!.dateDepot | date:'dd/MM' }}</span>
                        }
                        @if (!flux?.dateDepot && flux?.dateRelance) {
                          <span class="cell-relance" title="Dernière relance">R</span>
                        }
                      </button>
                    }
                  </td>
                }

                <!-- Barre d'avancement de la ligne -->
                <td class="td-progress">
                  <div class="row-progress">
                    <div class="row-bar-track">
                      <div class="row-bar-fill"
                           [style.width.%]="rowProgress(type.key)"
                           [class]="rowProgress(type.key) >= 80 ? 'bar-green' : rowProgress(type.key) >= 50 ? 'bar-orange' : 'bar-red'">
                      </div>
                    </div>
                    <span class="row-pct">{{ rowProgress(type.key) }}%</span>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Légende -->
      <div class="legend">
        <span class="legend-item">
          <span class="legend-dot dot-green"></span> Déposé
        </span>
        <span class="legend-item">
          <span class="legend-dot dot-orange"></span> En retard
        </span>
        <span class="legend-item">
          <span class="legend-dot dot-red"></span> Manquant
        </span>
        <span class="legend-item">
          <span class="legend-dot dot-gray"></span> Non renseigné
        </span>
        <span class="legend-tip">
          <mat-icon>touch_app</mat-icon> Cliquer sur une cellule pour modifier
        </span>
      </div>

    </div>

    <!-- ── Menu contextuel cellule ───────────────────── -->
    <mat-menu #cellMenu="matMenu" class="cell-menu-panel">
      <ng-template matMenuContent let-flux="flux" let-type="type" let-mois="mois">
        <div class="menu-header">
          <strong>{{ typeName(type) }}</strong>
          <span class="menu-period">{{ moisFullLabel(mois) }} {{ annee() }}</span>
          @if (flux?.dateRelance) {
            <span class="menu-relance">
              <mat-icon>notification_important</mat-icon>
              Relancé le {{ flux.dateRelance | date:'dd/MM/yyyy' }}
            </span>
          }
          @if (flux?.dateDepot) {
            <span class="menu-depot">
              <mat-icon>check_circle</mat-icon>
              Déposé le {{ flux.dateDepot | date:'dd/MM/yyyy' }}
            </span>
          }
        </div>
        <button mat-menu-item (click)="setStatut(flux, type, mois, 'DEPOSE')"
                [class.menu-item-active]="flux?.statut === 'DEPOSE'">
          <mat-icon class="icon-green">check_circle</mat-icon>
          <span>Marquer comme déposé</span>
        </button>
        <button mat-menu-item (click)="setStatut(flux, type, mois, 'EN_RETARD')"
                [class.menu-item-active]="flux?.statut === 'EN_RETARD'">
          <mat-icon class="icon-orange">schedule</mat-icon>
          <span>Signaler en retard</span>
        </button>
        <button mat-menu-item (click)="setStatut(flux, type, mois, 'MANQUANT')"
                [class.menu-item-active]="flux?.statut === 'MANQUANT'">
          <mat-icon class="icon-red">cancel</mat-icon>
          <span>Signaler manquant</span>
        </button>
        <mat-divider />
        <!-- Commentaire (stop propagation pour éviter fermeture du menu) -->
        <div class="menu-comment" (click)="$event.stopPropagation()">
          <mat-icon class="comment-icon">comment</mat-icon>
          <input class="comment-input"
                 placeholder="Ajouter un commentaire…"
                 [value]="flux?.commentaire ?? ''"
                 #commentInput
                 (keydown.enter)="saveComment(flux, type, mois, commentInput.value); commentInput.blur()"
                 (blur)="saveComment(flux, type, mois, commentInput.value)" />
        </div>
        @if (flux) {
          <mat-divider />
          <button mat-menu-item (click)="deleteFlux(flux)" class="menu-item-danger">
            <mat-icon>delete_outline</mat-icon>
            <span>Effacer cette entrée</span>
          </button>
        }
      </ng-template>
    </mat-menu>
  `,
  styles: [`
    .pilotage { padding: 24px; }

    /* ── En-tête ─────────────────────────────────────── */
    .pilotage-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
    }
    .pilotage-title { display: flex; align-items: center; gap: 12px; }
    .pilotage-title mat-icon {
      font-size: 28px; width: 28px; height: 28px;
      color: #6366f1; flex-shrink: 0;
    }
    .pilotage-title h3 { font-size: 17px; font-weight: 700; color: #0f172a; margin: 0; }
    .pilotage-title p  { font-size: 12px; color: #94a3b8; margin: 2px 0 0; }

    .year-nav { display: flex; align-items: center; gap: 8px; }
    .year-btn { color: #64748b !important; }
    .year-btn--cal { color: #6366f1 !important; background: #f5f3ff !important; border-radius: 50%; }
    .year-label {
      font-size: 16px; font-weight: 700; color: #1e293b;
      min-width: 52px; text-align: center;
    }
    .year-active { background: #f5f3ff; color: #6366f1; font-weight: 700; }

    /* ── KPI ─────────────────────────────────────────── */
    .kpi-row {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 16px; margin-bottom: 24px;
    }
    .kpi-card {
      background: white; border-radius: 14px; padding: 14px 16px;
      border: 1px solid #e8ecf0; display: flex; align-items: center; gap: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,.04); overflow: hidden; position: relative;
    }
    .kpi-card.kpi-blue { flex-direction: column; align-items: flex-start; gap: 8px; }
    .kpi-icon {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .kpi-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .kpi-green .kpi-icon { background: #dcfce7; color: #16a34a; }
    .kpi-orange .kpi-icon { background: #fff7ed; color: #d97706; }
    .kpi-red    .kpi-icon { background: #fee2e2; color: #dc2626; }
    .kpi-blue   .kpi-icon { background: #eff6ff; color: #2563eb; }
    .kpi-body { display: flex; flex-direction: column; gap: 1px; flex: 1; }
    .kpi-value { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1; }
    .kpi-blue .kpi-value { font-size: 20px; }
    .kpi-label { font-size: 11px; color: #94a3b8; font-weight: 500; }
    .kpi-bar-track { width: 100%; height: 4px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .kpi-bar-fill  { height: 100%; border-radius: 4px; transition: width .4s; }

    /* ── Grille ──────────────────────────────────────── */
    .grid-wrap {
      background: white; border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 4px rgba(0,0,0,.04);
      overflow-x: auto; margin-bottom: 16px;
    }
    .flux-grid { width: 100%; border-collapse: collapse; min-width: 900px; }

    .th-type {
      padding: 12px 20px; text-align: left;
      font-size: 10.5px; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: .7px;
      background: #f8fafc; border-bottom: 1px solid #e8ecf0;
      white-space: nowrap; min-width: 180px;
    }
    .th-month {
      padding: 10px 6px; text-align: center;
      font-size: 11px; font-weight: 600; color: #94a3b8;
      background: #f8fafc; border-bottom: 1px solid #e8ecf0;
      white-space: nowrap; position: relative; min-width: 52px;
    }
    .th-month.th-current { color: #4f46e5; background: #f5f3ff; }
    .th-progress {
      padding: 10px 16px; text-align: center;
      font-size: 10.5px; font-weight: 700; color: #94a3b8;
      background: #f8fafc; border-bottom: 1px solid #e8ecf0;
      text-transform: uppercase; letter-spacing: .7px; white-space: nowrap; min-width: 120px;
    }
    .current-dot {
      position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
      width: 4px; height: 4px; border-radius: 50%; background: #6366f1;
    }

    .grid-row { border-bottom: 1px solid #f1f5f9; }
    .grid-row:last-child { border-bottom: none; }

    .td-type { padding: 12px 20px; vertical-align: middle; }
    .type-cell { display: flex; align-items: center; gap: 10px; }
    .type-icon { font-size: 17px; width: 17px; height: 17px; color: #94a3b8; }
    .type-cell span { font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; }

    .td-cell { padding: 10px 6px; text-align: center; vertical-align: middle; }

    /* ── Cellules ────────────────────────────────────── */
    .cell-btn {
      width: 42px; height: 42px; border-radius: 10px;
      border: none; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 1px; transition: all .15s; position: relative;
    }
    .cell-icon { font-size: 16px; width: 16px; height: 16px; }
    .cell-date { font-size: 8.5px; font-weight: 600; line-height: 1; opacity: .85; }

    .cell-empty {
      background: #f8fafc; color: #cbd5e1;
      border: 1.5px dashed #e2e8f0;
    }
    .cell-empty:hover { background: #f1f5f9; border-color: #c7d2fe; color: #6366f1; }

    .cell-depose {
      background: #dcfce7; color: #16a34a;
      border: 1.5px solid #bbf7d0;
    }
    .cell-depose:hover { background: #bbf7d0; }

    .cell-retard {
      background: #fff7ed; color: #d97706;
      border: 1.5px solid #fed7aa;
    }
    .cell-retard:hover { background: #fed7aa; }

    .cell-manquant {
      background: #fee2e2; color: #dc2626;
      border: 1.5px solid #fecaca;
    }
    .cell-manquant:hover { background: #fecaca; }

    .cell-future {
      background: transparent; color: #e2e8f0;
      border: 1.5px dashed #f1f5f9; cursor: default; pointer-events: none;
    }
    .cell-na {
      background: #f8fafc; border: none; cursor: default; pointer-events: none;
    }
    .cell-na-dash { font-size: 14px; color: #e2e8f0; font-weight: 300; }

    .cell-relance {
      font-size: 8px; font-weight: 800; line-height: 1;
      color: #d97706; opacity: .9;
    }

    /* ── Barre avancement ligne ──────────────────────── */
    .td-progress { padding: 8px 16px; vertical-align: middle; }
    .row-progress { display: flex; align-items: center; gap: 8px; }
    .row-bar-track { flex: 1; height: 5px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .row-bar-fill  { height: 100%; border-radius: 4px; transition: width .4s; }

    .bar-green  { background: linear-gradient(90deg, #22c55e, #16a34a); }
    .bar-orange { background: linear-gradient(90deg, #fb923c, #d97706); }
    .bar-red    { background: linear-gradient(90deg, #f87171, #dc2626); }

    .row-pct { font-size: 11px; font-weight: 700; color: #64748b; min-width: 32px; text-align: right; }

    /* ── Légende ─────────────────────────────────────── */
    .legend {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      padding: 0 4px;
    }
    .legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #64748b; }
    .legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
    .dot-green  { background: #dcfce7; border: 1.5px solid #bbf7d0; }
    .dot-orange { background: #fff7ed; border: 1.5px solid #fed7aa; }
    .dot-red    { background: #fee2e2; border: 1.5px solid #fecaca; }
    .dot-gray   { background: #f8fafc; border: 1.5px dashed #e2e8f0; }
    .legend-tip {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; color: #cbd5e1; margin-left: auto;
    }
    .legend-tip mat-icon { font-size: 13px; width: 13px; height: 13px; }

    /* ── Menu contextuel ─────────────────────────────── */
    .menu-header {
      display: flex; flex-direction: column; gap: 6px;
      padding: 12px 16px 10px; pointer-events: none;
      border-bottom: 1px solid #f1f5f9; margin-bottom: 4px;
    }
    .menu-header strong { font-size: 13px; font-weight: 700; color: #1e293b; }
    .menu-period { font-size: 11px; color: #94a3b8; }
    .menu-relance {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; color: #d97706;
    }
    .menu-relance mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .menu-depot {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; color: #16a34a;
    }
    .menu-depot mat-icon { font-size: 12px; width: 12px; height: 12px; }

    .menu-comment {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 16px 8px; cursor: text;
    }
    .comment-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; flex-shrink: 0; }
    .comment-input {
      flex: 1; border: none; outline: none;
      font-size: 12px; color: #1e293b; background: transparent;
      font-family: inherit;
    }
    .comment-input::placeholder { color: #cbd5e1; }

    .menu-item-active { background: #f8fafc; }
    .menu-item-danger { color: #dc2626 !important; }
    .icon-green  { color: #16a34a !important; }
    .icon-orange { color: #d97706 !important; }
    .icon-red    { color: #dc2626 !important; }

    /* Responsive */
    @media (max-width: 768px) {
      .kpi-row { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class FluxMensuelTabComponent implements OnInit {
  private service = inject(FluxMensuelService);
  private toast   = inject(ToastService);

  @Input() clientId!: number;
  @Input() set typesFluxActifs(val: string[] | undefined) {
    this.activeTypes = val?.length ? TYPES.filter(t => val.includes(t.key)) : [...TYPES];
  }

  activeTypes = [...TYPES];
  annee        = signal(new Date().getFullYear());
  currentYear  = new Date().getFullYear();
  currentMonth = new Date().getMonth() + 1; // 1-12
  fluxList: FluxMensuel[] = [];

  readonly types  = TYPES;
  readonly moisLabels = MOIS;

  ngOnInit() { this.load(); }

  load() {
    this.service.getAll(this.clientId, this.annee()).subscribe(d => this.fluxList = d);
  }

  changeYear(delta: number) {
    this.annee.update(y => y + delta);
    this.load();
  }

  get yearOptions(): number[] {
    const opts: number[] = [];
    for (let y = this.currentYear; y >= Math.max(2020, this.currentYear - 5); y--) {
      opts.push(y);
    }
    return opts;
  }

  jumpToYear(y: number) {
    this.annee.set(y);
    this.load();
  }

  // ── Getters grille ──────────────────────────────────

  getCell(type: string, mois: number): FluxMensuel | undefined {
    return this.fluxList.find(f => f.type === type && f.mois === mois);
  }

  isCurrentMonth(mois: number): boolean {
    return this.annee() === this.currentYear && mois === this.currentMonth;
  }

  isFuture(mois: number): boolean {
    return this.annee() === this.currentYear && mois > this.currentMonth;
  }

  isCellApplicable(periodicite: Periodicite, mois: number): boolean {
    if (periodicite === 'quarterly') return [3, 6, 9, 12].includes(mois);
    if (periodicite === 'annual')    return mois === 12;
    return true;
  }

  cellClass(flux: FluxMensuel | undefined, mois: number): string {
    if (this.isFuture(mois)) return 'cell-btn cell-future';
    if (!flux) return 'cell-btn cell-empty';
    if (flux.statut === 'DEPOSE')    return 'cell-btn cell-depose';
    if (flux.statut === 'EN_RETARD') return 'cell-btn cell-retard';
    return 'cell-btn cell-manquant';
  }

  cellIcon(flux: FluxMensuel | undefined): string {
    if (!flux) return 'add';
    if (flux.statut === 'DEPOSE')    return 'check';
    if (flux.statut === 'EN_RETARD') return 'schedule';
    return 'close';
  }

  cellTooltip(flux: FluxMensuel | undefined, mois: number): string {
    if (this.isFuture(mois)) return '';
    if (!flux) return 'Cliquer pour renseigner';
    if (flux.statut === 'DEPOSE')    return flux.dateDepot ? `Déposé le ${new Date(flux.dateDepot).toLocaleDateString('fr-FR')}` : 'Déposé';
    if (flux.statut === 'EN_RETARD') return 'En retard — cliquer pour modifier';
    return 'Manquant — cliquer pour modifier';
  }

  // ── Actions ────────────────────────────────────────

  setStatut(flux: FluxMensuel | undefined, type: string, mois: number, statut: Statut) {
    if (flux) {
      if (flux.statut === statut) return;
      this.service.update(this.clientId, flux.id, { statut }).subscribe(() => {
        this.load();
        this.toast.success('Statut mis à jour');
      });
    } else {
      this.service.create(this.clientId, { type, mois, annee: this.annee(), statut }).subscribe(() => {
        this.load();
        this.toast.success('Flux enregistré');
      });
    }
  }

  deleteFlux(flux: FluxMensuel) {
    this.service.delete(this.clientId, flux.id).subscribe(() => {
      this.load();
      this.toast.success('Entrée supprimée');
    });
  }

  saveComment(flux: FluxMensuel | undefined, type: string, mois: number, comment: string) {
    const trimmed = comment.trim();
    if (flux) {
      if (trimmed === (flux.commentaire ?? '').trim()) return;
      this.service.update(this.clientId, flux.id, { commentaire: trimmed }).subscribe(() => {
        this.load();
      });
    } else if (trimmed) {
      this.service.create(this.clientId, { type, mois, annee: this.annee(), statut: 'MANQUANT', commentaire: trimmed }).subscribe(() => {
        this.load();
      });
    }
  }

  // ── KPI ────────────────────────────────────────────

  countByStatut(statut: Statut): number {
    return this.fluxList.filter(f => f.statut === statut).length;
  }

  completionRate(): number {
    let total = 0;
    let deposited = 0;
    const maxMois = this.annee() < this.currentYear ? 12 : this.currentMonth;
    for (const t of this.activeTypes) {
      for (let m = 1; m <= maxMois; m++) {
        if (!this.isCellApplicable(t.periodicite, m)) continue;
        total++;
        const flux = this.getCell(t.key, m);
        if (flux?.statut === 'DEPOSE') deposited++;
      }
    }
    if (total === 0) return 0;
    return Math.round((deposited / total) * 100);
  }

  rowProgress(typeKey: string): number {
    const t = this.activeTypes.find(x => x.key === typeKey);
    if (!t) return 0;
    const maxMois = this.annee() < this.currentYear ? 12 : this.currentMonth;
    let total = 0; let deposited = 0;
    for (let m = 1; m <= maxMois; m++) {
      if (!this.isCellApplicable(t.periodicite, m)) continue;
      total++;
      const flux = this.getCell(typeKey, m);
      if (flux?.statut === 'DEPOSE') deposited++;
    }
    if (total === 0) return 0;
    return Math.round((deposited / total) * 100);
  }

  // ── Labels ─────────────────────────────────────────

  typeName(key: string): string {
    return TYPES.find(t => t.key === key)?.label ?? key;
  }

  moisFullLabel(m: number): string {
    return MOIS_FULL[m - 1] ?? '';
  }
}
