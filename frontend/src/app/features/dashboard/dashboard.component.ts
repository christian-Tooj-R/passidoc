import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables, ChartData, ChartConfiguration } from 'chart.js';
import { ClientsService } from '../../core/services/clients.service';
import { FluxMensuelService } from '../../core/services/flux-mensuel.service';
import { TasksService, Task } from '../../core/services/tasks.service';
import { Client } from '../../core/models/client.model';
import { AuthService } from '../../core/services/auth.service';

Chart.register(...registerables);

interface CollabStat {
  name: string;
  total: number;
  terminees: number;
  enCours: number;
  taux: number;
  dossiers: { nom: string; total: number; terminees: number; enCours: number }[];
}

const MOIS_COURT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const TYPE_LABELS: Record<string, string> = {
  RELEVE_BANCAIRE: 'Relevé bancaire',
  TVA:             'TVA',
  PAIE:            'Paie',
  RAPPORT_VENTE:   'Rapport de vente',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatRippleModule, BaseChartDirective],
  template: `
    <div class="dash">

      <!-- ══ HERO ══════════════════════════════════════════ -->
      <div class="hero">
        <div class="hero__text">
          <span class="hero__eyebrow">Tableau de bord</span>
          <h1 class="hero__title">Bonjour, {{ firstName }} 👋</h1>
          <p class="hero__date">{{ today }}</p>
        </div>
        <div class="hero__stats">
          <div class="h-stat">
            <span class="h-stat__val">{{ clients.length }}</span>
            <span class="h-stat__lbl">Dossiers</span>
          </div>
          <div class="h-stat__div"></div>
          <div class="h-stat">
            <span class="h-stat__val h-stat__val--green">{{ dossiersTransmissibles }}</span>
            <span class="h-stat__lbl">Transmissibles</span>
          </div>
          <div class="h-stat__div"></div>
          <div class="h-stat">
            <span class="h-stat__val h-stat__val--orange">{{ dossiersPartiels }}</span>
            <span class="h-stat__lbl">En cours</span>
          </div>
          <div class="h-stat__div"></div>
          <div class="h-stat">
            <span class="h-stat__val h-stat__val--red">{{ dossiersEnAlerte }}</span>
            <span class="h-stat__lbl">En alerte</span>
          </div>
        </div>
      </div>

      <!-- ══ METRIC CARDS ═══════════════════════════════════ -->
      <div class="metrics-row">
        @for (m of metrics; track m.label) {
          <div class="metric" [style.background]="m.bg">
            <div class="metric__top">
              <span class="metric__label">{{ m.label }}</span>
              <div class="metric__icon" [style.background]="m.iconBg" [style.color]="m.color">
                <mat-icon>{{ m.icon }}</mat-icon>
              </div>
            </div>
            <span class="metric__value" [style.color]="m.color">{{ m.value }}</span>
            <span class="metric__tag" [style.color]="m.color">{{ m.tag }}</span>
          </div>
        }
      </div>

      <!-- ══ PERFORMANCE ÉQUIPE ════════════════════════════════ -->
      @if (collabStats.length > 0) {
        <div class="perf-section">

          <!-- Header -->
          <div class="perf-header">
            <div class="perf-header__left">
              <div class="perf-header__icon"><mat-icon>leaderboard</mat-icon></div>
              <div>
                <h2 class="perf-header__title">Performance équipe</h2>
                <span class="perf-header__sub">{{ totalTasksCount }} tâches · {{ collabStats.length }} collaborateur(s)</span>
              </div>
            </div>
          </div>

          <!-- ── Row 1 : Bar chart vue d'ensemble ── -->
          <div class="chart-card chart-card--full">
            <div class="chart-card__title">Vue d'ensemble — tâches par collaborateur</div>
            <div class="chart-wrap chart-wrap--bar">
              <canvas baseChart
                [data]="teamBarData"
                [options]="teamBarOptions"
                type="bar">
              </canvas>
            </div>
          </div>

          <!-- ── Row 2 : Sélecteur collab + détail ── -->
          <div class="perf-detail-section">

            <!-- Onglets collabs -->
            <div class="collab-tabs">
              @for (s of collabStats; track s.name) {
                <button class="ctab" [class.ctab--active]="selectedCollab === s.name" (click)="selectCollab(s.name)">
                  <div class="ctab-av">{{ avatarInitials(s.name) }}</div>
                  <span class="ctab-name">{{ s.name }}</span>
                  <span class="ctab-taux"
                    [class.taux-high]="s.taux >= 75"
                    [class.taux-mid]="s.taux >= 40 && s.taux < 75"
                    [class.taux-low]="s.taux < 40">{{ s.taux }}%</span>
                </button>
              }
            </div>

            <!-- Graphiques du collab sélectionné -->
            @if (selectedCollabData) {
              <div class="detail-charts-grid">

                <!-- Doughnut statuts -->
                <div class="chart-card">
                  <div class="chart-card__title">
                    Statuts — {{ selectedCollabData.name }}
                  </div>
                  <div class="chart-card__sub">{{ selectedCollabData.total }} tâche(s) assignée(s)</div>
                  <div class="chart-wrap chart-wrap--donut">
                    <canvas baseChart
                      [data]="_doughnutData"
                      [options]="doughnutOptions"
                      type="doughnut">
                    </canvas>
                  </div>
                </div>

                <!-- Bar horizontal dossiers -->
                <div class="chart-card">
                  <div class="chart-card__title">Tâches par dossier — {{ selectedCollabData.name }}</div>
                  <div class="chart-card__sub">Top {{ selectedCollabData.dossiers.length }} dossier(s)</div>
                  <div class="chart-wrap" [style.height.px]="Math.max(180, selectedCollabData.dossiers.length * 36)">
                    <canvas baseChart
                      [data]="_dossierBarData"
                      [options]="dossierBarOptions"
                      type="bar">
                    </canvas>
                  </div>
                </div>

              </div>
            }

          </div>
        </div>
      }

      <!-- ══ ALERTES ════════════════════════════════════════ -->
      @if (alertes.length > 0) {
        <div class="alertes">
          <div class="alertes__head">
            <div class="alertes__icon-wrap">
              <mat-icon>notifications_active</mat-icon>
            </div>
            <div class="alertes__headtext">
              <p class="alertes__title">Documents manquants ou en retard</p>
              <p class="alertes__sub">{{ alertes.length }} alerte{{ alertes.length > 1 ? 's' : '' }} à traiter</p>
            </div>
            <button class="text-btn" (click)="alertesExpanded = !alertesExpanded">
              {{ alertesExpanded ? 'Réduire' : 'Tout voir' }}
              <mat-icon>{{ alertesExpanded ? 'expand_less' : 'expand_more' }}</mat-icon>
            </button>
          </div>

          <div class="alertes__list">
            @for (a of alertesVisible; track $index) {
              <div class="alerte-row" matRipple [routerLink]="['/clients', a.client?.id]">
                <span class="alerte-dot" [class.dot--orange]="a.statut==='EN_RETARD'" [class.dot--red]="a.statut==='MANQUANT'"></span>
                <span class="alerte-client">{{ a.client?.nom }}</span>
                <span class="alerte-type">{{ typeLabel(a.type) }}</span>
                <span class="alerte-period">{{ moisLabel(a.mois) }} {{ a.annee }}</span>
                <span class="alerte-chip" [class.chip--orange]="a.statut==='EN_RETARD'" [class.chip--red]="a.statut==='MANQUANT'">
                  {{ a.statut === 'EN_RETARD' ? 'En retard' : 'Manquant' }}
                </span>
                <mat-icon class="alerte-arrow">chevron_right</mat-icon>
              </div>
            }
            @if (!alertesExpanded && alertes.length > 5) {
              <div class="alertes__more">+ {{ alertes.length - 5 }} autres alertes</div>
            }
          </div>
        </div>
      }

      <!-- ══ CLIENTS ════════════════════════════════════════ -->
      <div class="section-bar">
        <h2 class="section-bar__title">Dossiers clients</h2>
        <div class="chip-group">
          <button class="md-chip" [class.md-chip--active]="siteFilter===''" (click)="filterSite('')">
            <mat-icon>public</mat-icon> Tous
          </button>
          <button class="md-chip" [class.md-chip--active]="siteFilter==='REUNION'" (click)="filterSite('REUNION')">
            🇷🇪 La Réunion
          </button>
          <button class="md-chip" [class.md-chip--active]="siteFilter==='MADAGASCAR'" (click)="filterSite('MADAGASCAR')">
            🇲🇬 Madagascar
          </button>
        </div>
      </div>

      <div class="client-grid">
        @for (client of filteredClients; track client.id) {
          <div class="c-card" matRipple [routerLink]="['/clients', client.id]">

            <!-- Card top -->
            <div class="c-card__head">
              <div class="c-card__avatar" [class.av--re]="client.site==='REUNION'" [class.av--mg]="client.site==='MADAGASCAR'">
                {{ getInitials(client.nom) }}
              </div>
              <div class="c-card__info">
                <h3 class="c-card__name">{{ client.nom }}</h3>
                <span class="c-card__site" [class.site--re]="client.site==='REUNION'" [class.site--mg]="client.site==='MADAGASCAR'">
                  <mat-icon>location_on</mat-icon>
                  {{ client.site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}
                </span>
              </div>
              <div class="c-card__score-badge" [class.sb--high]="client.santePassation>=80" [class.sb--mid]="client.santePassation>=50&&client.santePassation<80" [class.sb--low]="client.santePassation<50">
                {{ client.santePassation }}%
              </div>
            </div>

            <!-- Progress -->
            <div class="c-card__prog">
              <div class="c-prog-track">
                <div class="c-prog-bar"
                  [class.bar--high]="client.santePassation>=80"
                  [class.bar--mid]="client.santePassation>=50&&client.santePassation<80"
                  [class.bar--low]="client.santePassation<50"
                  [style.width.%]="client.santePassation"></div>
              </div>
              <span class="c-prog-label">{{ getScoreLabel(client.santePassation) }}</span>
            </div>

          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    .dash { padding: 32px 36px; }

    /* ── Hero ──────────────────────────────────────── */
    .hero {
      background: #E6F4F1;
      border-radius: 24px;
      padding: 28px 32px;
      margin-bottom: 20px;
      display: flex; align-items: center; justify-content: space-between; gap: 24px;
    }
    .hero__eyebrow { display: block; font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #006B57; margin-bottom: 6px; }
    .hero__title { font-size: 28px; font-weight: 700; color: #1A1C1E; letter-spacing: -.4px; margin: 0 0 6px; }
    .hero__date { font-size: 13px; color: #44474F; margin: 0; text-transform: capitalize; }

    .hero__stats { display: flex; align-items: center; gap: 0; background: rgba(255,255,255,.6); border-radius: 16px; padding: 0 4px; }
    .h-stat { display: flex; flex-direction: column; align-items: center; padding: 16px 24px; }
    .h-stat__val { font-size: 28px; font-weight: 700; color: #1A1C1E; line-height: 1; }
    .h-stat__val--green  { color: #386A20; }
    .h-stat__val--orange { color: #7B4F00; }
    .h-stat__val--red    { color: #BA1A1A; }
    .h-stat__lbl { font-size: 11px; color: #44474F; margin-top: 4px; white-space: nowrap; }
    .h-stat__div { width: 1px; height: 32px; background: #C8C6CA; }

    /* ── Metric cards ──────────────────────────────── */
    .metrics-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
    .metric {
      border-radius: 20px;
      padding: 20px;
      display: flex; flex-direction: column; gap: 6px;
      cursor: default;
      transition: transform .15s;
    }
    .metric:hover { transform: translateY(-2px); }
    .metric__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .metric__label { font-size: 12px; font-weight: 500; color: #44474F; }
    .metric__icon {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .metric__icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .metric__value { font-size: 32px; font-weight: 700; line-height: 1; letter-spacing: -.5px; }
    .metric__tag { font-size: 11px; font-weight: 500; }

    /* ── Performance équipe ──────────────────────────── */
    .perf-section {
      background: #FFFBFE;
      border: 1px solid #E0E2EC;
      border-radius: 24px;
      padding: 24px;
      margin-bottom: 20px;
      display: flex; flex-direction: column; gap: 20px;
    }
    .perf-header { display: flex; align-items: center; justify-content: space-between; }
    .perf-header__left { display: flex; align-items: center; gap: 14px; }
    .perf-header__icon {
      width: 44px; height: 44px; border-radius: 14px; flex-shrink: 0;
      background: linear-gradient(135deg, #4f46e5, #818cf8);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(79,70,229,.25);
    }
    .perf-header__icon mat-icon { color: white; font-size: 22px; width: 22px; height: 22px; }
    .perf-header__title { font-size: 16px; font-weight: 700; color: #1A1C1E; margin: 0; }
    .perf-header__sub { font-size: 12px; color: #6F7978; margin: 2px 0 0; }

    /* Chart cards */
    .chart-card {
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 16px; padding: 18px;
    }
    .chart-card--full { }
    .chart-card__title { font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 2px; }
    .chart-card__sub { font-size: 11px; color: #94a3b8; margin-bottom: 14px; }

    .chart-wrap { position: relative; }
    .chart-wrap--bar   { height: 240px; }
    .chart-wrap--donut { height: 220px; }

    /* Collab tabs */
    .perf-detail-section { display: flex; flex-direction: column; gap: 16px; }
    .collab-tabs {
      display: flex; gap: 8px; flex-wrap: wrap;
    }
    .ctab {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px; border-radius: 12px;
      border: 1.5px solid #e2e8f0; background: white;
      cursor: pointer; transition: all .13s; font-family: inherit;
    }
    .ctab:hover { border-color: #c7d2fe; background: #f5f3ff; }
    .ctab--active { border-color: #6366f1; background: #eef2ff; }
    .ctab-av {
      width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      color: white; font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .ctab-name { font-size: 13px; font-weight: 600; color: #1e293b; }
    .ctab-taux { font-size: 12px; font-weight: 700; margin-left: 4px; }
    .taux-high { color: #16a34a; }
    .taux-mid  { color: #d97706; }
    .taux-low  { color: #dc2626; }

    /* Detail charts */
    .detail-charts-grid {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 16px;
    }
    @media (max-width: 900px) { .detail-charts-grid { grid-template-columns: 1fr; } }

    /* ── Alertes ───────────────────────────────────── */
    .alertes {
      background: #FFDAD6;
      border-radius: 20px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .alertes__head {
      display: flex; align-items: center; gap: 14px;
      padding: 18px 20px;
    }
    .alertes__icon-wrap {
      width: 40px; height: 40px; border-radius: 50%;
      background: #BA1A1A; color: #FFDAD6;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .alertes__icon-wrap mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .alertes__headtext { flex: 1; }
    .alertes__title { font-size: 14px; font-weight: 700; color: #410002; margin: 0; }
    .alertes__sub { font-size: 12px; color: #BA1A1A; margin: 2px 0 0; }

    .text-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: none; border: none; cursor: pointer;
      font-size: 13px; font-weight: 600; color: #BA1A1A;
      font-family: 'Inter', sans-serif; padding: 6px 12px; border-radius: 20px;
      transition: background .12s;
    }
    .text-btn:hover { background: rgba(186,26,26,.08); }
    .text-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .alertes__list { background: #FFFBFE; }
    .alerte-row {
      display: flex; align-items: center; gap: 12px;
      padding: 13px 20px;
      border-top: 1px solid #F5DDD9;
      cursor: pointer; transition: background .12s; position: relative;
    }
    .alerte-row:hover { background: #FFF8F7; }
    .alerte-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot--orange { background: #F97316; }
    .dot--red    { background: #BA1A1A; }
    .alerte-client { font-size: 13px; font-weight: 600; color: #1A1C1E; flex: 2; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .alerte-type   { font-size: 12.5px; color: #44474F; flex: 2; }
    .alerte-period { font-size: 12px; color: #6F7978; flex: 1; }
    .alerte-chip {
      font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; white-space: nowrap; flex-shrink: 0;
    }
    .chip--orange { background: #FFDDB0; color: #7B4F00; }
    .chip--red    { background: #FFDAD6; color: #BA1A1A; }
    .alerte-arrow { font-size: 16px; width: 16px; height: 16px; color: #C8C6CA; margin-left: auto; }
    .alertes__more { padding: 12px 20px; font-size: 12px; color: #BA1A1A; text-align: center; border-top: 1px solid #F5DDD9; font-weight: 500; }

    /* ── Section bar ───────────────────────────────── */
    .section-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .section-bar__title { font-size: 16px; font-weight: 700; color: #1A1C1E; margin: 0; }

    /* MD3 Chips */
    .chip-group { display: flex; gap: 8px; }
    .md-chip {
      display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid #C8C6CA; background: #FFFBFE;
      border-radius: 8px; padding: 6px 14px;
      font-size: 13px; font-weight: 500; color: #44474F;
      cursor: pointer; transition: all .12s; font-family: 'Inter', sans-serif;
    }
    .md-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .md-chip:hover { background: #ECE6F0; border-color: #79747E; }
    .md-chip--active {
      background: #E8DEF8; border-color: transparent; color: #21005D; font-weight: 600;
    }
    .md-chip--active mat-icon { color: #21005D; }

    /* ── Client grid ───────────────────────────────── */
    .client-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .c-card {
      background: #FFFBFE;
      border-radius: 16px;
      border: 1px solid #E0E2EC;
      padding: 18px;
      cursor: pointer;
      position: relative; overflow: hidden;
      transition: box-shadow .15s, border-color .15s;
    }
    .c-card:hover {
      box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 4px 8px 2px rgba(0,0,0,.1);
      border-color: transparent;
    }

    .c-card__head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .c-card__avatar {
      width: 44px; height: 44px; border-radius: 50%;
      font-size: 14px; font-weight: 700; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .av--re { background: #C8F8EE; color: #006B57; }
    .av--mg { background: #DDE3EA; color: #162351; }

    .c-card__info { flex: 1; min-width: 0; }
    .c-card__name {
      font-size: 14px; font-weight: 600; color: #1A1C1E; margin: 0 0 4px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .c-card__site {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 11.5px; font-weight: 500;
    }
    .c-card__site mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .site--re { color: #006B57; }
    .site--mg { color: #162351; }

    .c-card__score-badge {
      flex-shrink: 0; font-size: 13px; font-weight: 700;
      padding: 4px 10px; border-radius: 8px;
    }
    .sb--high { background: #C3EFAD; color: #386A20; }
    .sb--mid  { background: #FFDDB0; color: #7B4F00; }
    .sb--low  { background: #FFDAD6; color: #BA1A1A; }

    .c-card__prog { }
    .c-prog-track { height: 5px; background: #E0E2EC; border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
    .c-prog-bar { height: 100%; border-radius: 4px; transition: width .5s ease; }
    .bar--high { background: #386A20; }
    .bar--mid  { background: #7B4F00; }
    .bar--low  { background: #BA1A1A; }
    .c-prog-label { font-size: 11px; color: #6F7978; }

    @media (max-width: 1100px) { .metrics-row { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 760px) { .hero { flex-direction: column; align-items: flex-start; } }
  `],
})
export class DashboardComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  alertes: any[] = [];
  alertesExpanded = false;
  siteFilter = '';
  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  collabStats: CollabStat[] = [];
  selectedCollab: string | null = null;
  Math = Math;

  get selectedCollabData() { return this.collabStats.find(s => s.name === this.selectedCollab) ?? null; }

  // données graphes cachées — recalculées uniquement sur selectCollab(), pas à chaque change detection
  _doughnutData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  _dossierBarData: ChartData<'bar'>    = { labels: [], datasets: [] };

  private buildDetailChartData() {
    const s = this.selectedCollabData;
    if (!s) { this._doughnutData = { labels: [], datasets: [] }; this._dossierBarData = { labels: [], datasets: [] }; return; }
    const restantes = s.total - s.terminees - s.enCours;
    this._doughnutData = {
      labels: ['Terminées', 'En cours', 'Restantes / non faites'],
      datasets: [{ data: [s.terminees, s.enCours, restantes],
        backgroundColor: ['rgba(34,197,94,.85)', 'rgba(245,158,11,.85)', 'rgba(226,232,240,.9)'],
        borderColor: ['#16a34a', '#d97706', '#cbd5e1'], borderWidth: 1, hoverOffset: 6 }],
    };
    const top = s.dossiers.slice(0, 10);
    this._dossierBarData = {
      labels: top.map(d => d.nom),
      datasets: [
        { label: 'Terminées',  data: top.map(d => d.terminees),                         backgroundColor: 'rgba(34,197,94,.85)',  borderColor: '#16a34a', borderWidth: 1, borderRadius: 4 },
        { label: 'En cours',   data: top.map(d => d.enCours),                           backgroundColor: 'rgba(245,158,11,.85)', borderColor: '#d97706', borderWidth: 1, borderRadius: 4 },
        { label: 'Restantes',  data: top.map(d => d.total - d.terminees - d.enCours),   backgroundColor: 'rgba(226,232,240,.9)', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 4 },
      ],
    };
  }
  get totalTasksCount()    { return this.collabStats.reduce((sum, s) => sum + s.total, 0); }

  // ── Chart.js : vue d'ensemble équipe ────────────────────
  get teamBarData(): ChartData<'bar'> {
    return {
      labels: this.collabStats.map(s => s.name),
      datasets: [
        {
          label: 'Terminées',
          data: this.collabStats.map(s => s.terminees),
          backgroundColor: 'rgba(34,197,94,.85)',
          borderColor: '#16a34a',
          borderWidth: 1,
          borderRadius: 5,
        },
        {
          label: 'En cours',
          data: this.collabStats.map(s => s.enCours),
          backgroundColor: 'rgba(245,158,11,.85)',
          borderColor: '#d97706',
          borderWidth: 1,
          borderRadius: 5,
        },
        {
          label: 'Restantes',
          data: this.collabStats.map(s => s.total - s.terminees - s.enCours),
          backgroundColor: 'rgba(226,232,240,.9)',
          borderColor: '#cbd5e1',
          borderWidth: 1,
          borderRadius: 5,
        },
      ],
    };
  }

  teamBarOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 12, family: 'Inter' }, padding: 16, boxWidth: 12, boxHeight: 12 } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 12, family: 'Inter' } } },
      y: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, font: { size: 11, family: 'Inter' } }, beginAtZero: true },
    },
  };

  doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    cutout: '68%',
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 12, family: 'Inter' }, padding: 14, boxWidth: 12, boxHeight: 12 } },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} tâche(s)` } },
    },
  };

  dossierBarOptions: ChartConfiguration['options'] = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 12, family: 'Inter' }, padding: 14, boxWidth: 12, boxHeight: 12 } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, font: { size: 11 } }, beginAtZero: true },
      y: { stacked: true, grid: { display: false }, ticks: { font: { size: 11, family: 'Inter' } } },
    },
  };

  get dossiersTransmissibles() { return this.clients.filter(c => c.santePassation >= 80).length; }
  get dossiersPartiels()       { return this.clients.filter(c => c.santePassation >= 50 && c.santePassation < 80).length; }
  get dossiersEnAlerte()       { return this.clients.filter(c => c.santePassation < 50).length; }
  get firstName()              { return this.auth.currentUser()?.firstName || ''; }
  get alertesVisible()         { return this.alertesExpanded ? this.alertes : this.alertes.slice(0, 5); }

  get metrics() {
    return [
      { label: 'Dossiers actifs',   value: this.clients.length,          icon: 'folder_shared',        tag: 'Tous sites',                           color: '#006B57', iconBg: 'rgba(0,107,87,.15)',  bg: '#C8F8EE' },
      { label: 'Transmissibles',    value: this.dossiersTransmissibles,   icon: 'task_alt',             tag: 'Score ≥ 80%',                          color: '#386A20', iconBg: 'rgba(56,106,32,.15)', bg: '#C3EFAD' },
      { label: 'En cours',          value: this.dossiersPartiels,         icon: 'schedule',             tag: 'Score 50–79%',                         color: '#7B4F00', iconBg: 'rgba(123,79,0,.15)',  bg: '#FFDDB0' },
      { label: 'En alerte',         value: this.dossiersEnAlerte,         icon: 'warning_amber',        tag: 'Score < 50%',                          color: '#BA1A1A', iconBg: 'rgba(186,26,26,.15)', bg: '#FFDAD6' },
      { label: 'Docs manquants',    value: this.alertes.length,           icon: 'notifications_active', tag: this.alertes.length > 0 ? 'À traiter' : 'Tout reçu',
        color: this.alertes.length > 0 ? '#6E2A9A' : '#006B57',
        iconBg: this.alertes.length > 0 ? 'rgba(110,42,154,.15)' : 'rgba(0,107,87,.15)',
        bg:    this.alertes.length > 0 ? '#EEDCFF' : '#C8F8EE' },
    ];
  }

  constructor(
    private clientsService: ClientsService,
    private fluxService: FluxMensuelService,
    private tasksService: TasksService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.clientsService.getAll().subscribe(data => {
      this.clients = data;
      this.filteredClients = data;
    });
    this.fluxService.getAlertesGlobales().subscribe(data => this.alertes = data);
    this.tasksService.getAllGlobal().subscribe(tasks => this.buildCollabStats(tasks));
  }

  buildCollabStats(tasks: Task[]) {
    const map = new Map<string, { total: number; terminees: number; enCours: number; dossiers: Map<string, { total: number; terminees: number; enCours: number }> }>();

    for (const t of tasks) {
      if (!t.assignee) continue;
      const name = `${t.assignee.firstName} ${t.assignee.lastName}`;
      const clientNom = t.client?.nom ?? 'Sans dossier';

      if (!map.has(name)) map.set(name, { total: 0, terminees: 0, enCours: 0, dossiers: new Map() });
      const c = map.get(name)!;
      c.total++;
      if (t.statut === 'TERMINEE') c.terminees++;
      if (t.statut === 'EN_COURS') c.enCours++;

      if (!c.dossiers.has(clientNom)) c.dossiers.set(clientNom, { total: 0, terminees: 0, enCours: 0 });
      const d = c.dossiers.get(clientNom)!;
      d.total++;
      if (t.statut === 'TERMINEE') d.terminees++;
      if (t.statut === 'EN_COURS') d.enCours++;
    }

    this.collabStats = Array.from(map.entries())
      .map(([name, s]) => ({
        name,
        total: s.total,
        terminees: s.terminees,
        enCours: s.enCours,
        taux: s.total > 0 ? Math.round((s.terminees / s.total) * 100) : 0,
        dossiers: Array.from(s.dossiers.entries())
          .map(([nom, d]) => ({ nom, ...d }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.taux - a.taux);

    if (this.collabStats.length > 0) this.selectedCollab = this.collabStats[0].name;
    this.buildDetailChartData();
  }

  selectCollab(name: string) { this.selectedCollab = name; this.buildDetailChartData(); }

  filterSite(site: string) {
    this.siteFilter = site;
    this.filteredClients = site ? this.clients.filter(c => c.site === site) : this.clients;
  }

  getInitials(nom: string)    { return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  avatarInitials(name: string) { return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  getScoreLabel(score: number) {
    if (score >= 80) return 'Transmissible';
    if (score >= 50) return 'Partiellement renseigné';
    return 'Risque de perte d\'information';
  }
  typeLabel(type: string) { return TYPE_LABELS[type] ?? type; }
  moisLabel(m: number)    { return MOIS_COURT[m - 1] ?? ''; }
}
